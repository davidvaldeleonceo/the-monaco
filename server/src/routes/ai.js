import { Router } from 'express'
import multer from 'multer'
import pool from '../config/database.js'
import env from '../config/env.js'
import { chat } from '../services/aiService.js'
import { getTimezone } from '../config/currencies.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } })

// In-memory daily limit: 3 AI queries/day per negocio (PRO only, free has no access)
const dailyUsage = new Map()

function checkDailyLimit(negocioId, tz = 'America/Bogota') {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: tz })
  const key = `${negocioId}:${today}`

  if (!dailyUsage.has(key)) {
    dailyUsage.set(key, 0)
    // Clean old entries
    for (const k of dailyUsage.keys()) {
      if (!k.endsWith(today)) dailyUsage.delete(k)
    }
  }

  const count = dailyUsage.get(key)
  if (count >= 3) return { allowed: false, remaining: 0 }
  dailyUsage.set(key, count + 1)
  return { allowed: true, remaining: 2 - count }
}

function computeIsPro(negocio) {
  const now = new Date()
  if (negocio.subscription_expires_at && new Date(negocio.subscription_expires_at) > now) return true
  if (negocio.trial_ends_at && new Date(negocio.trial_ends_at) > now) return true
  return false
}

async function getNegocio(negocioId) {
  const { rows } = await pool.query(
    'SELECT plan, trial_ends_at, subscription_expires_at, nombre, pais FROM negocios WHERE id = $1',
    [negocioId]
  )
  return rows[0]
}

router.post('/chat', async (req, res) => {
  try {
    const negocioId = req.user.negocio_id
    const { message, sessionId } = req.body

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' })
    }

    if (message.length > 1000) {
      return res.status(400).json({ error: 'Message too long (max 1000 chars)' })
    }

    const negocio = await getNegocio(negocioId)
    if (!negocio || !computeIsPro(negocio)) {
      return res.status(403).json({ error: 'PRO_REQUIRED' })
    }

    const unlimited = req.user.email === 'principal@themonaco.com.co'
    const tz = getTimezone(negocio.pais || 'CO')
    const { allowed, remaining } = unlimited ? { allowed: true, remaining: 999 } : checkDailyLimit(negocioId, tz)
    if (!allowed) {
      return res.status(429).json({ error: 'DAILY_LIMIT', message: 'Has alcanzado el límite de 3 consultas diarias de IA.' })
    }

    const result = await chat(message.trim(), sessionId || null, negocioId, negocio.nombre, req.io)
    res.json({ ...result, remaining })
  } catch (err) {
    console.error('AI chat error:', err.message)
    res.status(500).json({ error: 'Error procesando tu mensaje. Intenta de nuevo.' })
  }
})

// Known Whisper hallucinations — returned on silence/noise
const WHISPER_HALLUCINATIONS = [
  'subtítulos realizados por la comunidad de amara.org',
  'subtitulado por la comunidad de amara.org',
  'gracias por ver el vídeo',
  'gracias por ver el video',
  'suscríbete al canal',
  'gracias por ver',
  'thanks for watching',
  'thank you for watching',
]

function isWhisperHallucination(text) {
  const normalized = text.toLowerCase().trim().replace(/[.!¡,]/g, '')
  return WHISPER_HALLUCINATIONS.some(h => normalized.includes(h))
}

router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    const negocioId = req.user.negocio_id

    const negocio = await getNegocio(negocioId)
    if (!negocio || !computeIsPro(negocio)) {
      return res.status(403).json({ error: 'PRO_REQUIRED' })
    }

    // Transcription doesn't count toward the daily limit (it feeds into /chat which does)

    if (!req.file) {
      return res.status(400).json({ error: 'Audio file required' })
    }

    if (!env.openaiApiKey) {
      return res.status(500).json({ error: 'OpenAI API key not configured' })
    }

    // Build multipart form for Whisper API
    const formData = new FormData()
    formData.append('file', new Blob([req.file.buffer], { type: req.file.mimetype }), 'audio.webm')
    formData.append('model', 'whisper-1')
    formData.append('language', 'es')
    formData.append('prompt', 'Servicios de vehículos, lavado, taller, clientes, placa, sencillo, completo, premium, ingresos, trabajadores.')

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.openaiApiKey}` },
      body: formData,
    })

    if (!whisperRes.ok) {
      const errText = await whisperRes.text()
      console.error('Whisper API error:', whisperRes.status, errText)
      return res.status(500).json({ error: 'Error transcribiendo audio' })
    }

    const data = await whisperRes.json()
    const text = (data.text || '').trim()

    if (!text || isWhisperHallucination(text)) {
      return res.json({ text: '' })
    }

    res.json({ text })
  } catch (err) {
    console.error('Transcribe error:', err.message)
    res.status(500).json({ error: 'Error procesando audio' })
  }
})

export default router
