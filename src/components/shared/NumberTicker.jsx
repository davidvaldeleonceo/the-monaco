import { useState, useEffect, useRef, useMemo } from 'react'
import { getCurrency } from '../../utils/money'
import { getCurrencyConfig } from '../../config/currencies'

const STAGGER = 40
const DEBOUNCE = 350

function formatCurrencyValue(value) {
  const abs = Math.abs(value)
  const cfg = getCurrencyConfig(getCurrency())
  const formatted = new Intl.NumberFormat(cfg.locale, {
    minimumFractionDigits: cfg.decimals,
    maximumFractionDigits: cfg.decimals,
    useGrouping: true,
  }).format(abs)
  return { isNegative: value < 0, formatted }
}

function MaskedDots({ count }) {
  return (
    <span className="nt-masked">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="nt-dot">{'\u2022'}</span>
      ))}
    </span>
  )
}

export default function NumberTicker({ value, masked = false, prefix, className = '' }) {
  const currencyCode = getCurrency()
  const displayPrefix = prefix !== undefined ? prefix : currencyCode
  const { isNegative, formatted } = useMemo(() => formatCurrencyValue(value), [value])
  const digitCount = formatted.replace(/\D/g, '').length

  // Visual states: display text, sign, and animation phase
  const [display, setDisplay] = useState(formatted)
  const [displayNeg, setDisplayNeg] = useState(isNegative) // only updates after enter completes
  const [phase, setPhase] = useState('idle') // 'idle' | 'exit' | 'enter'
  const targetRef = useRef(formatted)
  const targetNegRef = useRef(isNegative)
  const timers = useRef([])

  targetRef.current = formatted
  targetNegRef.current = isNegative

  const clearTimers = () => {
    timers.current.forEach(t => clearTimeout(t))
    timers.current = []
  }

  useEffect(() => {
    if (display === formatted && phase === 'idle') return

    clearTimers()

    // Debounce: wait for all calculations to finish
    timers.current.push(setTimeout(() => {
      const next = targetRef.current
      if (next === display) return

      // 0. Sign icon changes FIRST, before any number animation
      setDisplayNeg(targetNegRef.current)

      // 1. Exit: old number cascades out (left to right, down + blur)
      setPhase('exit')

      // 2. Short gap after last char starts exiting, then swap + enter
      // Exit animation per char is 200ms, stagger is 40ms
      // We start enter when ~60% of exit cascade is done
      const exitCascadeTime = display.length * STAGGER
      const swapDelay = exitCascadeTime * 0.6 + 180
      timers.current.push(setTimeout(() => {
        setDisplay(targetRef.current)
        setPhase('enter')
      }, swapDelay))

      // 3. After enter completes, update sign/color + idle
      const enterCascadeTime = targetRef.current.length * STAGGER + 350
      timers.current.push(setTimeout(() => {
        setDisplay(targetRef.current)
        setPhase('idle')
      }, swapDelay + enterCascadeTime))
    }, DEBOUNCE))

    return clearTimers
  }, [value, formatted])

  const chars = display.split('')

  return (
    <span className={`nt-root ${className} ${displayNeg ? 'nt-negative' : 'nt-positive'}`} role="text">
      <img className="nt-sign-icon" src={displayNeg ? '/img/negativo.png' : '/img/positivo.png'} alt={displayNeg ? '-' : '+'} />
      {masked ? (
        <MaskedDots count={Math.max(digitCount, 3)} />
      ) : (
        <span className="nt-number">
          {chars.map((ch, i) => (
            <span
              key={i}
              className={`nt-char ${phase === 'exit' ? 'nt-char-exit' : ''} ${phase === 'enter' ? 'nt-char-enter' : ''}`}
              style={phase !== 'idle' ? { animationDelay: `${i * STAGGER}ms` } : undefined}
            >
              {ch}
            </span>
          ))}
        </span>
      )}
      <span className="nt-suffix">{displayPrefix}</span>
    </span>
  )
}
