export default async function handler(req, res) {
  return res.status(200).json({
    hasMsSenderEmail: Boolean(process.env.MS_SENDER_EMAIL),
    hasMsTenantId: Boolean(process.env.MS_TENANT_ID),
    hasMsClientId: Boolean(process.env.MS_CLIENT_ID),
    hasMsClientSecret: Boolean(process.env.MS_CLIENT_SECRET),
    hasSevenShiftsApiKey: Boolean(process.env.SEVENSHIFTS_API_KEY),
    sevenShiftsCompanyId: process.env.SEVENSHIFTS_COMPANY_ID || null,
    vercelEnv: process.env.VERCEL_ENV || null,
  })
}
