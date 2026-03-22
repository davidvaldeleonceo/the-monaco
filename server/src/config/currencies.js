export const CURRENCY_CONFIG = {
  COP: { locale: 'es-CO', symbol: '$', decimals: 0, name: 'Peso colombiano' },
  MXN: { locale: 'es-MX', symbol: '$', decimals: 0, name: 'Peso mexicano' },
  USD: { locale: 'en-US', symbol: '$', decimals: 2, name: 'Dólar' },
  PEN: { locale: 'es-PE', symbol: 'S/', decimals: 2, name: 'Sol peruano' },
  CLP: { locale: 'es-CL', symbol: '$', decimals: 0, name: 'Peso chileno' },
  ARS: { locale: 'es-AR', symbol: '$', decimals: 0, name: 'Peso argentino' },
  NIO: { locale: 'es-NI', symbol: 'C$', decimals: 2, name: 'Córdoba' },
  VES: { locale: 'es-VE', symbol: 'Bs.', decimals: 2, name: 'Bolívar' },
}

export const COUNTRY_CURRENCY = {
  CO: 'COP', MX: 'MXN', US: 'USD', EC: 'USD', PA: 'USD',
  PE: 'PEN', CL: 'CLP', AR: 'ARS', NI: 'NIO', VE: 'VES',
}

export const COUNTRIES = [
  { code: 'CO', name: 'Colombia', flag: '\u{1F1E8}\u{1F1F4}' },
  { code: 'MX', name: 'México', flag: '\u{1F1F2}\u{1F1FD}' },
  { code: 'US', name: 'Estados Unidos', flag: '\u{1F1FA}\u{1F1F8}' },
  { code: 'EC', name: 'Ecuador', flag: '\u{1F1EA}\u{1F1E8}' },
  { code: 'PA', name: 'Panamá', flag: '\u{1F1F5}\u{1F1E6}' },
  { code: 'PE', name: 'Perú', flag: '\u{1F1F5}\u{1F1EA}' },
  { code: 'CL', name: 'Chile', flag: '\u{1F1E8}\u{1F1F1}' },
  { code: 'AR', name: 'Argentina', flag: '\u{1F1E6}\u{1F1F7}' },
  { code: 'NI', name: 'Nicaragua', flag: '\u{1F1F3}\u{1F1EE}' },
  { code: 'VE', name: 'Venezuela', flag: '\u{1F1FB}\u{1F1EA}' },
]

export const COUNTRY_TIMEZONE = {
  CO: 'America/Bogota', MX: 'America/Mexico_City', US: 'America/New_York',
  EC: 'America/Guayaquil', PA: 'America/Panama', PE: 'America/Lima',
  CL: 'America/Santiago', AR: 'America/Argentina/Buenos_Aires',
  NI: 'America/Managua', VE: 'America/Caracas',
}

export const COUNTRY_PHONE_CODE = {
  CO: '57', MX: '52', US: '1', EC: '593', PA: '507',
  PE: '51', CL: '56', AR: '54', NI: '505', VE: '58',
}

export function getPhoneCode(countryCode) {
  return COUNTRY_PHONE_CODE[countryCode] || '57'
}

export function getTimezone(countryCode) {
  return COUNTRY_TIMEZONE[countryCode] || 'America/Bogota'
}

export function getCurrencyConfig(code) {
  return CURRENCY_CONFIG[code] || CURRENCY_CONFIG.COP
}

export function getFormatter(code) {
  const cfg = getCurrencyConfig(code)
  return (n) => {
    const formatted = Number(n).toLocaleString(cfg.locale, {
      minimumFractionDigits: cfg.decimals,
      maximumFractionDigits: cfg.decimals,
    })
    return `${cfg.symbol}${formatted}`
  }
}
