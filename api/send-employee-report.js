async function getAccessToken() {
  const tenantId = process.env.MS_TENANT_ID
  const clientId = process.env.MS_CLIENT_ID
  const clientSecret = process.env.MS_CLIENT_SECRET

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Missing Microsoft Graph mail configuration')
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  })

  let response
  try {
    response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
  } catch (error) {
    throw new Error(`Token fetch failed: ${error.message || 'Network error while requesting Microsoft token'}`)
  }

  if (!response.ok) {
    throw new Error(`Token request failed: ${await response.text()}`)
  }

  const data = await response.json()

  if (!data.access_token) {
    throw new Error('Token response did not include an access_token')
  }

  return data.access_token
}

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

async function fetchAllUsers(companyId, apiKey) {
  const pageSize = 100
  let page = 1
  let results = []
  const seenUserIds = new Set()
  const seenPageSignatures = new Set()

  while (true) {
    const payload = await fetchJson(`https://api.7shifts.com/v2/users?company_id=${companyId}&limit=${pageSize}&page=${page}`, apiKey)
    const pageResults = Array.isArray(payload.results) ? payload.results : []
    const pageSignature = pageResults.map((user) => user?.id).filter(Boolean).join(',')

    if (!pageResults.length || (pageSignature && seenPageSignatures.has(pageSignature))) break
    if (pageSignature) seenPageSignatures.add(pageSignature)

    for (const user of pageResults) {
      const userId = user?.id
      if (!userId || seenUserIds.has(userId)) continue
      seenUserIds.add(userId)
      results.push(user)
    }

    const paging = payload?.paging || {}
    const hasExplicitNext = Boolean(paging.next)
    const totalPages = Number(paging.total_pages || 0)
    const currentPage = Number(paging.page || page)
    const shouldContinue = hasExplicitNext || (totalPages > 0 && currentPage < totalPages)

    if (!shouldContinue) break
    page += 1
    if (page > 50) break
  }

  return results
}

async function fetchUsersWithAssignments(companyId, apiKey) {
  const users = await fetchAllUsers(companyId, apiKey)

  return Promise.all(
    users.map(async (user) => {
      const [roleAssignments, locationAssignments] = await Promise.all([
        fetchJson(`https://api.7shifts.com/v2/company/${companyId}/users/${user.id}/role_assignments`, apiKey).catch(() => ({ data: [] })),
        fetchJson(`https://api.7shifts.com/v2/company/${companyId}/users/${user.id}/location_assignments`, apiKey).catch(() => ({ data: [] })),
      ])

      return {
        id: user.id,
        name: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || 'Unknown',
        email: user.email || '',
        active: user.active ? 'Yes' : 'No',
        startDate: user.hire_date || 'Unknown',
        type: user.type || '',
        roles: (Array.isArray(roleAssignments.data) ? roleAssignments.data : [])
          .map((item) => item.role_name || item.name || '')
          .filter(Boolean)
          .join(', ') || 'Unassigned',
        locations: (Array.isArray(locationAssignments.data) ? locationAssignments.data : [])
          .map((item) => item.name || '')
          .filter(Boolean)
          .join(', ') || 'Unassigned',
      }
    }),
  )
}

function buildHtml(rows, companyId) {
  const generatedAt = new Date().toISOString()
  const bodyRows = rows.map((row) => `
    <tr>
      <td>${escapeHtml(String(row.name))}</td>
      <td>${escapeHtml(String(row.email))}</td>
      <td>${escapeHtml(String(row.active))}</td>
      <td>${escapeHtml(String(row.startDate))}</td>
      <td>${escapeHtml(String(row.roles))}</td>
      <td>${escapeHtml(String(row.locations))}</td>
      <td>${escapeHtml(String(row.type))}</td>
    </tr>
  `).join('')

  return `
    <html>
      <body style="font-family: Arial, sans-serif; color: #111;">
        <h2>7shifts employee export</h2>
        <p><strong>Company ID:</strong> ${escapeHtml(companyId)}</p>
        <p><strong>Records returned by current app pull:</strong> ${rows.length}</p>
        <p><strong>Generated:</strong> ${escapeHtml(generatedAt)}</p>
        <p><em>Note: this report reflects the current app pull, even if incomplete.</em></p>
        <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Active</th>
              <th>Start Date</th>
              <th>Roles</th>
              <th>Locations</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </body>
    </html>
  `
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const sender = process.env.MS_SENDER_EMAIL
  const apiKey = process.env.SEVENSHIFTS_API_KEY
  const companyId = process.env.SEVENSHIFTS_COMPANY_ID || '112695'
  const recipient = req.body?.recipient || 'richard@uniconcepts.com'

  if (!sender) {
    return res.status(500).json({ error: 'Missing sender email configuration' })
  }

  if (!apiKey) {
    return res.status(500).json({ error: 'Missing 7shifts API key configuration' })
  }

  try {
    const rows = await fetchUsersWithAssignments(companyId, apiKey)
    const accessToken = await getAccessToken()
    const html = buildHtml(rows, companyId)
    const subject = `7shifts employee export, current app pull (${rows.length} records)`

    const graphUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`
    let response

    try {
      response = await fetch(graphUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            subject,
            body: {
              contentType: 'HTML',
              content: html,
            },
            toRecipients: [
              {
                emailAddress: {
                  address: recipient,
                },
              },
            ],
          },
          saveToSentItems: true,
        }),
      })
    } catch (error) {
      return res.status(500).json({
        error: `Graph sendMail fetch failed: ${error.message || 'Unknown network error'}`,
        stage: 'graph-sendMail',
        sender,
        recipient,
        companyId,
      })
    }

    if (!response.ok) {
      return res.status(500).json({
        error: await response.text(),
        stage: 'graph-sendMail-response',
        sender,
        recipient,
        companyId,
      })
    }

    return res.status(200).json({ ok: true, count: rows.length, recipient, sender })
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to send employee report', stage: 'handler' })
  }
}
