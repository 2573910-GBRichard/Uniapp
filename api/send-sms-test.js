export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_FROM_NUMBER

  if (!accountSid || !authToken || !fromNumber) {
    return res.status(500).json({
      error: 'Missing Twilio configuration',
      required: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER'],
    })
  }

  const to = `${req.body?.to || ''}`.trim()
  const message = `${req.body?.message || ''}`.trim()

  if (!to || !message) {
    return res.status(400).json({ error: 'Both "to" and "message" are required.' })
  }

  try {
    const form = new URLSearchParams()
    form.set('To', to)
    form.set('From', fromNumber)
    form.set('Body', message)

    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
    const twilioResponse = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    })

    const raw = await twilioResponse.text()
    let data = {}

    try {
      data = raw ? JSON.parse(raw) : {}
    } catch {
      data = { raw }
    }

    if (!twilioResponse.ok) {
      return res.status(twilioResponse.status).json({
        ok: false,
        error: data?.message || 'Twilio send failed.',
        details: data,
      })
    }

    return res.status(200).json({
      ok: true,
      sid: data?.sid || null,
      status: data?.status || 'queued',
      to,
      from: fromNumber,
    })
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || 'Unknown error while sending SMS',
    })
  }
}
