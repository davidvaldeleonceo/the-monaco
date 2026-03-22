let _timezone = 'America/Bogota'

export function setTimezone(tz) { _timezone = tz }
export function getActiveTimezone() { return _timezone }

/**
 * Returns the UTC offset string (e.g. "-05:00", "-03:00") for the active timezone.
 */
export function getTimezoneOffset() {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: _timezone, timeZoneName: 'shortOffset'
  }).formatToParts(now)
  const offsetStr = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT-5'
  const match = offsetStr.match(/GMT([+-]?\d+)(?::(\d+))?/)
  if (!match) return '-05:00'
  const h = parseInt(match[1])
  const m = match[2] ? parseInt(match[2]) : 0
  const sign = h >= 0 ? '+' : '-'
  return `${sign}${String(Math.abs(h)).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Returns a Date object representing "now" in the active timezone.
 * Internally it shifts the UTC date so that getFullYear/getMonth/getDate/getHours
 * all return the timezone-local values.
 */
export function nowBogota() {
  const now = new Date()
  const localStr = now.toLocaleString('en-US', { timeZone: _timezone })
  return new Date(localStr)
}

/**
 * Returns "YYYY-MM-DD" string for the current moment in the active timezone.
 */
export function todayBogotaStr() {
  const d = nowBogota()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/**
 * Returns a full ISO-like string in the active timezone: "YYYY-MM-DDTHH:mm:ss{offset}"
 * Includes the dynamic UTC offset so TIMESTAMPTZ columns interpret it correctly.
 */
export function nowBogotaISO() {
  const d = nowBogota()
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${y}-${mo}-${dd}T${hh}:${mi}:${ss}${getTimezoneOffset()}`
}

/**
 * Extracts the "YYYY-MM-DD" date part from a fecha string,
 * converting to the active timezone if the string contains a UTC indicator (Z or +offset).
 * This ensures a service saved at 11 PM local (next day in UTC)
 * still shows as today's date.
 */
export function fechaToBogotaDate(fechaStr) {
  if (!fechaStr || typeof fechaStr !== 'string') return null
  // If it's already a plain date (no T), return as-is
  if (!fechaStr.includes('T')) return fechaStr
  // If it has a Z or timezone offset, it's UTC — convert to active timezone
  if (fechaStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(fechaStr)) {
    const d = new Date(fechaStr)
    if (isNaN(d.getTime())) return null
    const localStr = d.toLocaleString('en-US', { timeZone: _timezone })
    const local = new Date(localStr)
    const y = local.getFullYear()
    const m = String(local.getMonth() + 1).padStart(2, '0')
    const dd = String(local.getDate()).padStart(2, '0')
    return `${y}-${m}-${dd}`
  }
  // Otherwise it's a local ISO string — just split at T
  return fechaStr.split('T')[0]
}
