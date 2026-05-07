import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
    const fromNumber = Deno.env.get('TWILIO_FROM_NUMBER')

    if (!accountSid || !authToken || !fromNumber) {
      return jsonResponse({
        ok: false,
        error: 'Missing Twilio configuration. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER.',
      }, 500)
    }

    const body = await request.json().catch(() => ({}))
    const to = `${body?.to || ''}`.trim()
    const message = `${body?.message || ''}`.trim()

    if (!to || !message) {
      return jsonResponse({ ok: false, error: 'Both "to" and "message" are required.' }, 400)
    }

    const form = new URLSearchParams()
    form.set('To', to)
    form.set('From', fromNumber)
    form.set('Body', message)

    const auth = btoa(`${accountSid}:${authToken}`)
    const twilioResponse = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    })

    const twilioData = await twilioResponse.json().catch(() => ({}))

    if (!twilioResponse.ok) {
      return jsonResponse({
        ok: false,
        error: twilioData?.message || 'Twilio send failed.',
        details: twilioData,
      }, twilioResponse.status)
    }

    return jsonResponse({
      ok: true,
      sid: twilioData?.sid || null,
      status: twilioData?.status || 'queued',
      to,
      from: fromNumber,
    })
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}
