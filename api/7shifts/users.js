async function fetchJson(url, apiKey) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
  })

  const data = await response.json()

  if (!response.ok) {
    const message = data?.detail || data?.error_description || data?.message || '7shifts request failed'
    throw new Error(message)
  }

  return data
}

function getDateRangeForToday() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Phoenix',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const today = formatter.format(new Date())
  return { startDate: today, endDate: today }
}

async function fetchTodayShiftUserIds(companyId, apiKey) {
  const { startDate, endDate } = getDateRangeForToday()

  try {
    const payload = await fetchJson(`https://api.7shifts.com/v2/company/${companyId}/shifts?start_date=${startDate}&end_date=${endDate}`, apiKey)
    const results = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.results) ? payload.results : []

    return Array.from(new Set(results.map((shift) => shift?.user_id).filter(Boolean)))
  } catch (error) {
    console.warn('Unable to load today\'s shifts from 7shifts:', error.message)
    return []
  }
}

async function fetchAllUsers(companyId, apiKey) {
  const pageSize = 100
  const results = []
  const seenUserIds = new Set()
  const seenPageSignatures = new Set()
  const seenCursors = new Set()
  let nextCursor = null
  let page = 1

  while (true) {
    const cursorParam = nextCursor ? `&cursor=${encodeURIComponent(nextCursor)}` : `&page=${page}`
    const payload = await fetchJson(`https://api.7shifts.com/v2/users?company_id=${companyId}&limit=${pageSize}${cursorParam}`, apiKey)
    const pageResults = Array.isArray(payload.results) ? payload.results : []
    const pageSignature = pageResults.map((user) => user?.id).filter(Boolean).join(',')

    if (!pageResults.length || (pageSignature && seenPageSignatures.has(pageSignature))) {
      break
    }

    if (pageSignature) {
      seenPageSignatures.add(pageSignature)
    }

    for (const user of pageResults) {
      const userId = user?.id
      if (!userId || seenUserIds.has(userId)) continue
      seenUserIds.add(userId)
      results.push(user)
    }

    const cursor = payload?.next_cursor || null
    if (cursor) {
      if (seenCursors.has(cursor)) break
      seenCursors.add(cursor)
      nextCursor = cursor
      if (seenCursors.size > 100) break
      continue
    }

    const paging = payload?.paging || {}
    const hasExplicitNext = Boolean(paging.next)
    const totalPages = Number(paging.total_pages || 0)
    const currentPage = Number(paging.page || page)
    const shouldContinue = hasExplicitNext || (totalPages > 0 && currentPage < totalPages)

    if (!shouldContinue) {
      break
    }

    page += 1
    if (page > 50) break
  }

  return results
}

export default async function handler(request, response) {
  const { company_id } = request.query

  if (!company_id) {
    return response.status(400).json({ error: 'company_id is required' })
  }

  const apiKey = process.env.SEVENSHIFTS_API_KEY

  if (!apiKey) {
    return response.status(500).json({ error: 'Missing 7shifts API key' })
  }

  try {
    const [users, workingTodayUserIds] = await Promise.all([
      fetchAllUsers(company_id, apiKey),
      fetchTodayShiftUserIds(company_id, apiKey),
    ])

    const enrichedUsers = await Promise.all(
      users.map(async (user) => {
        const [roleAssignments, locationAssignments] = await Promise.all([
          fetchJson(`https://api.7shifts.com/v2/company/${company_id}/users/${user.id}/role_assignments`, apiKey).catch(() => ({ data: [] })),
          fetchJson(`https://api.7shifts.com/v2/company/${company_id}/users/${user.id}/location_assignments`, apiKey).catch(() => ({ data: [] })),
        ])

        return {
          ...user,
          role_assignments: Array.isArray(roleAssignments.data) ? roleAssignments.data : [],
          location_assignments: Array.isArray(locationAssignments.data) ? locationAssignments.data : [],
        }
      }),
    )

    return response.status(200).json({ results: enrichedUsers, count: enrichedUsers.length, workingTodayUserIds })
  } catch (error) {
    return response.status(500).json({ error: error.message || 'Failed to load 7shifts users' })
  }
}
