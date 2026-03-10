import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Play, Volume2, VolumeX, Minimize2, RotateCcw } from 'lucide-react'

export default function VideoWidget() {
  // 'mini' | 'collapsed' | 'expanded'
  const [mode, setMode] = useState('mini')
  const [muted, setMuted] = useState(true)
  const videoMiniRef = useRef(null)
  const videoExpandedRef = useRef(null)
  const pendingTimeRef = useRef(null)

  // Issue 3 fix: Sync video AFTER React commits the DOM via useEffect
  useEffect(() => {
    if (pendingTimeRef.current === null) return
    const time = pendingTimeRef.current
    pendingTimeRef.current = null

    const video = mode === 'expanded' ? videoExpandedRef.current : videoMiniRef.current
    if (video) {
      video.currentTime = time
      video.play().catch(() => {})
    }
  }, [mode])

  const switchToExpanded = useCallback(() => {
    const miniV = videoMiniRef.current
    pendingTimeRef.current = miniV ? miniV.currentTime : 0
    setMode('expanded')
  }, [])

  const switchToMini = useCallback(() => {
    const expV = videoExpandedRef.current
    pendingTimeRef.current = expV ? expV.currentTime : 0
    setMode('mini')
  }, [])

  const handleRestart = useCallback(() => {
    const expV = videoExpandedRef.current
    if (expV) {
      expV.currentTime = 0
      expV.play().catch(() => {})
    }
  }, [])

  const handleClose = useCallback((e) => {
    e.stopPropagation()
    const miniV = videoMiniRef.current
    if (miniV) miniV.pause()
    setMode('collapsed')
  }, [])

  // Autoplay mini video muted on mount
  useEffect(() => {
    const v = videoMiniRef.current
    if (v && mode === 'mini') {
      v.muted = true
      v.play().catch(() => {})
    }
  }, [])

  // Sync muted state to both videos
  useEffect(() => {
    if (videoMiniRef.current) videoMiniRef.current.muted = muted
    if (videoExpandedRef.current) videoExpandedRef.current.muted = muted
  }, [muted])

  // Lock body scroll when expanded + close on Escape
  useEffect(() => {
    if (mode === 'expanded') {
      document.body.style.overflow = 'hidden'
      const handleKey = (e) => { if (e.key === 'Escape') switchToMini() }
      document.addEventListener('keydown', handleKey)
      return () => {
        document.body.style.overflow = ''
        document.removeEventListener('keydown', handleKey)
      }
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mode, switchToMini])

  const handleMuteClick = useCallback((e) => {
    e.stopPropagation()
    setMuted(m => !m)
  }, [])

  return (
    <>
      {/* --- Mini Player (bottom-right) --- */}
      {mode === 'mini' && (
        <div className="vw-mini" onClick={switchToExpanded} role="button" tabIndex={0} aria-label="Expandir video">
          <video
            ref={videoMiniRef}
            src="/img/video1.mp4"
            muted
            autoPlay
            playsInline
            loop
            preload="metadata"
            className="vw-mini-video"
          />
          <button className="vw-mini-close" onClick={handleClose} aria-label="Cerrar video">
            <X size={11} strokeWidth={2.5} />
          </button>
          <button className="vw-mini-mute" onClick={handleMuteClick} aria-label={muted ? 'Activar sonido' : 'Silenciar'}>
            {muted ? <VolumeX size={11} /> : <Volume2 size={11} />}
          </button>
        </div>
      )}

      {/* --- Collapsed Button --- */}
      {mode === 'collapsed' && (
        <button className="vw-collapsed" onClick={switchToExpanded}>
          <Play size={16} fill="currentColor" />
          <span>Ver Video</span>
        </button>
      )}

      {/* --- Expanded Overlay --- */}
      {mode === 'expanded' && (
        <div className="vw-overlay" onClick={switchToMini}>
          <div className="vw-expanded" onClick={e => e.stopPropagation()}>
            <video
              ref={videoExpandedRef}
              src="/img/video1.mp4"
              muted={muted}
              autoPlay
              playsInline
              loop
              preload="metadata"
              className="vw-expanded-video"
            />
            <button className="vw-expanded-minimize" onClick={switchToMini} aria-label="Minimizar">
              <Minimize2 size={18} />
            </button>
            <button className="vw-expanded-mute" onClick={handleMuteClick} aria-label={muted ? 'Activar sonido' : 'Silenciar'}>
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <button className="vw-expanded-restart" onClick={handleRestart}>
              <RotateCcw size={14} />
              <span>Reiniciar</span>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
