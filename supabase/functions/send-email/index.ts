async function getAccessToken() {
  const tenantId = Deno.env.get('MS_TENANT_ID')
  const clientId = Deno.env.get('MS_CLIENT_ID')
  const clientSecret = Deno.env.get('MS_CLIENT_SECRET')

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

  const raw = await response.text()

  if (!response.ok) {
    throw new Error(`Token request failed: ${raw}`)
  }

  const data = JSON.parse(raw)

  if (!data.access_token) {
    throw new Error('Token response did not include an access_token')
  }

  return data.access_token as string
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function textToHtml(text: string) {
  return escapeHtml(text).replaceAll('\n', '<br />')
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const sender = Deno.env.get('MS_SENDER_EMAIL')
  if (!sender) {
    return json({ error: 'Missing sender email configuration', stage: 'env' }, 500)
  }

  try {
    const body = await req.json().catch(() => ({}))
    const recipients = Array.isArray(body?.recipients)
      ? body.recipients.filter((value: unknown) => typeof value === 'string' && value.trim())
      : typeof body?.recipient === 'string' && body.recipient.trim()
        ? [body.recipient.trim()]
        : []

    const subject = typeof body?.subject === 'string' ? body.subject.trim() : ''
    const text = typeof body?.text === 'string' ? body.text.trim() : ''
    const html = typeof body?.html === 'string' && body.html.trim() ? body.html : textToHtml(text)
    const attachments = Array.isArray(body?.attachments)
      ? body.attachments
          .filter((value: unknown) => value && typeof value === 'object')
          .map((value: Record<string, unknown>) => ({
            name: typeof value.filename === 'string' && value.filename.trim()
              ? value.filename.trim()
              : typeof value.name === 'string' && value.name.trim()
                ? value.name.trim()
                : 'attachment',
            contentType: typeof value.contentType === 'string' && value.contentType.trim()
              ? value.contentType.trim()
              : typeof value.mimeType === 'string' && value.mimeType.trim()
                ? value.mimeType.trim()
                : 'application/octet-stream',
            contentBytes: typeof value.contentBase64 === 'string' && value.contentBase64.trim()
              ? value.contentBase64.trim()
              : typeof value.buffer === 'string' && value.buffer.trim()
                ? value.buffer.trim()
                : '',
          }))
          .filter((value) => value.contentBytes)
      : []

    if (!recipients.length) {
      return json({ error: 'At least one recipient is required', stage: 'input' }, 400)
    }

    if (!subject) {
      return json({ error: 'Subject is required', stage: 'input' }, 400)
    }

    if (!text && !html) {
      return json({ error: 'Email body is required', stage: 'input' }, 400)
    }

    const accessToken = await getAccessToken()
    const graphUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`
    const response = await fetch(graphUrl, {
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
          toRecipients: recipients.map((address: string) => ({
            emailAddress: { address },
          })),
          attachments: attachments.map((attachment) => ({
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: attachment.name,
            contentType: attachment.contentType,
            contentBytes: attachment.contentBytes,
          })),
        },
        saveToSentItems: true,
      }),
    })

    if (!response.ok) {
      return json({
        error: await response.text(),
        stage: 'graph-sendMail-response',
        sender,
        recipients,
      }, 500)
    }

    return json({ ok: true, sender, recipients, subject })
  } catch (error) {
    return json({ error: error.message || 'Failed to send email', stage: 'handler' }, 500)
  }
})
