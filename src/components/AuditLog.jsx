import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useTenant } from './TenantContext'
import { Search, X, FileText, RefreshCw } from 'lucide-react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { registerLocale } from 'react-datepicker'
import es from 'date-fns/locale/es'

registerLocale('es', es)

export default function AuditLog() {
  const { negocioId } = useTenant()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroTabla, setFiltroTabla] = useState('')
  const [filtroAccion, setFiltroAccion] = useState('')
  const [fechaDesde, setFechaDesde] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [fechaHasta, setFechaHasta] = useState(new Date())
  const [expandedLog, setExpandedLog] = useState(null)

  const fetchLogs = async () => {
    setLoading(true)
    let query = supabase
      .from('audit_log')
      .select('*')
      .eq('negocio_id', negocioId)
      .order('created_at', { ascending: false })
      .limit(500)

    if (fechaDesde) {
      query = query.gte('created_at', fechaDesde.toISOString())
    }
    if (fechaHasta) {
      const hasta = new Date(fechaHasta)
      hasta.setHours(23, 59, 59, 999)
      query = query.lte('created_at', hasta.toISOString())
    }
    if (filtroTabla) {
      query = query.eq('tabla', filtroTabla)
    }
    if (filtroAccion) {
      query = query.eq('accion', filtroAccion)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching audit logs:', error)
    }
    setLogs(data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (negocioId) fetchLogs()
  }, [negocioId, fechaDesde, fechaHasta, filtroTabla, filtroAccion])

  const filteredLogs = logs.filter(log => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      log.tabla?.toLowerCase().includes(q) ||
      log.descripcion?.toLowerCase().includes(q) ||
      log.usuario_email?.toLowerCase().includes(q) ||
      log.registro_id?.toLowerCase().includes(q)
    )
  })

  const tablas = [...new Set(logs.map(l => l.tabla))].sort()

  const formatDate = (iso) => {
    const d = new Date(iso)
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
  }

  const getAccionClass = (accion) => {
    const map = { create: 'audit-action-create', update: 'audit-action-update', delete: 'audit-action-delete' }
    return map[accion] || ''
  }

  const getAccionLabel = (accion) => {
    const map = { create: 'Crear', update: 'Editar', delete: 'Eliminar' }
    return map[accion] || accion
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Log de Auditoría</h1>
          <p className="page-subtitle">{filteredLogs.length} registros</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchLogs}>
          <RefreshCw size={16} /> Actualizar
        </button>
      </div>

      <div className="filters-bar">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button className="search-clear" onClick={() => setSearch('')}><X size={16} /></button>}
        </div>

        <div className="filter-group">
          <select value={filtroTabla} onChange={e => setFiltroTabla(e.target.value)} className="filter-select">
            <option value="">Todas las tablas</option>
            {tablas.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <select value={filtroAccion} onChange={e => setFiltroAccion(e.target.value)} className="filter-select">
            <option value="">Todas las acciones</option>
            <option value="create">Crear</option>
            <option value="update">Editar</option>
            <option value="delete">Eliminar</option>
          </select>

          <DatePicker
            selected={fechaDesde}
            onChange={d => setFechaDesde(d)}
            dateFormat="dd/MM/yyyy"
            locale="es"
            placeholderText="Desde"
            className="filter-date"
            isClearable
            todayButton="Hoy"
          />
          <DatePicker
            selected={fechaHasta}
            onChange={d => setFechaHasta(d)}
            dateFormat="dd/MM/yyyy"
            locale="es"
            placeholderText="Hasta"
            className="filter-date"
            isClearable
            todayButton="Hoy"
          />
        </div>
      </div>

      {loading ? (
        <div className="loading">Cargando...</div>
      ) : filteredLogs.length === 0 ? (
        <div className="empty-state">
          <FileText size={48} />
          <p>No hay registros de auditoría</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="audit-log-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Acción</th>
                <th>Tabla</th>
                <th>Descripción</th>
                <th>Usuario</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(log => (
                <>
                  <tr key={log.id} onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)} style={{ cursor: 'pointer' }}>
                    <td>{formatDate(log.created_at)}</td>
                    <td>
                      <span className={`audit-action ${getAccionClass(log.accion)}`}>
                        {getAccionLabel(log.accion)}
                      </span>
                    </td>
                    <td>{log.tabla}</td>
                    <td>{log.descripcion}</td>
                    <td>{log.usuario_email?.split('@')[0]}</td>
                  </tr>
                  {expandedLog === log.id && (log.antes || log.despues) && (
                    <tr key={`${log.id}-detail`}>
                      <td colSpan={5} style={{ padding: '0.8rem', background: 'var(--bg-secondary)' }}>
                        <div style={{ display: 'flex', gap: '2rem', fontSize: '0.8rem' }}>
                          {log.antes && (
                            <div>
                              <strong style={{ color: 'var(--accent-red)' }}>Antes:</strong>
                              <pre style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
                                {JSON.stringify(log.antes, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.despues && (
                            <div>
                              <strong style={{ color: 'var(--accent-green)' }}>Después:</strong>
                              <pre style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
                                {JSON.stringify(log.despues, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
