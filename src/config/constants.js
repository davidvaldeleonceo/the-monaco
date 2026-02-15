/**
 * Monaco PRO — Centralized Constants
 *
 * Single source of truth for API config, storage keys,
 * and reusable select strings used across the app.
 */

// ─── API & Auth ─────────────────────────────────────────────────────
export const API_URL = import.meta.env.VITE_API_URL || ''  // empty = same origin (proxied by vite)
export const TOKEN_KEY = 'monaco_auth_token'
export const SESSION_KEY = 'monaco_auth_session'

// ─── Reusable SELECT strings (Supabase-style joins) ─────────────────
export const LAVADAS_SELECT = '*, cliente:clientes(nombre), tipo_lavado:tipos_lavado(nombre), lavador:lavadores(nombre), metodo_pago:metodos_pago(nombre)'
export const CLIENTES_SELECT = '*, membresia:tipos_membresia(nombre)'

// ─── Estado (service workflow) ──────────────────────────────────────
export const ESTADO_COLORS = {
  'EN ESPERA': '#f59e0b',
  'EN LAVADO': '#3b82f6',
  'TERMINADO': '#8BA7BF',
  'ENTREGADO': '#62B6CB',
}

export const CHART_THEME = {
  grid: '#1E3A5F',
  axis: '#8BA7BF',
  tooltipBg: '#133253',
  tooltipBorder: '#1E3A5F',
  cursorFill: 'rgba(255, 255, 255, 0.04)',
}

export const ESTADO_LABELS = {
  'EN ESPERA': 'Espera',
  'EN LAVADO': 'Lavando',
  'TERMINADO': 'Terminado',
  'ENTREGADO': 'Entregado',
}

export const ESTADO_CLASSES = {
  'EN ESPERA': 'estado-espera',
  'EN LAVADO': 'estado-lavado',
  'TERMINADO': 'estado-terminado',
  'ENTREGADO': 'estado-entregado',
}
