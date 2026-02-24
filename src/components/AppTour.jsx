import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTenant } from './TenantContext'
import { tourSteps } from '../config/tourSteps'

const TourContext = createContext()

export function useTour() {
  return useContext(TourContext)
}

function isVisible(el) {
  if (!el) return false
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return false
  const style = window.getComputedStyle(el)
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false
  // Check ancestors
  let parent = el.parentElement
  while (parent) {
    const ps = window.getComputedStyle(parent)
    if (ps.display === 'none' || ps.visibility === 'hidden') return false
    parent = parent.parentElement
  }
  return true
}

function findElement(selector) {
  const selectors = selector.split(', ')
  for (const s of selectors) {
    const el = document.querySelector(s)
    if (el && isVisible(el)) return el
  }
  return null
}

function TourOverlay({ currentStep, stepIndex, totalSteps, onNext, onSkip }) {
  const [rect, setRect] = useState(null)
  const [tooltipStyle, setTooltipStyle] = useState({})
  const [arrowClass, setArrowClass] = useState('')
  const [arrowStyle, setArrowStyle] = useState({})
  const tooltipRef = useRef(null)

  const updatePosition = useCallback(() => {
    const el = findElement(currentStep.selector)
    if (!el) return

    const r = el.getBoundingClientRect()
    setRect(r)

    // Wait for tooltip to render to get its dimensions
    requestAnimationFrame(() => {
      const tooltip = tooltipRef.current
      if (!tooltip) return

      const tooltipRect = tooltip.getBoundingClientRect()
      const pad = 12
      const vw = window.innerWidth
      const vh = window.innerHeight

      let top, left
      let position = currentStep.position

      // Auto-flip vertical
      if (position === 'bottom' && r.bottom + pad + tooltipRect.height > vh) {
        position = 'top'
      } else if (position === 'top' && r.top - pad - tooltipRect.height < 0) {
        position = 'bottom'
      }

      if (position === 'bottom') {
        top = r.bottom + pad
        left = r.left + r.width / 2 - tooltipRect.width / 2
        setArrowClass('tour-tooltip-arrow--top')
      } else if (position === 'top') {
        top = r.top - pad - tooltipRect.height
        left = r.left + r.width / 2 - tooltipRect.width / 2
        setArrowClass('tour-tooltip-arrow--bottom')
      } else if (position === 'right') {
        top = r.top + r.height / 2 - tooltipRect.height / 2
        left = r.right + pad
        setArrowClass('tour-tooltip-arrow--left')
      } else {
        top = r.top + r.height / 2 - tooltipRect.height / 2
        left = r.left - pad - tooltipRect.width
        setArrowClass('tour-tooltip-arrow--right')
      }

      // Clamp to viewport
      const clampedLeft = Math.max(8, Math.min(left, vw - tooltipRect.width - 8))
      const clampedTop = Math.max(8, Math.min(top, vh - tooltipRect.height - 8))

      // Calculate dynamic arrow offset so it points at the target center
      const targetCenterX = r.left + r.width / 2
      const targetCenterY = r.top + r.height / 2

      if (position === 'top' || position === 'bottom') {
        const arrowLeft = Math.max(20, Math.min(targetCenterX - clampedLeft, tooltipRect.width - 20))
        setArrowStyle({ left: `${arrowLeft}px`, marginLeft: '-7px' })
      } else {
        const arrowTop = Math.max(20, Math.min(targetCenterY - clampedTop, tooltipRect.height - 20))
        setArrowStyle({ top: `${arrowTop}px`, marginTop: '-7px' })
      }

      setTooltipStyle({ top: `${clampedTop}px`, left: `${clampedLeft}px` })
    })
  }, [currentStep])

  useEffect(() => {
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [updatePosition])

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onSkip()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onSkip])

  // Scroll target into view (skip for fixed/sticky elements like bottom bar)
  useEffect(() => {
    const el = findElement(currentStep.selector)
    if (el) {
      const style = window.getComputedStyle(el)
      const parentStyle = el.parentElement ? window.getComputedStyle(el.parentElement) : null
      const isFixed = style.position === 'fixed' || style.position === 'sticky'
        || parentStyle?.position === 'fixed' || parentStyle?.position === 'sticky'
      if (!isFixed) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [currentStep])

  const isLast = stepIndex === totalSteps - 1

  return createPortal(
    <div className="tour-overlay">
      {/* Spotlight */}
      {rect && (
        <div
          className="tour-spotlight"
          style={{
            top: `${rect.top - 6}px`,
            left: `${rect.left - 6}px`,
            width: `${rect.width + 12}px`,
            height: `${rect.height + 12}px`,
          }}
        />
      )}

      {/* Tooltip */}
      <div className="tour-tooltip" ref={tooltipRef} style={tooltipStyle}>
        <div className={`tour-tooltip-arrow ${arrowClass}`} style={arrowStyle} />
        <span className="tour-step-counter">Paso {stepIndex + 1} de {totalSteps}</span>
        <h3 className="tour-tooltip-title">{currentStep.title}</h3>
        <p className="tour-tooltip-desc">{currentStep.description}</p>
        <div className="tour-tooltip-actions">
          <button className="tour-btn-skip" onClick={onSkip}>
            Omitir tutorial
          </button>
          <button className="tour-btn-next" onClick={onNext}>
            {isLast ? 'Finalizar' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export function TourProvider({ children }) {
  const [active, setActive] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [ready, setReady] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { justCompletedSetup, clearJustCompletedSetup } = useTenant()
  const pollingRef = useRef(null)

  const currentStep = tourSteps[stepIndex]

  const endTour = useCallback((goHome = true) => {
    setActive(false)
    setStepIndex(0)
    setReady(false)
    localStorage.setItem('monaco_tour_completed', 'true')
    if (pollingRef.current) clearInterval(pollingRef.current)
    if (goHome && location.pathname !== '/home') {
      navigate('/home')
    }
  }, [navigate, location.pathname])

  const waitForElement = useCallback((selector, maxWait = 2000) => {
    return new Promise((resolve) => {
      const el = findElement(selector)
      if (el) { resolve(true); return }

      const start = Date.now()
      pollingRef.current = setInterval(() => {
        const found = findElement(selector)
        if (found || Date.now() - start > maxWait) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
          resolve(!!found)
        }
      }, 100)
    })
  }, [])

  const goToStep = useCallback(async (index) => {
    if (index >= tourSteps.length) {
      endTour(true)
      return
    }

    const step = tourSteps[index]
    setReady(false)

    // Navigate if needed
    if (location.pathname !== step.page) {
      navigate(step.page)
    }

    const found = await waitForElement(step.selector)
    if (found) {
      setStepIndex(index)
      setReady(true)
    } else {
      // Skip this step if element not found
      goToStep(index + 1)
    }
  }, [location.pathname, navigate, waitForElement, endTour])

  const handleNext = useCallback(() => {
    goToStep(stepIndex + 1)
  }, [goToStep, stepIndex])

  const handleSkip = useCallback(() => {
    endTour(true)
  }, [endTour])

  const startTour = useCallback(() => {
    setActive(true)
    setStepIndex(0)
    if (location.pathname !== '/home') {
      navigate('/home')
    }
    // Small delay so Home can render
    setTimeout(() => {
      goToStep(0)
    }, 600)
  }, [navigate, location.pathname, goToStep])

  // Auto-start after SetupWizard
  useEffect(() => {
    if (justCompletedSetup && !localStorage.getItem('monaco_tour_completed')) {
      clearJustCompletedSetup()
      setTimeout(() => {
        startTour()
      }, 800)
    }
  }, [justCompletedSetup])

  // When location changes during tour, re-check element
  useEffect(() => {
    if (active && currentStep && location.pathname === currentStep.page) {
      waitForElement(currentStep.selector).then((found) => {
        if (found) setReady(true)
      })
    }
  }, [location.pathname, active, currentStep])

  const value = { startTour, isActive: active }

  return (
    <TourContext.Provider value={value}>
      {children}
      {active && ready && currentStep && (
        <TourOverlay
          currentStep={currentStep}
          stepIndex={stepIndex}
          totalSteps={tourSteps.length}
          onNext={handleNext}
          onSkip={handleSkip}
        />
      )}
    </TourContext.Provider>
  )
}
