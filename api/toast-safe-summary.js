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
    cashIn: 0,
    cashOut: 0,
    payOut: 0,
    tipOut: 0,
    undoPayOut: 0,
    closeOutOverage: 0,
    closeOutShortage: 0,
    otherEntries: {},
  }

  if (!Array.isArray(entries)) {
    return summary
  }

  for (const entry of entries) {
    const amount = Number(entry?.amount || entry?.value || 0)
    if (Number.isNaN(amount)) continue
    const type = `${entry?.type || ''}`.toUpperCase()

    if (type === 'CASH_COLLECTED') summary.cashCollected += amount
    else if (type === 'CASH_IN') summary.cashIn += amount
    else if (type === 'CASH_OUT') summary.cashOut += Math.abs(amount)
    else if (type === 'PAY_OUT') summary.payOut += Math.abs(amount)
    else if (type === 'TIP_OUT') summary.tipOut += Math.abs(amount)
    else if (type === 'UNDO_PAY_OUT') summary.undoPayOut += amount
    else if (type === 'CLOSE_OUT_OVERAGE') summary.closeOutOverage += amount
    else if (type === 'CLOSE_OUT_SHORTAGE') summary.closeOutShortage += amount
    else if (type && type !== 'NO_SALE') {
      summary.otherEntries[type] = (summary.otherEntries[type] || 0) + amount
    }
  }

  return summary
}

function summarizeCashPayments(payments = []) {
  if (!Array.isArray(payments)) {
    return { totalCashPaymentsInDrawers: 0, excludedCashInHandPayments: 0, cashPaymentCount: 0 }
  }

  return payments.reduce((summary, payment) => {
    if (payment?.error) return summary
    const isCash = `${payment?.type || ''}`.toUpperCase() === 'CASH'
    const amount = Number(payment?.amount || 0)
    if (!isCash || Number.isNaN(amount)) return summary

    summary.cashPaymentCount += 1
    if (payment?.cashDrawer) {
      summary.totalCashPaymentsInDrawers += amount
    } else {
      summary.excludedCashInHandPayments += amount
    }

    return summary
  }, { totalCashPaymentsInDrawers: 0, excludedCashInHandPayments: 0, cashPaymentCount: 0 })
}

function estimateExpectedDeposit(entrySummary, paymentSummary) {
  const total =
    (paymentSummary?.totalCashPaymentsInDrawers || 0) +
    (entrySummary?.cashCollected || 0) +
    (entrySummary?.cashIn || 0) +
    (entrySummary?.undoPayOut || 0) +
    (entrySummary?.closeOutOverage || 0) -
    (entrySummary?.cashOut || 0) -
    (entrySummary?.payOut || 0) -
    (entrySummary?.tipOut || 0) -
    Math.abs(entrySummary?.closeOutShortage || 0)

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

    return res.status(200).json({
      ok: true,
      businessDate,
      restaurantGuid,
      expectedDepositEstimate,
      cashBreakdown: {
        ...entrySummary,
        ...paymentSummary,
      },
      cashEntries: entryList,
      payments: paymentList,
      deposits: depositList,
      notes: [
        'Toast expected deposit rule: cash payments in drawers + cash collected + cash-ins - cash-outs - payouts - tips/gratuities claimed during shift review.',
        'Cash payments with null cashDrawer are excluded here to avoid double counting cash in hand that later becomes CASH_COLLECTED.',
        'Use this route to inspect the Toast cash-management payloads for the selected business date and location.',
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
