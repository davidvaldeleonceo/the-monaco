import { createContext, useContext, useState, useCallback } from 'react'
import { formatMoney, formatMoneyShort, getCurrency } from '../../utils/money'

const MoneyVisibilityContext = createContext()

export function MoneyVisibilityProvider({ children }) {
  const [showMoney, setShowMoney] = useState(() => {
    const saved = localStorage.getItem('showMoney')
    return saved === null ? true : saved === 'true'
  })

  const toggleMoney = useCallback(() => {
    setShowMoney(prev => {
      const next = !prev
      localStorage.setItem('showMoney', String(next))
      return next
    })
  }, [])

  const maskValue = (formatted) => {
    // Keep $ sign, replace digits with dots, remove thousand separators
    return formatted.replace(/[\d.,]/g, (ch) => /\d/.test(ch) ? '\u2022' : '')
  }

  const currency = getCurrency()

  const displayMoney = useCallback((val) => {
    if (showMoney) return formatMoney(val)
    return maskValue(formatMoney(val))
  }, [showMoney, currency])

  const displayMoneyShort = useCallback((val) => {
    if (showMoney) return formatMoneyShort(val)
    return maskValue(formatMoneyShort(val))
  }, [showMoney, currency])

  return (
    <MoneyVisibilityContext.Provider value={{ showMoney, toggleMoney, displayMoney, displayMoneyShort }}>
      {children}
    </MoneyVisibilityContext.Provider>
  )
}

export function useMoneyVisibility() {
  const context = useContext(MoneyVisibilityContext)
  if (!context) {
    throw new Error('useMoneyVisibility must be used within a MoneyVisibilityProvider')
  }
  return context
}
