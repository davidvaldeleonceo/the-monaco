/**
 * Monaco PRO — API Adapter
 *
 * Drop-in replacement for @supabase/supabase-js.
 * All components import { supabase } from './supabaseClient' and call
 * supabase.from('table').select().eq().order() etc.
 *
 * This adapter translates those chained calls into HTTP requests
 * to our own Express backend.
 */

import { io } from 'socket.io-client'

// ─── Config ────────────────────────────────────────────────────────
const API_URL = import.meta.env.VITE_API_URL || ''  // empty = same origin (proxied by vite)
const TOKEN_KEY = 'monaco_auth_token'
const SESSION_KEY = 'monaco_auth_session'

// ─── Token helpers ─────────────────────────────────────────────────
function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

function setSession(session) {
  if (session?.access_token) {
    localStorage.setItem(TOKEN_KEY, session.access_token)
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } else {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(SESSION_KEY)
  }
}

function getStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// ─── HTTP helper ───────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  })

  // Try to parse JSON, but handle non-JSON responses
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = { error: text }
  }

  if (!res.ok && !data.error) {
    data.error = { message: `HTTP ${res.status}` }
  }

  return data
}

// ─── QueryBuilder (mimics supabase-js chaining) ────────────────────
class QueryBuilder {
  constructor(table) {
    this._table = table
    this._method = 'GET'
    this._body = null
    this._filters = {}
    this._select = '*'
    this._order = null
    this._limit = null
    this._single = false
    this._or = null
    this._headers = {}
  }

  select(columns = '*') {
    this._select = columns
    return this
  }

  insert(data) {
    this._method = 'POST'
    this._body = data
    return this
  }

  update(data) {
    this._method = 'PATCH'
    this._body = data
    return this
  }

  delete() {
    this._method = 'DELETE'
    return this
  }

  eq(column, value) {
    this._filters[column] = `eq.${value}`
    return this
  }

  neq(column, value) {
    this._filters[column] = `neq.${value}`
    return this
  }

  gt(column, value) {
    this._filters[column] = `gt.${value}`
    return this
  }

  gte(column, value) {
    this._filters[column] = `gte.${value}`
    return this
  }

  lt(column, value) {
    this._filters[column] = `lt.${value}`
    return this
  }

  lte(column, value) {
    this._filters[column] = `lte.${value}`
    return this
  }

  like(column, value) {
    this._filters[column] = `like.${value}`
    return this
  }

  ilike(column, value) {
    this._filters[column] = `ilike.${value}`
    return this
  }

  is(column, value) {
    this._filters[column] = `is.${value}`
    return this
  }

  in(column, values) {
    this._filters[column] = `in.(${values.join(',')})`
    return this
  }

  or(conditions) {
    this._or = conditions
    return this
  }

  order(column, { ascending = true } = {}) {
    const dir = ascending ? 'asc' : 'desc'
    if (this._order) {
      this._order += `,${column}.${dir}`
    } else {
      this._order = `${column}.${dir}`
    }
    return this
  }

  limit(n) {
    this._limit = n
    return this
  }

  single() {
    this._single = true
    return this
  }

  // Build URL with query params
  _buildUrl() {
    const params = new URLSearchParams()

    if (this._select !== '*') {
      params.set('select', this._select)
    }

    for (const [key, value] of Object.entries(this._filters)) {
      params.set(key, value)
    }

    if (this._or) {
      params.set('or', this._or)
    }

    if (this._order) {
      params.set('order', this._order)
    }

    if (this._limit != null) {
      params.set('limit', String(this._limit))
    }

    if (this._single) {
      params.set('single', 'true')
    }

    const qs = params.toString()
    return `/api/${this._table}${qs ? '?' + qs : ''}`
  }

  // Execute the query (thenable)
  async then(resolve, reject) {
    try {
      const url = this._buildUrl()
      const options = { method: this._method }

      if (this._body != null) {
        options.body = JSON.stringify(this._body)
      }

      // Pass select string for INSERT/UPDATE so server can re-fetch with joins
      if (this._select !== '*' && (this._method === 'POST' || this._method === 'PATCH')) {
        options.headers = { 'X-Select': this._select }
      }

      const result = await apiFetch(url, options)

      // Normalize response shape to match supabase-js { data, error }
      if (result.error && typeof result.error === 'string') {
        resolve({ data: null, error: { message: result.error } })
      } else if (result.error && typeof result.error === 'object' && result.error.message) {
        resolve({ data: null, error: result.error })
      } else {
        resolve({ data: result.data ?? result, error: null })
      }
    } catch (err) {
      if (reject) reject(err)
      else resolve({ data: null, error: { message: err.message } })
    }
  }
}

