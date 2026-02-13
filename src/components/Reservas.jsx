import { useState, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { useData } from './DataContext'
import { Plus, Search, X, Calendar, Clock, Phone, User, CheckCircle2, XCircle, AlertCircle, Trash2 } from 'lucide-react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { registerLocale } from 'react-datepicker'
import es from 'date-fns/locale/es'

registerLocale('es', es)

const ESTADOS_RESERVA = [
  { value: 'pendiente', label: 'Pendiente', color: 'var(--accent-yellow)' },
  { value: 'confirmada', label: 'Confirmada', color: 'var(--accent-blue)' },
  { value: 'completada', label: 'Completada', color: 'var(--accent-green)' },
  { value: 'cancelada', label: 'Cancelada', color: 'var(--accent-red)' },
]

const ORIGENES = ['manual', 'cal.com', 'whatsapp', 'telefono']

export default function Reservas() {
  const { reservas, clientes, negocioId, refreshReservas, addReservaLocal, updateReservaLocal, deleteReservaLocal } = useData()

  const [showModal, setShowModal] = useState(false)
  const [editingReserva, setEditingReserva] = useState(null)
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [fechaDesde, setFechaDesde] = useState(() => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    return hoy
  })
  const [fechaHasta, setFechaHasta] = useState(() => {
    const hoy = new Date()
    hoy.setDate(hoy.getDate() + 7)
    hoy.setHours(23, 59, 59, 999)
    return hoy
  })
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [formData, setFormData] = useState({
    placa: '',
    telefono: '',
    nombre_cliente: '',
    fecha_hora: new Date(),
    estado: 'pendiente',
    origen: 'manual',
    notas: '',
  })

  const resetForm = () => {
    setFormData({
      placa: '',
      telefono: '',
      nombre_cliente: '',
      fecha_hora: new Date(),
      estado: 'pendiente',
      origen: 'manual',
      notas: '',
    })
    setEditingReserva(null)
    setErrorMsg('')
  }

  const openNew = () => {
    resetForm()
    setShowModal(true)
  }

  const openEdit = (reserva) => {
    setFormData({
      placa: reserva.placa || '',
      telefono: reserva.telefono || '',
      nombre_cliente: reserva.nombre_cliente || '',
      fecha_hora: new Date(reserva.fecha_hora),
      estado: reserva.estado || 'pendiente',
      origen: reserva.origen || 'manual',
      notas: reserva.notas || '',
    })
    setEditingReserva(reserva)
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formData.placa.trim() && !formData.nombre_cliente.trim()) {
      setErrorMsg('Ingresa al menos la placa o el nombre del cliente')
      return
    }

    setSaving(true)
    setErrorMsg('')

    const payload = {
      placa: formData.placa.trim().toUpperCase(),
      telefono: formData.telefono.trim(),
      nombre_cliente: formData.nombre_cliente.trim(),
      fecha_hora: formData.fecha_hora.toISOString(),
      estado: formData.estado,
      origen: formData.origen,
      notas: formData.notas.trim(),
      negocio_id: negocioId,
    }

    if (editingReserva) {
      const { data, error } = await supabase
        .from('reservas')
        .update(payload)
        .eq('id', editingReserva.id)
        .select()
        .single()

      if (error) {
        setErrorMsg('Error al actualizar: ' + error.message)
      } else {
        updateReservaLocal(data.id, data)
        setShowModal(false)
        resetForm()
      }
    } else {
      const { data, error } = await supabase
        .from('reservas')
        .insert(payload)
        .select()
        .single()

      if (error) {
        setErrorMsg('Error al crear: ' + error.message)
      } else {
        addReservaLocal(data)
        setShowModal(false)
        resetForm()
      }
    }

    setSaving(false)
  }

  const handleDelete = async (reserva) => {
    if (!confirm(`Eliminar reserva de ${reserva.nombre_cliente || reserva.placa}?`)) return

    const { error } = await supabase
      .from('reservas')
      .delete()
      .eq('id', reserva.id)

    if (!error) {
      deleteReservaLocal(reserva.id)
    }
  }

  const handleEstadoChange = async (reserva, nuevoEstado) => {
    const { error } = await supabase
      .from('reservas')
      .update({ estado: nuevoEstado })
      .eq('id', reserva.id)

    if (!error) {
      updateReservaLocal(reserva.id, { estado: nuevoEstado })
    }
  }

  // Auto-fill from clientes
  const handlePlacaBlur = () => {
    if (!formData.placa.trim()) return
    const cliente = clientes.find(c => c.placa?.toUpperCase() === formData.placa.trim().toUpperCase())
    if (cliente) {
      setFormData(prev => ({
        ...prev,
        nombre_cliente: prev.nombre_cliente || cliente.nombre || '',
        telefono: prev.telefono || cliente.telefono || '',
      }))
    }
  }

  const reservasFiltradas = useMemo(() => {
    return (reservas || []).filter(r => {
      if (filtroEstado && r.estado !== filtroEstado) return false
      if (fechaDesde && new Date(r.fecha_hora) < fechaDesde) return false
      if (fechaHasta && new Date(r.fecha_hora) > fechaHasta) return false
      if (search) {
        const q = search.toLowerCase()
        const matchPlaca = r.placa?.toLowerCase().includes(q)
        const matchNombre = r.nombre_cliente?.toLowerCase().includes(q)
        const matchTel = r.telefono?.includes(q)
        if (!matchPlaca && !matchNombre && !matchTel) return false
      }
      return true
    }).sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora))
  }, [reservas, filtroEstado, fechaDesde, fechaHasta, search])

  const getEstadoInfo = (estado) => ESTADOS_RESERVA.find(e => e.value === estado) || ESTADOS_RESERVA[0]

  const formatFechaHora = (iso) => {
    const d = new Date(iso)
    return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' }) +
      ' ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
  }

  const isPast = (iso) => new Date(iso) < new Date()

  // Stats
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const manana = new Date(hoy)
  manana.setDate(manana.getDate() + 1)

  const reservasHoy = (reservas || []).filter(r => {
    const d = new Date(r.fecha_hora)
    return d >= hoy && d < manana && r.estado !== 'cancelada' && r.estado !== 'completada'
  }).length

  const reservasPendientes = (reservas || []).filter(r => r.estado === 'pendiente').length

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Reservas</h1>
          <p className="page-subtitle">
            {reservasHoy} para hoy &middot; {reservasPendientes} pendientes
          </p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          <Plus size={18} /> Nueva Reserva
        </button>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Buscar placa, nombre, tel..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button className="search-clear" onClick={() => setSearch('')}><X size={16} /></button>}
        </div>

        <div className="filter-group">
          <select
            value={filtroEstado}
            onChange={e => setFiltroEstado(e.target.value)}
            className="filter-select"
          >
            <option value="">Todos los estados</option>
            {ESTADOS_RESERVA.map(e => (
              <option key={e.value} value={e.value}>{e.label}</option>
            ))}
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

      {/* Reservas List */}
      <div className="reservas-grid">
        {reservasFiltradas.length === 0 ? (
          <div className="empty-state">
            <Calendar size={48} />
            <p>No hay reservas en este rango</p>
          </div>
        ) : (
          reservasFiltradas.map(reserva => {
            const estadoInfo = getEstadoInfo(reserva.estado)
            const past = isPast(reserva.fecha_hora) && reserva.estado !== 'completada' && reserva.estado !== 'cancelada'

            return (
              <div key={reserva.id} className={`reserva-card ${past ? 'reserva-past' : ''}`}>
                <div className="reserva-card-header">
                  <div className="reserva-fecha">
                    <Calendar size={14} />
                    <span>{formatFechaHora(reserva.fecha_hora)}</span>
                  </div>
                  <div className="reserva-actions-top">
                    <select
                      value={reserva.estado}
                      onChange={e => handleEstadoChange(reserva, e.target.value)}
                      className="reserva-estado-select"
                      style={{ color: estadoInfo.color, borderColor: estadoInfo.color }}
                    >
                      {ESTADOS_RESERVA.map(e => (
                        <option key={e.value} value={e.value}>{e.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="reserva-card-body" onClick={() => openEdit(reserva)}>
                  <div className="reserva-info-row">
                    {reserva.placa && (
                      <span className="reserva-placa">{reserva.placa}</span>
                    )}
                    {reserva.nombre_cliente && (
                      <span className="reserva-nombre">
                        <User size={12} /> {reserva.nombre_cliente}
                      </span>
                    )}
                  </div>
                  {reserva.telefono && (
                    <div className="reserva-info-row">
                      <Phone size={12} />
                      <span>{reserva.telefono}</span>
                    </div>
                  )}
                  {reserva.notas && (
                    <p className="reserva-notas">{reserva.notas}</p>
                  )}
                </div>

                <div className="reserva-card-footer">
                  <span className="reserva-origen">{reserva.origen}</span>
                  <button className="btn-icon-sm btn-danger-icon" onClick={() => handleDelete(reserva)} title="Eliminar">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); resetForm() }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingReserva ? 'Editar Reserva' : 'Nueva Reserva'}</h2>
              <button className="modal-close" onClick={() => { setShowModal(false); resetForm() }}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {errorMsg && <div className="error-msg">{errorMsg}</div>}

              <div className="form-row">
                <div className="form-group">
                  <label>Placa</label>
                  <input
                    type="text"
                    value={formData.placa}
                    onChange={e => setFormData(prev => ({ ...prev, placa: e.target.value.toUpperCase() }))}
                    onBlur={handlePlacaBlur}
                    placeholder="ABC123"
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Nombre Cliente</label>
                  <input
                    type="text"
                    value={formData.nombre_cliente}
                    onChange={e => setFormData(prev => ({ ...prev, nombre_cliente: e.target.value }))}
                    placeholder="Nombre"
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Teléfono</label>
                  <input
                    type="text"
                    value={formData.telefono}
                    onChange={e => setFormData(prev => ({ ...prev, telefono: e.target.value }))}
                    placeholder="300 123 4567"
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Origen</label>
                  <select
                    value={formData.origen}
                    onChange={e => setFormData(prev => ({ ...prev, origen: e.target.value }))}
                    className="form-input"
                  >
                    {ORIGENES.map(o => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Fecha y Hora</label>
                  <DatePicker
                    selected={formData.fecha_hora}
                    onChange={d => setFormData(prev => ({ ...prev, fecha_hora: d }))}
                    showTimeSelect
                    timeFormat="HH:mm"
                    timeIntervals={15}
                    dateFormat="dd/MM/yyyy HH:mm"
                    locale="es"
                    className="form-input"
                    todayButton="Hoy"
                  />
                </div>
                <div className="form-group">
                  <label>Estado</label>
                  <select
                    value={formData.estado}
                    onChange={e => setFormData(prev => ({ ...prev, estado: e.target.value }))}
                    className="form-input"
                  >
                    {ESTADOS_RESERVA.map(e => (
                      <option key={e.value} value={e.value}>{e.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Notas</label>
                <textarea
                  value={formData.notas}
                  onChange={e => setFormData(prev => ({ ...prev, notas: e.target.value }))}
                  placeholder="Notas adicionales..."
                  className="form-input"
                  rows={3}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowModal(false); resetForm() }}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : editingReserva ? 'Actualizar' : 'Crear Reserva'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
