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

  const raw = await response.text()

  if (!response.ok) {
    throw new Error(`Token request failed: ${raw}`)
  }

  let data
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error(`Token response was not valid JSON: ${raw}`)
  }

  if (!data.access_token) {
    throw new Error('Token response did not include an access_token')
  }

  return data.access_token
}

export default async function handler(req, res) {
  const sender = process.env.MS_SENDER_EMAIL

  if (!sender) {
    return res.status(500).json({ error: 'Missing sender email configuration', stage: 'env' })
  }

  try {
    const accessToken = await getAccessToken()

    let response
    try {
      response = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}?$select=id,displayName,mail,userPrincipalName`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      })
    } catch (error) {
      return res.status(500).json({
        error: `Graph user lookup fetch failed: ${error.message || 'Unknown network error'}`,
        stage: 'graph-user-lookup-fetch',
        sender,
      })
    }

    const raw = await response.text()

    if (!response.ok) {
      return res.status(500).json({
        error: raw,
        stage: 'graph-user-lookup-response',
        sender,
      })
    }

    let data
    try {
      data = JSON.parse(raw)
    } catch {
      return res.status(500).json({
        error: `Graph user lookup returned non-JSON: ${raw}`,
        stage: 'graph-user-lookup-parse',
        sender,
      })
    }

    return res.status(200).json({
      ok: true,
      stage: 'graph-user-lookup-ok',
      sender,
      user: data,
    })
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Graph debug failed', stage: 'handler' })
  }
}