// ─── Auth module ───────────────────────────────────────────────────
const authListeners = new Set()

const authModule = {
  async signUp({ email, password }) {
    const result = await apiFetch('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })

    if (result.error) {
      return { data: { session: null, user: null }, error: { message: result.error } }
    }

    const session = result.data?.session
    setSession(session)

    if (session) {
      notifyAuthListeners('SIGNED_IN', session)
    }

    return {
      data: {
        session,
        user: result.data?.user || session?.user || null,
      },
      error: null,
    }
  },

  async signInWithPassword({ email, password }) {
    const result = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })

    if (result.error) {
      return { data: { session: null }, error: { message: result.error } }
    }

    const session = result.data?.session
    setSession(session)

    if (session) {
      notifyAuthListeners('SIGNED_IN', session)
    }

    return { data: { session }, error: null }
  },

  async signOut() {
    setSession(null)
    disconnectSocket()
    notifyAuthListeners('SIGNED_OUT', null)
    return { error: null }
  },

  async getSession() {
    const session = getStoredSession()
    if (!session?.access_token) {
      return { data: { session: null }, error: null }
    }

    // Validate token with server
    const result = await apiFetch('/api/auth/session')

    if (result.data?.session) {
      return { data: { session: result.data.session }, error: null }
    }

    // Token invalid — clear
    setSession(null)
    return { data: { session: null }, error: null }
  },

  onAuthStateChange(callback) {
    authListeners.add(callback)

    // Fire initial event if session exists
    const session = getStoredSession()
    if (session) {
      setTimeout(() => callback('SIGNED_IN', session), 0)
    }

    return {
      data: {
        subscription: {
          unsubscribe() {
            authListeners.delete(callback)
          },
        },
      },
    }
  },
}

function notifyAuthListeners(event, session) {
  for (const listener of authListeners) {
    try {
      listener(event, session)
    } catch (e) {
      console.warn('Auth listener error:', e)
    }
  }
}

// ─── Realtime (Socket.io) ──────────────────────────────────────────
let socket = null

function connectSocket() {
  const token = getToken()
  if (!token || socket?.connected) return

  const wsUrl = API_URL || window.location.origin
  socket = io(wsUrl, {
    auth: { token },
    transports: ['websocket', 'polling'],
  })

  socket.on('connect_error', (err) => {
    console.warn('Realtime connection error:', err.message)
  })
}

function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

// Connect socket when we have a token
if (getToken()) {
  connectSocket()
}

// Reconnect on auth changes
authListeners.add((event) => {
  if (event === 'SIGNED_IN') connectSocket()
  else if (event === 'SIGNED_OUT') disconnectSocket()
})

/**
 * Realtime channel API — mimics supabase.channel().on().subscribe()
 * DataContext uses:
 *   supabase.channel('lavadas-changes')
 *     .on('postgres_changes', { event: '*', schema: 'public', table: 'lavadas' }, callback)
 *     .subscribe()
 */
class RealtimeChannel {
  constructor(name) {
    this._name = name
    this._handlers = []
  }

  on(_eventType, { table }, callback) {
    this._handlers.push({ table, callback })
    return this
  }

  subscribe() {
    // Register socket handlers
    for (const { table, callback } of this._handlers) {
      const event = `db:${table}`
      if (socket) {
        socket.on(event, (payload) => callback(payload))
      }
    }
    return this
  }
}

// ─── RPC module ────────────────────────────────────────────────────
async function rpc(functionName, params = {}) {
  const result = await apiFetch(`/api/rpc/${functionName}`, {
    method: 'POST',
    body: JSON.stringify(params),
  })

  if (result.error && typeof result.error === 'string') {
    return { data: null, error: { message: result.error } }
  }
  if (result.error) {
    return { data: null, error: result.error }
  }

  // If RPC returns a new session (e.g., after creating negocio), update it
  if (result.session) {
    setSession(result.session)
    notifyAuthListeners('SIGNED_IN', result.session)
  }

  return { data: result.data, error: null }
}

// ─── Public API (drop-in for supabase client) ──────────────────────
export const supabase = {
  from(table) {
    return new QueryBuilder(table)
  },

  auth: authModule,

  rpc,

  channel(name) {
    return new RealtimeChannel(name)
  },

  removeChannel(_channel) {
    // Socket.io handles cleanup differently — channels stay connected
    // and are cleaned up on disconnect. This is a no-op.
  },
}
