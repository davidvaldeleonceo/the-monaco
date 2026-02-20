import { createContext, useContext, useState, useCallback } from 'react'
import { formatMoney, formatMoneyShort } from '../utils/money'

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

  const displayMoney = useCallback((val) => {
    return showMoney ? formatMoney(val) : '\u2022\u2022\u2022'
  }, [showMoney])

  const displayMoneyShort = useCallback((val) => {
    return showMoney ? formatMoneyShort(val) : '\u2022\u2022\u2022'
  }, [showMoney])

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
