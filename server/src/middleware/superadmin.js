const SUPERADMIN_EMAILS = ['principal@themonaco.com.co']

export default function superadmin(req, res, next) {
  if (!req.user || !SUPERADMIN_EMAILS.includes(req.user.email)) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  next()
}
