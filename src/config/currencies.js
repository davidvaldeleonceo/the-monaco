export const CURRENCY_CONFIG = {
  COP: { locale: 'es-CO', symbol: '$', decimals: 0, name: 'Peso colombiano' },
  MXN: { locale: 'es-MX', symbol: '$', decimals: 0, name: 'Peso mexicano' },
  USD: { locale: 'en-US', symbol: '$', decimals: 2, name: 'Dólar' },
  PEN: { locale: 'es-PE', symbol: 'S/', decimals: 2, name: 'Sol peruano' },
  CLP: { locale: 'es-CL', symbol: '$', decimals: 0, name: 'Peso chileno' },
  ARS: { locale: 'es-AR', symbol: '$', decimals: 0, name: 'Peso argentino' },
  NIO: { locale: 'es-NI', symbol: 'C$', decimals: 2, name: 'Córdoba' },
}

export const COUNTRY_CURRENCY = {
  CO: 'COP', MX: 'MXN', US: 'USD', EC: 'USD', PA: 'USD',
  PE: 'PEN', CL: 'CLP', AR: 'ARS', NI: 'NIO',
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
]

export function getCurrencyConfig(code) {
  return CURRENCY_CONFIG[code] || CURRENCY_CONFIG.COP
}

export const MEMBERSHIP_DEFAULTS = {
  COP: 50000,
  MXN: 500,
  USD: 30,
  PEN: 100,
  CLP: 25000,
  ARS: 15000,
  NIO: 500,
}
