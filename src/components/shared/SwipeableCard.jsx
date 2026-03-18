import { useRef, useEffect, useCallback } from 'react'
import { Trash2, CheckSquare, MessageCircle } from 'lucide-react'

const LEFT_WIDTH = 75   // delete button
const RIGHT_WIDTH = 150 // select + whatsapp
const EASE_OPEN = 'transform 0.3s cubic-bezier(0.22, 0.61, 0.36, 1)'
const EASE_CLOSE = 'transform 0.25s cubic-bezier(0.22, 0.61, 0.36, 1)'

export default function SwipeableCard({
  children,
  id,
  isMobile,
  onDelete,
  onSelect,
  onWhatsApp,
  selectionMode,
  isExpanded,
  openSwipeId,
  onSwipeOpen,
}) {
  const contentRef = useRef(null)
  const stateRef = useRef({
    startX: 0,
    startY: 0,
    decided: false,
    currentX: 0,
  })
  const genRef = useRef(0)
  const isOpen = openSwipeId === id
  const openSide = useRef(null) // 'left' | 'right' | null

  const clearTransformSafe = useCallback((el, gen) => {
    const cleanup = () => {
      if (genRef.current !== gen) return
      el.style.transform = ''
      el.style.transition = ''
    }
    el.addEventListener('transitionend', cleanup, { once: true })
  }, [])

  const animateTo = useCallback((targetX) => {
    const s = stateRef.current
    s.currentX = targetX
    const gen = ++genRef.current
    if (!contentRef.current) return

    contentRef.current.style.transition = targetX === 0 ? EASE_CLOSE : EASE_OPEN
    contentRef.current.style.transform = `translateX(${targetX}px)`

    if (targetX === 0) {
      openSide.current = null
      onSwipeOpen(null)
      clearTransformSafe(contentRef.current, gen)
    } else {
      openSide.current = targetX > 0 ? 'left' : 'right'
      onSwipeOpen(id)
      if (navigator.vibrate) navigator.vibrate(10)
    }
  }, [id, onSwipeOpen, clearTransformSafe])

  // Close when another card opens
  useEffect(() => {
    if (!isOpen && contentRef.current && stateRef.current.currentX !== 0) {
      stateRef.current.currentX = 0
      const gen = ++genRef.current
      contentRef.current.style.transition = EASE_CLOSE
      contentRef.current.style.transform = 'translateX(0)'
      clearTransformSafe(contentRef.current, gen)
      openSide.current = null
    }
  }, [isOpen, clearTransformSafe])

  const handleTouchStart = useCallback((e) => {
    if (selectionMode || isExpanded) return
    const touch = e.touches[0]
    const s = stateRef.current
    genRef.current++
    s.startX = touch.clientX
    s.startY = touch.clientY
    s.decided = false
  }, [selectionMode, isExpanded])

  const handleTouchMove = useCallback((e) => {
    if (selectionMode || isExpanded) return
    const s = stateRef.current
    if (s.decided) return // Already triggered animation

    const touch = e.touches[0]
    const deltaX = touch.clientX - s.startX
    const deltaY = touch.clientY - s.startY

    // Wait for enough movement to decide direction
    if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return

    // Vertical scroll — ignore
    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      s.decided = true
      return
    }

    // Horizontal swipe detected
    s.decided = true
    e.preventDefault()

    if (s.currentX === 0) {
      // Card is closed → open in swipe direction
      if (deltaX > 0) {
        animateTo(LEFT_WIDTH)  // swipe right → show delete
      } else {
        animateTo(-RIGHT_WIDTH) // swipe left → show select/whatsapp
      }
    } else {
      // Card is open → close it
      animateTo(0)
    }
  }, [selectionMode, isExpanded, animateTo])

  const closeSwipe = useCallback(() => {
    animateTo(0)
  }, [animateTo])

  // Tap card when open → close
  const handleContentClick = useCallback((e) => {
    if (isOpen) {
      e.preventDefault()
      e.stopPropagation()
      closeSwipe()
    }
  }, [isOpen, closeSwipe])

  if (!isMobile) return children

  return (
    <div className={`swipeable-card-container${isExpanded ? ' swipe-expanded' : ''}`}>
      <div className="swipeable-card-actions-left">
        <button className="swipe-action-btn swipe-action-delete" onClick={() => { closeSwipe(); onDelete() }}>
          <Trash2 size={22} />
          <span>Eliminar</span>
        </button>
      </div>
      <div className="swipeable-card-actions-right">
        <button className="swipe-action-btn swipe-action-select" onClick={() => { closeSwipe(); onSelect() }}>
          <CheckSquare size={22} />
          <span>Seleccionar</span>
        </button>
        <button className="swipe-action-btn swipe-action-whatsapp" onClick={() => { closeSwipe(); onWhatsApp() }}>
          <MessageCircle size={22} />
          <span>WhatsApp</span>
        </button>
      </div>
      <div
        ref={contentRef}
        className={`swipeable-card-content${isOpen ? ' swipe-open' : ''}`}
        onClickCapture={handleContentClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
      >
        {children}
      </div>
    </div>
  )
}
