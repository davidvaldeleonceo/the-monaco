import { getCurrencyConfig } from '../config/currencies'

let _currencyCode = 'COP'
let _formatter = null

export function setCurrency(code) {
  _currencyCode = code
  _formatter = null
}

export function getCurrency() {
  return _currencyCode
}

export function getCurrencySymbol() {
  return getCurrencyConfig(_currencyCode).symbol
}

function getFormatter() {
  if (!_formatter) {
    const cfg = getCurrencyConfig(_currencyCode)
    _formatter = new Intl.NumberFormat(cfg.locale, {
      style: 'currency',
      currency: _currencyCode,
      minimumFractionDigits: cfg.decimals,
      maximumFractionDigits: cfg.decimals,
    })
  }
  return _formatter
}

export function formatMoney(value) {
  return getFormatter().format(value)
}

export function formatMoneyShort(value) {
  const { symbol } = getCurrencyConfig(_currencyCode)
  if (value >= 1000000) return `${symbol}${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `${symbol}${(value / 1000).toFixed(0)}K`
  return `${symbol}${value}`
}

export function formatPriceLocale(val) {
  if (!val) return ''
  const cfg = getCurrencyConfig(_currencyCode)
  return Number(val).toLocaleString(cfg.locale, {
    minimumFractionDigits: cfg.decimals,
    maximumFractionDigits: cfg.decimals,
  })
}

export function parsePriceLocale(str) {
  const cfg = getCurrencyConfig(_currencyCode)
  if (cfg.decimals > 0) {
    const raw = str.replace(/[^\d.]/g, '')
    return raw === '' ? 0 : parseFloat(raw)
  }
  const raw = str.replace(/[^\d]/g, '')
  return raw === '' ? 0 : parseInt(raw, 10)
}
