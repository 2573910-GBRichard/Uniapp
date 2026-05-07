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

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
    })
  }

  const sender = Deno.env.get('MS_SENDER_EMAIL')

  if (!sender) {
    return json({ error: 'Missing sender email configuration', stage: 'env' }, 500)
  }

  try {
    const accessToken = await getAccessToken()
    const response = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}?$select=id,displayName,mail,userPrincipalName`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    })

    const raw = await response.text()

    if (!response.ok) {
      return json({ error: raw, stage: 'graph-user-lookup-response', sender }, 500)
    }

    const data = JSON.parse(raw)

    return json({ ok: true, stage: 'graph-user-lookup-ok', sender, user: data })
  } catch (error) {
    return json({ error: error.message || 'Graph debug failed', stage: 'handler' }, 500)
  }
})
