import { useState, useEffect } from 'react'

function formatSeg(totalSeg) {
  const seg = Math.max(0, Math.floor(totalSeg))
  const h = Math.floor(seg / 3600)
  const m = Math.floor((seg % 3600) / 60)
  const s = seg % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

/**
 * Self-contained timer component.
 * - If `duration` is provided (not null), displays a static formatted duration.
 * - If `startTime` is provided (and duration is null), runs a live countdown.
 * - Otherwise displays "0s".
 */
export default function Timer({ duration, startTime }) {
  const [display, setDisplay] = useState(() => {
    if (duration != null) return formatSeg(duration)
    if (startTime) return formatSeg((Date.now() - new Date(startTime).getTime()) / 1000)
    return '0s'
  })

  useEffect(() => {
    // Static duration — no interval needed
    if (duration != null) {
      setDisplay(formatSeg(duration))
      return
    }

    // No start time — static "0s"
    if (!startTime) {
      setDisplay('0s')
      return
    }

    // Live timer
    const start = new Date(startTime).getTime()
    const update = () => setDisplay(formatSeg((Date.now() - start) / 1000))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [duration, startTime])

  return display
}
