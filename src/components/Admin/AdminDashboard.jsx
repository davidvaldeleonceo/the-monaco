import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Users, Building2, Droplets, DollarSign, TrendingUp, Clock, AlertTriangle, CheckCircle, Pencil, Trash2, X, Check } from 'lucide-react'
import { API_URL, TOKEN_KEY } from '../../config/constants'

async function adminFetch(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY)
  const res = await fetch(`${API_URL}/api/admin${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

function formatMoney(n) {
  return '$ ' + Math.round(n).toLocaleString('es-CO')
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  const diff = Math.ceil((new Date(dateStr) - new Date()) / 86400000)
  return diff
}

function planLabel(neg) {
  const subDays = daysUntil(neg.subscription_expires_at)
  const trialDays = daysUntil(neg.trial_ends_at)
  if (subDays !== null && subDays > 0) return { text: `PRO (${subDays}d)`, cls: 'admin-badge-pro' }
  if (trialDays !== null && trialDays > 0) return { text: `Trial (${trialDays}d)`, cls: 'admin-badge-trial' }
  return { text: 'Free/Vencido', cls: 'admin-badge-free' }
}

function timeAgo(dateStr) {
  if (!dateStr) return 'Nunca'
  const diff = (new Date() - new Date(dateStr)) / 1000
  if (diff < 3600) return `${Math.round(diff / 60)}m`
  if (diff < 86400) return `${Math.round(diff / 3600)}h`
  if (diff < 604800) return `${Math.round(diff / 86400)}d`
  return `${Math.round(diff / 604800)}sem`
}

export default function AdminDashboard() {
  const [overview, setOverview] = useState(null)
  const [negocios, setNegocios] = useState([])
  const [actividad, setActividad] = useState([])
  const [revenue, setRevenue] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('negocios')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true)
      const [ov, neg, act, rev] = await Promise.all([
        adminFetch('/overview'),
        adminFetch('/negocios'),
        adminFetch('/actividad'),
        adminFetch('/revenue'),
      ])
      setOverview(ov)
      setNegocios(neg)
      setActividad(act)
      setRevenue(rev)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const startEdit = (n) => {
    setEditingId(n.id)
    setEditForm({
      nombre: n.nombre,
      email: n.email || '',
      plan: n.plan || 'pro',
      trial_ends_at: n.trial_ends_at ? n.trial_ends_at.slice(0, 10) : '',
      subscription_expires_at: n.subscription_expires_at ? n.subscription_expires_at.slice(0, 10) : '',
    })
  }

  const cancelEdit = () => { setEditingId(null); setEditForm({}) }

  const saveEdit = async (n) => {
    try {
      await adminFetch(`/negocios/${n.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          nombre: editForm.nombre,
          plan: editForm.plan,
          trial_ends_at: editForm.trial_ends_at || null,
          subscription_expires_at: editForm.subscription_expires_at || null,
        }),
      })
      if (editForm.email !== (n.email || '')) {
        const profiles = await adminFetch(`/negocios`)
        const neg = profiles.find(x => x.id === n.id)
        if (neg?.email) {
          // Find user id from the negocios query — we need another approach
          // For now, email edit is handled via the users endpoint
        }
      }
      setEditingId(null)
      fetchAll()
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  const deleteNegocio = async (id) => {
    try {
      await adminFetch(`/negocios/${id}`, { method: 'DELETE' })
      setDeleteConfirm(null)
      fetchAll()
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  if (loading) return <div className="admin-page"><div className="admin-loading">Cargando dashboard...</div></div>
  if (error) return <div className="admin-page"><div className="admin-error">Error: {error}</div></div>

  const neg = overview?.negocios || {}
  const trialsPorVencer = negocios.filter(n => {
    const d = daysUntil(n.trial_ends_at)
    const sub = daysUntil(n.subscription_expires_at)
    return d !== null && d > 0 && d <= 5 && (sub === null || sub <= 0)
  })

  return (
    <div className="admin-page">
      <h1 className="admin-title">Admin Dashboard</h1>

      {/* KPI Cards */}
      <div className="admin-kpi-grid">
        <div className="admin-kpi-card">
          <div className="admin-kpi-icon"><Users size={20} /></div>
          <div className="admin-kpi-info">
            <span className="admin-kpi-value">{overview?.usuarios}</span>
            <span className="admin-kpi-label">Usuarios</span>
          </div>
        </div>
        <div className="admin-kpi-card">
          <div className="admin-kpi-icon"><Building2 size={20} /></div>
          <div className="admin-kpi-info">
            <span className="admin-kpi-value">{parseInt(neg.total)}</span>
            <span className="admin-kpi-label">Negocios</span>
          </div>
        </div>
        <div className="admin-kpi-card">
          <div className="admin-kpi-icon"><Droplets size={20} /></div>
          <div className="admin-kpi-info">
            <span className="admin-kpi-value">{overview?.lavadas_total}</span>
            <span className="admin-kpi-label">Lavadas totales</span>
          </div>
        </div>
        <div className="admin-kpi-card">
          <div className="admin-kpi-icon"><TrendingUp size={20} /></div>
          <div className="admin-kpi-info">
            <span className="admin-kpi-value">{overview?.lavadas_7d}</span>
            <span className="admin-kpi-label">Lavadas (7d)</span>
          </div>
        </div>
        <div className="admin-kpi-card">
          <div className="admin-kpi-icon"><DollarSign size={20} /></div>
          <div className="admin-kpi-info">
            <span className="admin-kpi-value">{formatMoney(overview?.revenue?.total || 0)}</span>
            <span className="admin-kpi-label">Revenue total</span>
          </div>
        </div>
        <div className="admin-kpi-card">
          <div className="admin-kpi-icon"><CheckCircle size={20} /></div>
          <div className="admin-kpi-info">
            <span className="admin-kpi-value">{parseInt(neg.pro_pagado)}</span>
            <span className="admin-kpi-label">PRO pagado</span>
          </div>
        </div>
        <div className="admin-kpi-card">
          <div className="admin-kpi-icon"><Clock size={20} /></div>
          <div className="admin-kpi-info">
            <span className="admin-kpi-value">{parseInt(neg.trial_activo)}</span>
            <span className="admin-kpi-label">Trial activo</span>
          </div>
        </div>
        <div className="admin-kpi-card">
          <div className="admin-kpi-icon"><AlertTriangle size={20} /></div>
          <div className="admin-kpi-info">
            <span className="admin-kpi-value">{parseInt(neg.free_o_vencido)}</span>
            <span className="admin-kpi-label">Free/Vencido</span>
          </div>
        </div>
      </div>

      {/* Trials por vencer */}
      {trialsPorVencer.length > 0 && (
        <div className="admin-alert">
          <AlertTriangle size={16} />
          <span><strong>{trialsPorVencer.length} trial{trialsPorVencer.length > 1 ? 's' : ''}</strong> por vencer en 5 dias: {trialsPorVencer.map(n => n.nombre).join(', ')}</span>
        </div>
      )}

      {/* Activity Chart */}
      <div className="admin-chart-card">
        <h3>Lavadas por dia (30d)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={actividad}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
            <XAxis dataKey="dia" tickFormatter={d => new Date(d + 'T12:00:00').getDate()} stroke="var(--text-secondary)" fontSize={12} />
            <YAxis stroke="var(--text-secondary)" fontSize={12} />
            <Tooltip
              contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8 }}
              labelFormatter={d => new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
            />
            <Bar dataKey="lavadas" fill="var(--accent-blue)" radius={[4, 4, 0, 0]} name="Lavadas" />
            <Bar dataKey="negocios_activos" fill="var(--accent-green)" radius={[4, 4, 0, 0]} name="Negocios activos" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        <button className={`admin-tab ${tab === 'negocios' ? 'active' : ''}`} onClick={() => setTab('negocios')}>Negocios ({negocios.length})</button>
        <button className={`admin-tab ${tab === 'revenue' ? 'active' : ''}`} onClick={() => setTab('revenue')}>Pagos ({revenue.length})</button>
      </div>

      {/* Negocios Table */}
      {tab === 'negocios' && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Negocio</th>
                <th>Email</th>
                <th>Plan</th>
                <th>Trial hasta</th>
                <th>Suscripcion hasta</th>
                <th>Lavadas</th>
                <th>7d</th>
                <th>Clientes</th>
                <th>Ultima actividad</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {negocios.map(n => {
                const plan = planLabel(n)
                const isEditing = editingId === n.id
                return (
                  <tr key={n.id}>
                    <td>
                      {isEditing
                        ? <input className="admin-edit-input" value={editForm.nombre} onChange={e => setEditForm(f => ({ ...f, nombre: e.target.value }))} />
                        : <strong>{n.nombre}</strong>
                      }
                    </td>
                    <td className="admin-td-email">{n.email || '—'}</td>
                    <td>
                      {isEditing
                        ? <select className="admin-edit-select" value={editForm.plan} onChange={e => setEditForm(f => ({ ...f, plan: e.target.value }))}>
                            <option value="pro">PRO</option>
                            <option value="free">Free</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        : <span className={`admin-badge ${plan.cls}`}>{plan.text}</span>
                      }
                    </td>
                    <td>
                      {isEditing
                        ? <input className="admin-edit-input" type="date" value={editForm.trial_ends_at} onChange={e => setEditForm(f => ({ ...f, trial_ends_at: e.target.value }))} />
                        : (n.trial_ends_at ? new Date(n.trial_ends_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : '—')
                      }
                    </td>
                    <td>
                      {isEditing
                        ? <input className="admin-edit-input" type="date" value={editForm.subscription_expires_at} onChange={e => setEditForm(f => ({ ...f, subscription_expires_at: e.target.value }))} />
                        : (n.subscription_expires_at ? new Date(n.subscription_expires_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
                      }
                    </td>
                    <td>{n.lavadas_total}</td>
                    <td>{n.lavadas_7d}</td>
                    <td>{n.clientes}</td>
                    <td>{timeAgo(n.ultima_lavada)}</td>
                    <td>
                      {isEditing ? (
                        <div className="admin-actions">
                          <button className="admin-action-btn admin-action-save" onClick={() => saveEdit(n)} title="Guardar"><Check size={15} /></button>
                          <button className="admin-action-btn admin-action-cancel" onClick={cancelEdit} title="Cancelar"><X size={15} /></button>
                        </div>
                      ) : deleteConfirm === n.id ? (
                        <div className="admin-actions">
                          <span className="admin-confirm-text">Eliminar?</span>
                          <button className="admin-action-btn admin-action-delete" onClick={() => deleteNegocio(n.id)} title="Confirmar"><Check size={15} /></button>
                          <button className="admin-action-btn admin-action-cancel" onClick={() => setDeleteConfirm(null)} title="Cancelar"><X size={15} /></button>
                        </div>
                      ) : (
                        <div className="admin-actions">
                          <button className="admin-action-btn" onClick={() => startEdit(n)} title="Editar"><Pencil size={15} /></button>
                          <button className="admin-action-btn admin-action-delete" onClick={() => setDeleteConfirm(n.id)} title="Eliminar"><Trash2 size={15} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Revenue Table */}
      {tab === 'revenue' && (
        <div className="admin-table-wrap">
          {revenue.length === 0 ? (
            <p className="admin-empty">No hay pagos registrados</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Negocio</th>
                  <th>Monto</th>
                  <th>Periodo</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {revenue.map(p => (
                  <tr key={p.id}>
                    <td><strong>{p.negocio || '—'}</strong></td>
                    <td>{formatMoney(p.monto / 100)}</td>
                    <td>{p.periodo || '—'}</td>
                    <td><span className={`admin-badge ${p.estado === 'APPROVED' ? 'admin-badge-pro' : 'admin-badge-free'}`}>{p.estado}</span></td>
                    <td>{new Date(p.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
