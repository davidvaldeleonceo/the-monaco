import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useData } from './DataContext'
import { Plus, Search, X, Edit, Trash2 } from 'lucide-react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { registerLocale } from 'react-datepicker'
import es from 'date-fns/locale/es'

registerLocale('es', es)

export default function Clientes() {
  const { clientes, tiposMembresia, loading, addClienteLocal, updateClienteLocal, deleteClienteLocal, refreshClientes } = useData()

  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [search, setSearch] = useState('')
  const [filtroTipoCliente, setFiltroTipoCliente] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [fechaDesde, setFechaDesde] = useState(null)
  const [fechaHasta, setFechaHasta] = useState(null)
  const [filtroRapido, setFiltroRapido] = useState('')

  const [formData, setFormData] = useState({
    nombre: '',
    cedula: '',
    telefono: '',
    correo: '',
    placa: '',
    moto: '',
    membresia_id: '',
    fecha_inicio_membresia: null,
    fecha_fin_membresia: null,
    estado: 'Activo'
  })

  const fechaLocalStr = (date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const handleMembresiaChange = (membresiaId) => {
    const membresia = tiposMembresia.find(m => m.id === membresiaId)
    const hoy = new Date()

    if (!membresiaId || membresia?.nombre?.toLowerCase().includes('sin ')) {
      setFormData(prev => ({
        ...prev,
        membresia_id: membresiaId,
        fecha_inicio_membresia: hoy,
        fecha_fin_membresia: hoy
      }))
    } else {
      const meses = Math.max(1, Math.round((membresia?.duracion_dias || 30) / 30))
      const fin = new Date()
      fin.setMonth(fin.getMonth() + meses)
      setFormData(prev => ({
        ...prev,
        membresia_id: membresiaId,
        fecha_inicio_membresia: hoy,
        fecha_fin_membresia: fin
      }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    let formToSend = { ...formData }
    if (!formToSend.membresia_id) {
      const sinMembresia = tiposMembresia.find(m => m.nombre.toLowerCase().includes('sin '))
      if (sinMembresia) {
        const hoy = new Date()
        formToSend.membresia_id = sinMembresia.id
        formToSend.fecha_inicio_membresia = hoy
        formToSend.fecha_fin_membresia = hoy
      }
    }

    const cleanData = Object.fromEntries(
      Object.entries(formToSend).map(([key, value]) => {
        if (value === '' || value === null) return [key, null]
        if ((key === 'fecha_inicio_membresia' || key === 'fecha_fin_membresia') && value instanceof Date) {
          return [key, fechaLocalStr(value)]
        }
        return [key, value]
      })
    )

    if (editando) {
      const { data, error } = await supabase
        .from('clientes')
        .update(cleanData)
        .eq('id', editando)
        .select('*, membresia:tipos_membresia(nombre)')
        .single()

      if (!error && data) {
        updateClienteLocal(editando, data)
      }
    } else {
      const { data, error } = await supabase
        .from('clientes')
        .insert([cleanData])
        .select('*, membresia:tipos_membresia(nombre)')
        .single()

      if (!error && data) {
        addClienteLocal(data)
      }
    }

    setShowModal(false)
    setEditando(null)
    setFormData({
      nombre: '',
      cedula: '',
      telefono: '',
      correo: '',
      placa: '',
      moto: '',
      membresia_id: '',
      fecha_inicio_membresia: null,
      fecha_fin_membresia: null,
      estado: 'Activo'
    })
  }

  const parseFecha = (str) => str ? new Date(str + 'T00:00:00') : null

  const handleEdit = (cliente) => {
    setEditando(cliente.id)
    setFormData({
      nombre: cliente.nombre || '',
      cedula: cliente.cedula || '',
      telefono: cliente.telefono || '',
      correo: cliente.correo || '',
      placa: cliente.placa || '',
      moto: cliente.moto || '',
      membresia_id: cliente.membresia_id || '',
      fecha_inicio_membresia: parseFecha(cliente.fecha_inicio_membresia),
      fecha_fin_membresia: parseFecha(cliente.fecha_fin_membresia),
      estado: cliente.estado || 'Activo'
    })
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (confirm('¿Estás seguro de eliminar este cliente?')) {
      const { error } = await supabase.from('clientes').delete().eq('id', id)
      if (!error) {
        deleteClienteLocal(id)
      }
    }
  }

  const aplicarFiltroRapido = (tipo) => {
    setFiltroRapido(tipo)
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    switch (tipo) {
      case 'hoy':
        setFechaDesde(hoy)
        setFechaHasta(hoy)
        break
      case 'semana': {
        const inicioSemana = new Date(hoy)
        const diaS = hoy.getDay()
        inicioSemana.setDate(hoy.getDate() - (diaS === 0 ? 6 : diaS - 1))
        const finSemana = new Date(inicioSemana)
        finSemana.setDate(inicioSemana.getDate() + 6)
        setFechaDesde(inicioSemana)
        setFechaHasta(finSemana)
        break
      }
      case 'mes': {
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
        const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
        setFechaDesde(inicioMes)
        setFechaHasta(finMes)
        break
      }
      case 'año': {
        const inicioAño = new Date(hoy.getFullYear(), 0, 1)
        const finAño = new Date(hoy.getFullYear(), 11, 31)
        setFechaDesde(inicioAño)
        setFechaHasta(finAño)
        break
      }
      case 'todas':
        setFechaDesde(null)
        setFechaHasta(null)
        break
      default:
        break
    }
  }

  const getEstadoCliente = (cliente) => {
    if (!cliente.fecha_inicio_membresia || !cliente.fecha_fin_membresia) return 'Inactivo'
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const inicio = new Date(cliente.fecha_inicio_membresia + 'T00:00:00')
    const fin = new Date(cliente.fecha_fin_membresia + 'T00:00:00')
    return hoy >= inicio && hoy <= fin ? 'Activo' : 'Inactivo'
  }

  const clientesFiltrados = clientes.filter(c => {
    const matchSearch = c.nombre?.toLowerCase().includes(search.toLowerCase()) ||
      c.placa?.toLowerCase().includes(search.toLowerCase()) ||
      c.cedula?.includes(search) ||
      c.telefono?.includes(search)
    const matchTipo = !filtroTipoCliente || c.membresia_id === filtroTipoCliente
    const matchEstado = !filtroEstado || getEstadoCliente(c) === filtroEstado

    let matchFechaDesde = true
    let matchFechaHasta = true
    if (c.fecha_fin_membresia) {
      const venc = new Date(c.fecha_fin_membresia + 'T00:00:00')
      if (fechaDesde) {
        const desde = new Date(fechaDesde)
        desde.setHours(0, 0, 0, 0)
        matchFechaDesde = venc >= desde
      }
      if (fechaHasta) {
        const hasta = new Date(fechaHasta)
        hasta.setHours(23, 59, 59, 999)
        matchFechaHasta = venc <= hasta
      }
    } else {
      if (fechaDesde || fechaHasta) {
        matchFechaDesde = false
      }
    }

    return matchSearch && matchTipo && matchEstado && matchFechaDesde && matchFechaHasta
  })

  if (loading) {
    return <div className="loading">Cargando...</div>
  }

  return (
    <div className="clientes-page">
      <div className="page-header">
        <h1 className="page-title">Clientes <span className="total-hoy">({clientesFiltrados.length})</span></h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={20} />
          Nuevo Cliente
        </button>
      </div>

      <div className="filters">
        <div className="search-box">
          <Search size={20} />
          <input
            type="text"
            placeholder="Buscar por nombre, placa, cédula o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={filtroTipoCliente}
          onChange={(e) => setFiltroTipoCliente(e.target.value)}
          className="filter-select"
        >
          <option value="">Todos los tipos</option>
          {tiposMembresia.map(m => (
            <option key={m.id} value={m.id}>{m.nombre}</option>
          ))}
        </select>
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="filter-select"
        >
          <option value="">Todos</option>
          <option value="Activo">Activo</option>
          <option value="Inactivo">Inactivo</option>
        </select>
        <div className="filter-rapido">
          <button className={`filter-btn ${filtroRapido === 'hoy' ? 'active' : ''}`} onClick={() => aplicarFiltroRapido('hoy')}>Hoy</button>
          <button className={`filter-btn ${filtroRapido === 'semana' ? 'active' : ''}`} onClick={() => aplicarFiltroRapido('semana')}>Semana</button>
          <button className={`filter-btn ${filtroRapido === 'mes' ? 'active' : ''}`} onClick={() => aplicarFiltroRapido('mes')}>Mes</button>
          <button className={`filter-btn ${filtroRapido === 'año' ? 'active' : ''}`} onClick={() => aplicarFiltroRapido('año')}>Año</button>
          <button className={`filter-btn ${filtroRapido === 'todas' ? 'active' : ''}`} onClick={() => aplicarFiltroRapido('todas')}>Todas</button>
        </div>

        <div className="filter-fechas">
          <DatePicker
            selected={fechaDesde}
            onChange={(date) => setFechaDesde(date)}
            selectsStart
            startDate={fechaDesde}
            endDate={fechaHasta}
            placeholderText="Desde"
            className="filter-date"
            dateFormat="dd/MM/yyyy"
            locale="es"
            isClearable
          />
          <span className="filter-separator">→</span>
          <DatePicker
            selected={fechaHasta}
            onChange={(date) => setFechaHasta(date)}
            selectsEnd
            startDate={fechaDesde}
            endDate={fechaHasta}
            minDate={fechaDesde}
            placeholderText="Hasta"
            className="filter-date"
            dateFormat="dd/MM/yyyy"
            locale="es"
            isClearable
          />
        </div>
      </div>

      <div className="card">
        <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Placa</th>
              <th>Teléfono</th>
              <th>Tipo de Cliente</th>
              <th>Vencimiento</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clientesFiltrados.map((cliente) => (
              <tr key={cliente.id}>
                <td>
                  <div className="cliente-cell">
                    <span className="cliente-nombre">{cliente.nombre}</span>
                    <span className="cliente-fecha">{cliente.moto}</span>
                  </div>
                </td>
                <td>{cliente.placa}</td>
                <td>{cliente.telefono}</td>
                <td>{cliente.membresia?.nombre || 'Sin tipo'}</td>
                <td>{cliente.fecha_fin_membresia || '-'}</td>
                <td>
                  {(() => {
                    const estado = getEstadoCliente(cliente)
                    return (
                      <span className={`estado-badge ${estado === 'Activo' ? 'activo' : 'vencido'}`}>
                        {estado}
                      </span>
                    )
                  })()}
                </td>
                <td>
                  <div className="acciones">
                    <button className="btn-icon" onClick={() => handleEdit(cliente)}>
                      <Edit size={18} />
                    </button>
                    <button className="btn-icon delete" onClick={() => handleDelete(cliente.id)}>
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {clientesFiltrados.length === 0 && (
              <tr>
                <td colSpan="7" className="empty">No hay clientes registrados</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>{editando ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
              <button className="btn-close" onClick={() => { setShowModal(false); setEditando(null) }}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Nombre completo</label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Cédula</label>
                  <input
                    type="text"
                    value={formData.cedula}
                    onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Teléfono</label>
                  <input
                    type="text"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Correo</label>
                  <input
                    type="email"
                    value={formData.correo}
                    onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Placa</label>
                  <input
                    type="text"
                    value={formData.placa}
                    onChange={(e) => setFormData({ ...formData, placa: e.target.value.toUpperCase() })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Moto</label>
                  <input
                    type="text"
                    value={formData.moto}
                    onChange={(e) => setFormData({ ...formData, moto: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Tipo de Cliente</label>
                  <select
                    value={formData.membresia_id}
                    onChange={(e) => handleMembresiaChange(e.target.value)}
                  >
                    <option value="">Seleccionar</option>
                    {tiposMembresia.map(m => (
                      <option key={m.id} value={m.id}>{m.nombre}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Estado</label>
                  <select
                    value={formData.estado}
                    onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                  >
                    <option value="Activo">Activo</option>
                    <option value="No Activo">No Activo</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Fecha inicio</label>
                  <DatePicker
                    selected={formData.fecha_inicio_membresia}
                    onChange={(date) => setFormData({ ...formData, fecha_inicio_membresia: date })}
                    dateFormat="dd/MM/yyyy"
                    locale="es"
                    isClearable
                    placeholderText="Seleccionar fecha"
                  />
                </div>

                <div className="form-group">
                  <label>Fecha fin</label>
                  <DatePicker
                    selected={formData.fecha_fin_membresia}
                    onChange={(date) => setFormData({ ...formData, fecha_fin_membresia: date })}
                    dateFormat="dd/MM/yyyy"
                    locale="es"
                    isClearable
                    placeholderText="Seleccionar fecha"
                    minDate={formData.fecha_inicio_membresia}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => { setShowModal(false); setEditando(null) }}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  {editando ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
