async function getToastAccessToken() {
  const clientId = process.env.TOAST_CLIENT_ID
  const clientSecret = process.env.TOAST_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Missing Toast API configuration')
  }

  const response = await fetch('https://ws-api.toasttab.com/authentication/v1/authentication/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      clientId,
      clientSecret,
      userAccessType: 'TOAST_MACHINE_CLIENT',
    }),
  })

  const raw = await response.text()
  let data = {}

  try {
    data = raw ? JSON.parse(raw) : {}
  } catch {
    data = { raw }
  }

  if (!response.ok) {
    throw new Error(`Toast auth failed: ${data?.message || raw || 'Unknown error'}`)
  }

  if (!data?.token?.accessToken) {
    throw new Error('Toast auth response missing access token')
  }

  return data.token.accessToken
}

async function fetchToastJson(path, accessToken, restaurantGuid, query = {}) {
  const url = new URL(`https://ws-api.toasttab.com/${path}`)
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value)
    }
  })

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Toast-Restaurant-External-ID': restaurantGuid,
      Accept: 'application/json',
    },
  })

  const raw = await response.text()
  let data = {}

  try {
    data = raw ? JSON.parse(raw) : {}
  } catch {
    data = { raw }
  }

  if (!response.ok) {
    throw new Error(`Toast request failed for ${path}: ${data?.message || raw || 'Unknown error'}`)
  }

  return data
}

function estimateExpectedDeposit(entries = []) {
  if (!Array.isArray(entries)) return null

  let total = 0
  for (const entry of entries) {
    const amount = Number(entry?.amount || entry?.value || 0)
    if (Number.isNaN(amount)) continue
    total += amount
  }

  return Number.isFinite(total) ? total : null
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const businessDate = `${req.query?.businessDate || ''}`.trim()
  const restaurantGuid = `${req.query?.restaurantGuid || ''}`.trim()

  if (!businessDate || !restaurantGuid) {
    return res.status(400).json({
      error: 'Both businessDate and restaurantGuid are required',
      example: '/api/toast-safe-summary?businessDate=2026-05-08&restaurantGuid=YOUR_TOAST_LOCATION_GUID',
    })
  }

  try {
    const accessToken = await getToastAccessToken()

    const [entries, deposits] = await Promise.all([
      fetchToastJson('cashmgmt/v1/entries', accessToken, restaurantGuid, { businessDate }).catch((error) => ({ error: error.message })),
      fetchToastJson('cashmgmt/v1/deposits', accessToken, restaurantGuid, { businessDate }).catch((error) => ({ error: error.message })),
    ])

    const entryList = Array.isArray(entries) ? entries : Array.isArray(entries?.results) ? entries.results : []
    const depositList = Array.isArray(deposits) ? deposits : Array.isArray(deposits?.results) ? deposits.results : []

    return res.status(200).json({
      ok: true,
      businessDate,
      restaurantGuid,
      expectedDepositEstimate: estimateExpectedDeposit(entryList),
      cashEntries: entryList,
      deposits: depositList,
      notes: [
        'This is the first Toast safe-summary pull scaffold.',
        'Expected deposit may need a more exact Toast-specific formula based on entry types and cash-management rules.',
        'Use this route to inspect the raw Toast cash-management payloads for the selected business date and location.',
      ],
      entryError: entries?.error || null,
      depositError: deposits?.error || null,
    })
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || 'Toast safe summary lookup failed',
    })
  }
}
