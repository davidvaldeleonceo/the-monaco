import { useState, useRef, useEffect, useCallback } from 'react'
import { Mic, X, Send, Check, ArrowLeft, User, Bot, ThumbsUp, ThumbsDown, ChevronRight, Sparkles } from 'lucide-react'
import { useTenant } from '../context/TenantContext'
import { useData } from '../context/DataContext'
import UpgradeModal from '../payment/UpgradeModal'
import { API_URL, TOKEN_KEY } from '../../config/constants'

function formatMarkdown(text) {
  const parts = text.split(/(\*\*.*?\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return part.includes('\n')
      ? part.split('\n').map((line, j) => (
          <span key={`${i}-${j}`}>{j > 0 && <br />}{line}</span>
        ))
      : part
  })
}

export default function AiChat({ panelOpen, onTogglePanel }) {
  const { isPro, negocioNombre } = useTenant()
  const { refreshLavadas, refreshClientes } = useData()
  const [viewMode, setViewMode] = useState('closed') // 'closed' | 'listening' | 'chat'
  const [panelClosing, setPanelClosing] = useState(false)
  const panelVisible = panelOpen || panelClosing
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hola, soy tu agente de AI. Dime que quieres saber hoy?' }
  ])
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const [textInput, setTextInput] = useState('')
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [listenError, setListenError] = useState(false)
  const [feedback, setFeedback] = useState({})

  const handleFeedback = (index, type) => {
    const wasActive = feedback[index] === type
    setFeedback(prev => ({ ...prev, [index]: prev[index] === type ? null : type }))
    if (type === 'like' && !wasActive) spawnConfetti(index)
  }

  const spawnConfetti = (index) => {
    const btn = document.querySelector(`[data-like-idx="${index}"]`)
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const colors = ['#0A2F7E', '#0050B8', '#2B6DD4', '#5B95EE', '#003D99', '#1A5BBF']
    for (let i = 0; i < 12; i++) {
      const dot = document.createElement('span')
      dot.className = 'like-confetti-particle'
      dot.style.left = `${rect.left + rect.width / 2}px`
      dot.style.top = `${rect.top + rect.height / 2}px`
      dot.style.background = colors[Math.floor(Math.random() * colors.length)]
      dot.style.setProperty('--angle', `${Math.random() * 360}deg`)
      dot.style.setProperty('--distance', `${30 + Math.random() * 40}px`)
      dot.style.setProperty('--size', `${3 + Math.random() * 4}px`)
      document.body.appendChild(dot)
      dot.addEventListener('animationend', () => dot.remove())
    }
  }

  // Recording states
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const streamRef = useRef(null)
  const messagesEndRef = useRef(null)

  const scrollToBottom = useCallback(() => {
    const container = messagesEndRef.current?.parentElement
    if (container) container.scrollTop = container.scrollHeight
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    }
  }, [])

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || loading) return

    setMessages(prev => [...prev, { role: 'user', content: text }])
    setLoading(true)

    try {
      const token = localStorage.getItem(TOKEN_KEY)
      const res = await fetch(`${API_URL}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: text, sessionId }),
      })

      const data = await res.json()

      if (res.ok) {
        setSessionId(data.sessionId)
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
        if (data.lavadaCreated) {
          refreshLavadas()
          refreshClientes()
        }
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.error || 'Error al procesar tu mensaje.' }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error de conexion. Intenta de nuevo.' }])
    } finally {
      setLoading(false)
    }
  }, [loading, sessionId, refreshLavadas, refreshClientes])

  // --- Start recording audio ---
  const startRecording = useCallback(async () => {
    console.log('[Voice] Starting audio recording')
    setListenError(false)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : undefined
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.start(100)
      mediaRecorderRef.current = recorder
      setIsRecording(true)
      setRecordingDuration(0)

      const start = Date.now()
      timerRef.current = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - start) / 1000))
      }, 500)
    } catch (err) {
      console.error('[Voice] Mic access error:', err)
      setListenError(true)
    }
  }, [])

  // --- Stop recording and transcribe via Whisper ---
  const stopRecordingAndSend = useCallback(async () => {
    console.log('[Voice] Stopping recording, sending to Whisper')
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') {
      setIsRecording(false)
      return
    }

    const recorderMime = recorder.mimeType || 'audio/webm'

    setIsRecording(false)
    setIsTranscribing(true)
    setViewMode('chat')

    await new Promise(resolve => {
      recorder.onstop = resolve
      recorder.stop()
    })

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    mediaRecorderRef.current = null

    if (chunksRef.current.length === 0) {
      setIsTranscribing(false)
      return
    }

    const ext = recorderMime.includes('mp4') ? 'mp4' : 'webm'
    const blob = new Blob(chunksRef.current, { type: recorderMime })
    chunksRef.current = []

    try {
      const token = localStorage.getItem(TOKEN_KEY)
      const formData = new FormData()
      formData.append('audio', blob, `recording.${ext}`)

      const res = await fetch(`${API_URL}/api/ai/transcribe`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      const data = await res.json()
      console.log('[Voice] Transcription result:', data.text)
      if (res.ok && data.text) {
        sendMessage(data.text)
      } else if (res.ok && !data.text) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'En que te puedo ayudar hoy 😊' }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error al transcribir el audio.' }])
    } finally {
      setIsTranscribing(false)
    }
  }, [sendMessage])

  // --- Cancel recording (X button) ---
  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    mediaRecorderRef.current = null
    setIsRecording(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setViewMode('closed')
  }, [])

  // When switching from listening to chat on mobile after voice send
  useEffect(() => {
    if (viewMode === 'chat' && isDesktop()) {
      // On desktop, voice recording goes to panel instead
      if (!panelOpen) onTogglePanel?.()
      setViewMode('closed')
    }
  }, [viewMode])

  const isDesktop = () => window.innerWidth >= 1180

  const handleOpen = () => {
    if (!isPro) {
      setShowUpgrade(true)
      return
    }
    if (isDesktop()) {
      onTogglePanel?.()
    } else {
      setViewMode('listening')
    }
  }

  // Start recording when entering listening mode
  useEffect(() => {
    if (viewMode === 'listening' && !isRecording && !mediaRecorderRef.current && !listenError) {
      startRecording()
    }
  }, [viewMode, isRecording, startRecording, listenError])

  const handleClose = () => {
    if (isRecording) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      mediaRecorderRef.current = null
      setIsRecording(false)
    }
    if (isDesktop()) {
      onTogglePanel?.()
    } else {
      setViewMode('closed')
    }
  }

  const handleTextSubmit = (e) => {
    e.preventDefault()
    if (!textInput.trim()) return
    sendMessage(textInput.trim())
    setTextInput('')
  }

  // --- Toggle mic from within chat view ---
  const toggleMic = useCallback(() => {
    if (isRecording) {
      stopRecordingAndSend()
    } else if (!isTranscribing && !loading) {
      startRecording()
    }
  }, [isRecording, isTranscribing, loading, stopRecordingAndSend, startRecording])

  const getPlaceholder = () => {
    if (isRecording) return `Grabando... ${recordingDuration}s`
    if (isTranscribing) return 'Procesando audio...'
    return 'Escribe tu mensaje...'
  }

  const chatContent = (
    <>
      <div className="ai-chat-header">
        <button className="ai-chat-back" onClick={handleClose}><ArrowLeft size={22} /></button>
        <span className="ai-chat-title">AI {negocioNombre}</span>
        <button className="ai-chat-clear" onClick={() => { setMessages([{ role: 'assistant', content: 'Hola, soy tu agente de AI. Dime que quieres saber hoy?' }]); setSessionId(null); setFeedback({}) }}>
          Limpiar chat
        </button>
      </div>

      <div className="ai-chat-messages">
        {messages.length === 0 && !loading && (
          <div className="ai-chat-empty">
            <span>En que te puedo ayudar hoy 😊</span>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`ai-msg-row ai-msg-row-${msg.role}`}>
            <div className={`ai-avatar ai-avatar-${msg.role}`}>
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div className="ai-msg-bubble-wrapper">
              <div className={`ai-msg ai-msg-${msg.role}`}>
                {msg.role === 'assistant' ? formatMarkdown(msg.content) : msg.content}
              </div>
              {msg.role === 'assistant' && (
                <div className="ai-msg-actions">
                  <button data-like-idx={i} className={`ai-msg-action ${feedback[i] === 'like' ? 'active' : ''}`} onClick={() => handleFeedback(i, 'like')}><ThumbsUp size={14} /></button>
                  <button className={`ai-msg-action ${feedback[i] === 'dislike' ? 'active' : ''}`} onClick={() => handleFeedback(i, 'dislike')}><ThumbsDown size={14} /></button>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="ai-thinking-pill">
            <span className="ai-thinking-dot" />
            <span className="ai-thinking-dot" />
            <span className="ai-thinking-dot" />
            Pensando...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="ai-input-area">
        <form className="ai-input-form" onSubmit={handleTextSubmit}>
          <input
            type="text"
            className="ai-text-input"
            placeholder={getPlaceholder()}
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            disabled={isRecording || isTranscribing}
            autoFocus
          />
          <button
            type="button"
            className={`ai-mic-btn ${isRecording ? 'recording' : ''} ${isTranscribing ? 'transcribing' : ''}`}
            onClick={() => toggleMic()}
            disabled={isTranscribing || loading}
          >
            <Mic size={20} />
            {isRecording && <span className="ai-mic-pulse" />}
          </button>
          {textInput.trim() && (
            <button
              type="submit"
              className="ai-send-btn"
              disabled={loading || isRecording || isTranscribing}
            >
              <Send size={18} />
            </button>
          )}
        </form>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile FAB */}
      {viewMode === 'closed' && (
        <button className="ai-fab" onClick={handleOpen} title="Asistente IA">
          <Mic size={22} />
        </button>
      )}

      {/* Mobile Listening Screen */}
      {viewMode === 'listening' && (
        <div className="ai-listening-screen">
          <div className="ai-blob ai-blob-1" />
          <div className="ai-blob ai-blob-2" />
          <div className="ai-blob ai-blob-3" />

          <div className="ai-listening-content">
            {listenError ? (
              <div className="ai-listening-error">
                No se pudo acceder al microfono
                <button onClick={() => setListenError(false)}>Reintentar</button>
              </div>
            ) : (
              <>
                <div className="ai-listening-label">
                  <Mic size={18} />
                  {isRecording ? `Grabando... ${recordingDuration}s` : 'Preparando...'}
                </div>
                <div className="ai-listening-transcript">
                  <span className="ai-listening-hint">
                    {'Habla y presiona el chulito para enviar'.split('').map((ch, i) => (
                      <span key={i} className="ai-hint-char" style={{ animationDelay: `${i * 0.1}s` }}>{ch === ' ' ? '\u00A0' : ch}</span>
                    ))}
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="ai-listening-actions">
            <button className="ai-listening-btn ai-listening-btn-cancel" onClick={cancelRecording}>
              <X size={30} />
            </button>
            <button className="ai-listening-btn ai-listening-btn-send" onClick={stopRecordingAndSend}>
              <Check size={30} />
            </button>
          </div>
        </div>
      )}

      {/* Mobile fullscreen chat */}
      {viewMode === 'chat' && (
        <div className="ai-chat-fullscreen">
          {chatContent}
        </div>
      )}

      {/* Desktop side panel */}
      {panelVisible && (
        <div className={`ai-side-panel ${panelClosing ? 'closing' : ''}`} onAnimationEnd={() => { if (panelClosing) setPanelClosing(false) }}>
          <div className="ai-chat-header">
            <button className="ai-chat-back ai-panel-close" onClick={() => { setPanelClosing(true); onTogglePanel?.() }}>
              <ChevronRight size={22} />
            </button>
            <span className="ai-chat-title">AI {negocioNombre}</span>
            <button className="ai-chat-clear" onClick={() => { setMessages([{ role: 'assistant', content: 'Hola, soy tu agente de AI. Dime que quieres saber hoy?' }]); setSessionId(null); setFeedback({}) }}>
              Limpiar chat
            </button>
          </div>

          <div className="ai-chat-messages">
            {messages.length === 0 && !loading && (
              <div className="ai-chat-empty">
                <span>En que te puedo ayudar hoy 😊</span>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`ai-msg-row ai-msg-row-${msg.role}`}>
                <div className={`ai-avatar ai-avatar-${msg.role}`}>
                  {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div className="ai-msg-bubble-wrapper">
                  <div className={`ai-msg ai-msg-${msg.role}`}>
                    {msg.role === 'assistant' ? formatMarkdown(msg.content) : msg.content}
                  </div>
                  {msg.role === 'assistant' && (
                    <div className="ai-msg-actions">
                      <button data-like-idx={i} className={`ai-msg-action ${feedback[i] === 'like' ? 'active' : ''}`} onClick={() => handleFeedback(i, 'like')}><ThumbsUp size={14} /></button>
                      <button className={`ai-msg-action ${feedback[i] === 'dislike' ? 'active' : ''}`} onClick={() => handleFeedback(i, 'dislike')}><ThumbsDown size={14} /></button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="ai-thinking-pill">
                <span className="ai-thinking-dot" />
                <span className="ai-thinking-dot" />
                <span className="ai-thinking-dot" />
                Pensando...
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="ai-input-area">
            <form className="ai-input-form" onSubmit={handleTextSubmit}>
              <input
                type="text"
                className="ai-text-input"
                placeholder={getPlaceholder()}
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                disabled={isRecording || isTranscribing}
                autoFocus
              />
              <button
                type="button"
                className={`ai-mic-btn ${isRecording ? 'recording' : ''} ${isTranscribing ? 'transcribing' : ''}`}
                onClick={() => toggleMic()}
                disabled={isTranscribing || loading}
              >
                <Mic size={20} />
                {isRecording && <span className="ai-mic-pulse" />}
              </button>
              {textInput.trim() && (
                <button
                  type="submit"
                  className="ai-send-btn"
                  disabled={loading || isRecording || isTranscribing}
                >
                  <Send size={18} />
                </button>
              )}
            </form>
          </div>
        </div>
      )}

      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} reason="ai" />}
    </>
  )
}
