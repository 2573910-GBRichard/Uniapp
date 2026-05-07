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

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Token request failed: ${errorText}`)
  }

  const data = await response.json()
  return data.access_token
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const sender = process.env.MS_SENDER_EMAIL
  const recipient = process.env.MONTHLY_SUMMARY_RECIPIENT || sender

  if (!sender) {
    return res.status(500).json({ error: 'Missing sender email configuration' })
  }

  try {
    const accessToken = await getAccessToken()
    const { subject, html } = req.body || {}

    const response = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject: subject || 'Uniconcepts Monthly Summary',
          body: {
            contentType: 'HTML',
            content: html || '<p>Monthly summary placeholder.</p>',
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

    if (!response.ok) {
      const errorText = await response.text()
      return res.status(500).json({ error: errorText })
    }

    return res.status(200).json({ ok: true })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
