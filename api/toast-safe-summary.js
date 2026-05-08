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

function normalizeBusinessDate(value) {
  const trimmed = `${value || ''}`.trim()
  if (!trimmed) return ''
  return trimmed.replaceAll('-', '')
}

function summarizeCashEntries(entries = []) {
  const summary = {
    cashCollected: 0,
    undoTipOutCollected: 0,
    tipOut: 0,
    payOut: 0,
    cashOut: 0,
    closeOutShortage: 0,
    otherNonPaymentEntries: 0,
    nonPaymentEntryTotal: 0,
  }

  if (!Array.isArray(entries)) {
    return summary
  }

  for (const entry of entries) {
    const amount = Number(entry?.amount || entry?.value || 0)
    if (Number.isNaN(amount)) continue
    const type = `${entry?.type || ''}`.toUpperCase()
    const reason = `${entry?.reason || ''}`

    if (type === 'CASH_COLLECTED') {
      if (reason.includes('Undo Tip Out')) {
        summary.undoTipOutCollected += amount
        summary.nonPaymentEntryTotal += amount
      } else {
        summary.cashCollected += amount
      }
      continue
    }

    summary.nonPaymentEntryTotal += amount

    if (type === 'TIP_OUT') summary.tipOut += amount
    else if (type === 'PAY_OUT') summary.payOut += amount
    else if (type === 'CASH_OUT') summary.cashOut += amount
    else if (type === 'CLOSE_OUT_SHORTAGE') summary.closeOutShortage += amount
    else if (type !== 'NO_SALE') summary.otherNonPaymentEntries += amount
  }

  return summary
}

function summarizeCashPayments(payments = []) {
  if (!Array.isArray(payments)) {
    return { cashPayments: 0 }
  }

  const cashPayments = payments.reduce((sum, payment) => {
    const isCash = `${payment?.type || ''}`.toUpperCase() === 'CASH'
    const amount = Number(payment?.amount || 0)
    if (!isCash || Number.isNaN(amount)) return sum
    return sum + amount
  }, 0)

  return { cashPayments }
}

function estimateExpectedDeposit(entrySummary, paymentSummary) {
  const totalCashPayments = (paymentSummary?.cashPayments || 0)
  const nonPaymentEntryTotal = (entrySummary?.nonPaymentEntryTotal || 0)
  const total = totalCashPayments + nonPaymentEntryTotal
  return Number.isFinite(total) ? total : null
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const businessDate = normalizeBusinessDate(req.query?.businessDate)
  const restaurantGuid = `${req.query?.restaurantGuid || ''}`.trim()

  if (!businessDate || !restaurantGuid) {
    return res.status(400).json({
      error: 'Both businessDate and restaurantGuid are required',
      example: '/api/toast-safe-summary?businessDate=2026-05-08&restaurantGuid=YOUR_TOAST_LOCATION_GUID',
    })
  }

  try {
    const accessToken = await getToastAccessToken()

    const [entries, deposits, paymentsIndex] = await Promise.all([
      fetchToastJson('cashmgmt/v1/entries', accessToken, restaurantGuid, { businessDate }).catch((error) => ({ error: error.message })),
      fetchToastJson('cashmgmt/v1/deposits', accessToken, restaurantGuid, { businessDate }).catch((error) => ({ error: error.message })),
      fetchToastJson('orders/v2/payments', accessToken, restaurantGuid, { paidBusinessDate: businessDate }).catch((error) => ({ error: error.message })),
    ])

    const entryList = Array.isArray(entries) ? entries : Array.isArray(entries?.results) ? entries.results : []
    const depositList = Array.isArray(deposits) ? deposits : Array.isArray(deposits?.results) ? deposits.results : []
    const paymentIds = Array.isArray(paymentsIndex) ? paymentsIndex : Array.isArray(paymentsIndex?.results) ? paymentsIndex.results : []
    const payments = await Promise.all(
      paymentIds.map((payment) => {
        const guid = typeof payment === 'string' ? payment : payment?.guid
        if (!guid) return null
        return fetchToastJson(`orders/v2/payments/${guid}`, accessToken, restaurantGuid).catch((error) => ({ error: error.message, guid }))
      }),
    )
    const paymentList = payments.filter(Boolean)
    const entrySummary = summarizeCashEntries(entryList)
    const paymentSummary = summarizeCashPayments(paymentList)
    const expectedDepositEstimate = estimateExpectedDeposit(entrySummary, paymentSummary)
    const impliedCashInHand = Number.isFinite((paymentSummary.cashPayments || 0) - (entrySummary.cashCollected || 0))
      ? (paymentSummary.cashPayments || 0) - (entrySummary.cashCollected || 0)
      : null

    return res.status(200).json({
      ok: true,
      businessDate,
      restaurantGuid,
      expectedDepositEstimate,
      cashBreakdown: {
        ...entrySummary,
        ...paymentSummary,
        impliedCashInHand,
      },
      cashEntries: entryList,
      payments: paymentList,
      deposits: depositList,
      notes: [
        'This is the first Toast safe-summary pull scaffold.',
        'Expected deposit may need a more exact Toast-specific formula based on entry types and cash-management rules.',
        'Use this route to inspect the raw Toast cash-management payloads for the selected business date and location.',
      ],
      entryError: entries?.error || null,
      depositError: deposits?.error || null,
      paymentError: paymentsIndex?.error || null,
    })
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || 'Toast safe summary lookup failed',
    })
  }
}
