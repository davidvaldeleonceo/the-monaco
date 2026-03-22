import { randomUUID } from 'crypto'
import env from '../config/env.js'
import { getSystemPrompt } from './aiPrompt.js'
import { toolDefinitions, executeTool, getBusinessContext } from './aiTools.js'

const sessions = new Map()
const SESSION_TTL = 30 * 60 * 1000 // 30 min
const MAX_TOOL_ROUNDS = 10

// Cleanup expired sessions every 10 min
setInterval(() => {
  const now = Date.now()
  for (const [id, s] of sessions) {
    if (now - s.lastUsed > SESSION_TTL) sessions.delete(id)
  }
}, 10 * 60 * 1000)

function getOrCreateSession(sessionId, negocioId, negocioNombre, businessContext) {
  if (sessionId && sessions.has(sessionId)) {
    const s = sessions.get(sessionId)
    if (s.negocioId !== negocioId) throw new Error('Session mismatch')
    s.lastUsed = Date.now()
    return s
  }

  const id = sessionId || randomUUID()
  const s = {
    id,
    negocioId,
    messages: [{ role: 'system', content: getSystemPrompt(negocioNombre, businessContext) }],
    lastUsed: Date.now(),
  }
  sessions.set(id, s)
  return s
}

export async function chat(message, sessionId, negocioId, negocioNombre, io) {
  if (!env.openaiApiKey) {
    throw new Error('OpenAI API key not configured')
  }

  const context = await getBusinessContext(negocioId)
  const session = getOrCreateSession(sessionId, negocioId, negocioNombre, context.contextText)

  // Refresh system prompt on every message
  session.messages[0] = { role: 'system', content: getSystemPrompt(negocioNombre, context.contextText, context.moneda, context.pais) }

  // Keep system prompt + last 4 user/assistant text pairs for follow-up context.
  // Strip tool_calls and tool results to force fresh data queries on each message.
  const recentPairs = session.messages
    .filter(m => (m.role === 'user') || (m.role === 'assistant' && m.content && !m.tool_calls))
    .slice(-8) // last 4 user + 4 assistant text responses
  session.messages = [session.messages[0], ...recentPairs]
  session.messages.push({ role: 'user', content: message })

  let lavadaCreated = false

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await callOpenAI(session.messages)
    const choice = response.choices?.[0]

    if (!choice) throw new Error('No response from OpenAI')

    const msg = choice.message

    if (choice.finish_reason === 'length' && msg.content) {
      msg.content += '\n\n⚠️ _La respuesta fue cortada por ser muy larga. Intenta una pregunta más específica._'
    }

    session.messages.push(msg)

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      for (const tc of msg.tool_calls) {
        let args
        try {
          args = JSON.parse(tc.function.arguments)
        } catch {
          args = {}
        }

        let result
        try {
          result = await executeTool(tc.function.name, args, negocioId, io, context.moneda, context.pais)
        } catch (err) {
          console.error(`Tool error [${tc.function.name}]:`, err.message)
          result = { error: `Error ejecutando ${tc.function.name}: ${err.message}` }
        }

        if (tc.function.name === 'crear_lavada' && result.exito) {
          lavadaCreated = true
        }

        session.messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        })
      }
      continue
    }

    // No tool calls — final text response
    return { reply: msg.content, sessionId: session.id, lavadaCreated }
  }

  // Exhausted tool rounds — return last content
  const last = session.messages[session.messages.length - 1]
  return { reply: last.content || 'Lo siento, no pude completar la consulta.', sessionId: session.id, lavadaCreated }
}

async function callOpenAI(messages) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: env.openaiModel,
      messages,
      tools: toolDefinitions,
      tool_choice: 'auto',
      max_completion_tokens: 2048,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenAI API error ${res.status}: ${text}`)
  }

  return res.json()
}
