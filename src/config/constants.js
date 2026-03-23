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
  'EN ESPERA': '#575200',
  'EN LAVADO': '#0A2F7E',
  'TERMINADO': '#8090A8',
  'ENTREGADO': '#006048',
}

export const CHART_THEME = {
  grid: '#5B95EE',
  axis: '#5B95EE',
  tooltipBg: '#000D3B',
  tooltipBorder: '#0A2F7E',
  cursorFill: 'oklch(0.4 0.18 259 / 0.04)',
}

export const ESTADO_LABELS = {
  'EN ESPERA': 'Espera',
  'EN LAVADO': 'En proceso',
  'TERMINADO': 'Terminado',
  'ENTREGADO': 'Entregado',
}

export const ESTADO_CLASSES = {
  'EN ESPERA': 'estado-espera',
  'EN LAVADO': 'estado-lavado',
  'TERMINADO': 'estado-terminado',
  'ENTREGADO': 'estado-entregado',
}
