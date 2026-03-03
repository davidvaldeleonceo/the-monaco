const BOGOTA_TZ = 'America/Bogota'

/**
 * Returns a Date object representing "now" in Bogotá timezone.
 * Internally it shifts the UTC date so that getFullYear/getMonth/getDate/getHours
 * all return the Bogotá-local values.
 */
export function nowBogota() {
  const now = new Date()
  const bogotaStr = now.toLocaleString('en-US', { timeZone: BOGOTA_TZ })
  return new Date(bogotaStr)
}

/**
 * Returns "YYYY-MM-DD" string for the current moment in Bogotá timezone.
 */
export function todayBogotaStr() {
  const d = nowBogota()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/**
 * Returns a full ISO-like string in Bogotá local time: "YYYY-MM-DDTHH:mm:ss-05:00"
 * Includes the Colombia UTC-5 offset so TIMESTAMPTZ columns interpret it correctly.
 */
export function nowBogotaISO() {
  const d = nowBogota()
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${y}-${mo}-${dd}T${hh}:${mi}:${ss}-05:00`
}

/**
 * Extracts the "YYYY-MM-DD" date part from a fecha string,
 * converting to Bogotá timezone if the string contains a UTC indicator (Z or +offset).
 * This ensures a service saved at 11 PM Colombia (04:00 UTC next day)
 * still shows as today's date.
 */
export function fechaToBogotaDate(fechaStr) {
  if (!fechaStr || typeof fechaStr !== 'string') return null
  // If it's already a plain date (no T), return as-is
  if (!fechaStr.includes('T')) return fechaStr
  // If it has a Z or timezone offset, it's UTC — convert to Bogotá
  if (fechaStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(fechaStr)) {
    const d = new Date(fechaStr)
    if (isNaN(d.getTime())) return null
    const bogotaStr = d.toLocaleString('en-US', { timeZone: BOGOTA_TZ })
    const bogota = new Date(bogotaStr)
    const y = bogota.getFullYear()
    const m = String(bogota.getMonth() + 1).padStart(2, '0')
    const dd = String(bogota.getDate()).padStart(2, '0')
    return `${y}-${m}-${dd}`
  }
  // Otherwise it's a local ISO string — just split at T
  return fechaStr.split('T')[0]
}
