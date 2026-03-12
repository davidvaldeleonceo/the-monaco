import env from '../config/env.js'
import logger from '../config/logger.js'

const RESEND_API = 'https://api.resend.com/emails'
const FROM_EMAIL = process.env.RESEND_FROM || 'Monaco PRO <onboarding@resend.dev>'

export async function sendPasswordResetEmail(to, resetUrl) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    // Dev mode: log the reset URL to console instead of sending email
    logger.warn('RESEND_API_KEY not configured — logging reset URL to console')
    logger.info(`\n========== PASSWORD RESET LINK ==========`)
    logger.info(`Email: ${to}`)
    logger.info(`URL: ${resetUrl}`)
    logger.info(`==========================================\n`)
    return
  }

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
  <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#0A2F7E;padding:24px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">monaco <span style="background:#fff;color:#0A2F7E;font-size:11px;padding:2px 8px;border-radius:6px;margin-left:6px;vertical-align:middle;">PRO</span></h1>
    </div>
    <div style="padding:32px 24px;">
      <h2 style="margin:0 0 12px;font-size:18px;color:#1a1a1a;">Restablecer contraseña</h2>
      <p style="margin:0 0 24px;color:#555;font-size:14px;line-height:1.6;">
        Recibimos una solicitud para restablecer la contraseña de tu cuenta. Haz clic en el botón para crear una nueva contraseña.
      </p>
      <a href="${resetUrl}" style="display:inline-block;background:#0A2F7E;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:14px;">
        Restablecer contraseña
      </a>
      <p style="margin:24px 0 0;color:#999;font-size:12px;line-height:1.5;">
        Este enlace expira en 1 hora. Si no solicitaste restablecer tu contraseña, puedes ignorar este correo.
      </p>
    </div>
    <div style="border-top:1px solid #eee;padding:16px 24px;text-align:center;">
      <p style="margin:0;color:#bbb;font-size:11px;">Monaco PRO — Sistema de Gestión para Lavaderos</p>
    </div>
  </div>
</body>
</html>`

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      subject: 'Restablecer contraseña — Monaco PRO',
      html,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    logger.error(`Resend API error ${res.status}: ${body}`)
    throw new Error('Failed to send email')
  }

  logger.info(`Password reset email sent to ${to}`)
}
