import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useData } from './DataContext'
import { Plus, Search, X, Trash2, ChevronDown, SlidersHorizontal } from 'lucide-react'
import Select from 'react-select'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { registerLocale } from 'react-datepicker'
import es from 'date-fns/locale/es'

registerLocale('es', es)

export default function Membresias() {
  const { clientes, tiposMembresia, metodosPago, loading, updateClienteLocal, addClienteLocal, negocioId } = useData()

  const [pagos, setPagos] = useState([])
  const [loadingPagos, setLoadingPagos] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [searchCliente, setSearchCliente] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [fechaDesde, setFechaDesde] = useState(null)
  const [fechaHasta, setFechaHasta] = useState(null)
  const [filtroRapido, setFiltroRapido] = useState('')

  const [formData, setFormData] = useState({
    cliente_id: '',
    membresia_id: '',
    metodo_pago_id: '',
    valor: 0,
    fecha_activacion: new Date()
  })

  const [expandedCard, setExpandedCard] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [eliminarId, setEliminarId] = useState(null)
  const [password, setPassword] = useState('')
  const [errorPassword, setErrorPassword] = useState('')
  const [nuevoCliente, setNuevoCliente] = useState(false)
  const [clienteData, setClienteData] = useState({
    nombre: '',
    placa: '',
    telefono: '',
    cedula: '',
    moto: ''
  })

  const fetchPagos = async () => {
    const { data } = await supabase
      .from('transacciones')
      .select('*, metodo_pago:metodos_pago(nombre)')
      .eq('categoria', 'MEMBRESIA')
      .order('fecha', { ascending: false })
    setPagos(data || [])
  }

  useEffect(() => {
    fetchPagos()
  }, [])

  const fechaLocalStr = (date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const handleMembresiaSelect = (membresiaId) => {
    const membresia = tiposMembresia.find(m => m.id === membresiaId)
    setFormData(prev => ({
      ...prev,
      membresia_id: membresiaId,
      valor: membresia?.precio || 0
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const membresia = tiposMembresia.find(m => m.id === formData.membresia_id)
    if (!membresia) return

    const activacion = formData.fecha_activacion || new Date()
    const meses = membresia.duracion_dias || 1

    const sumarMeses = (fecha, n) => {
      const resultado = new Date(fecha)
      resultado.setMonth(resultado.getMonth() + n)
      return resultado
    }

    const calcularFechas = (clienteExistente) => {
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)

      // Si el cliente está activo, mantener fecha_inicio original
      if (clienteExistente?.fecha_inicio_membresia && clienteExistente?.fecha_fin_membresia) {
        const finActual = new Date(clienteExistente.fecha_fin_membresia + 'T00:00:00')
        if (finActual >= hoy) {
          const nuevaFin = sumarMeses(activacion, meses)
          return {
            fecha_inicio_membresia: clienteExistente.fecha_inicio_membresia,
            fecha_fin_membresia: fechaLocalStr(nuevaFin)
          }
        }
      }

      // Cliente inactivo o nuevo: fechas normales
      const fin = sumarMeses(activacion, meses)
      return {
        fecha_inicio_membresia: fechaLocalStr(activacion),
        fecha_fin_membresia: fechaLocalStr(fin)
      }
    }

    let clienteId = formData.cliente_id
    let clienteNombre = ''
    let clientePlaca = ''

    if (nuevoCliente) {
      const cleanCliente = Object.fromEntries(
        Object.entries(clienteData).map(([k, v]) => [k, v === '' ? null : v])
      )

      // Buscar si ya existe un cliente con esa placa
      const clienteExistente = clientes.find(c => c.placa?.toLowerCase() === clienteData.placa?.toLowerCase())

      if (clienteExistente) {
        const fechas = calcularFechas(clienteExistente)
        const { data: actualizado } = await supabase
          .from('clientes')
          .update({
            ...cleanCliente,
            membresia_id: formData.membresia_id,
            ...fechas
          })
          .eq('id', clienteExistente.id)
          .select('*, membresia:tipos_membresia(nombre)')
          .single()

        if (actualizado) {
          updateClienteLocal(clienteExistente.id, actualizado)
          clienteId = actualizado.id
          clienteNombre = actualizado.nombre
          clientePlaca = actualizado.placa || ''
        }
      } else {
        // Crear cliente nuevo
        const fechas = calcularFechas(null)
        const { data: nuevoC, error } = await supabase
          .from('clientes')
          .insert([{
            ...cleanCliente,
            membresia_id: formData.membresia_id,
            ...fechas,
            estado: 'Activo',
            negocio_id: negocioId
          }])
          .select('*, membresia:tipos_membresia(nombre)')
          .single()

        if (error || !nuevoC) {
          alert('Error al crear cliente: ' + (error?.message || ''))
          return
        }

        addClienteLocal(nuevoC)
        clienteId = nuevoC.id
        clienteNombre = nuevoC.nombre
        clientePlaca = nuevoC.placa || ''
      }
    } else {
      const cliente = clientes.find(c => c.id === clienteId)
      if (!cliente) return

      clienteNombre = cliente.nombre
      clientePlaca = cliente.placa || ''

      const fechas = calcularFechas(cliente)
      const { data: clienteActualizado } = await supabase
        .from('clientes')
        .update({
          membresia_id: formData.membresia_id,
          ...fechas
        })
        .eq('id', clienteId)
        .select('*, membresia:tipos_membresia(nombre)')
        .single()

      if (clienteActualizado) {
        updateClienteLocal(clienteId, clienteActualizado)
      }
    }

    // Crear transacción de ingreso
    await supabase.from('transacciones').insert([{
      tipo: 'INGRESO',
      valor: formData.valor,
      categoria: 'MEMBRESIA',
      metodo_pago_id: formData.metodo_pago_id || null,
      placa_o_persona: `${clienteNombre} - ${clientePlaca}`,
      descripcion: `Pago membresía ${membresia.nombre}`,
      fecha: fechaLocalStr(new Date()) + 'T12:00:00-05:00',
      negocio_id: negocioId
    }])

    setShowModal(false)
    setNuevoCliente(false)
    setClienteData({ nombre: '', placa: '', telefono: '', cedula: '', moto: '' })
    setFormData({ cliente_id: '', membresia_id: '', metodo_pago_id: '', valor: 0, fecha_activacion: new Date() })
    fetchPagos()
  }

  const handleEliminarPago = (pagoId) => {
    setEliminarId(pagoId)
    setPassword('')
    setErrorPassword('')
  }

  const confirmarEliminacion = async () => {
    // Verificar contraseña
    const { data: { session } } = await supabase.auth.getSession()
    const email = session?.user?.email
    if (!email) return

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setErrorPassword('Contraseña incorrecta')
      return
    }

    const pago = pagos.find(p => p.id === eliminarId)
    if (pago) {
      // Buscar cliente por placa_o_persona y revertir membresía a SIN MEMBRESIA
      const placa = pago.placa_o_persona?.split(' - ')[1]?.trim()
      const clienteAfectado = clientes.find(c => c.placa?.toLowerCase() === placa?.toLowerCase())

      if (clienteAfectado) {
        const sinMembresia = tiposMembresia.find(m => m.nombre.toLowerCase().includes('sin '))
        const hoy = fechaLocalStr(new Date())

        const { data: revertido } = await supabase
          .from('clientes')
          .update({
            membresia_id: sinMembresia?.id || null,
            fecha_inicio_membresia: hoy,
            fecha_fin_membresia: hoy
          })
          .eq('id', clienteAfectado.id)
          .select('*, membresia:tipos_membresia(nombre)')
          .single()

        if (revertido) {
          updateClienteLocal(clienteAfectado.id, revertido)
        }
      }

      await supabase.from('transacciones').delete().eq('id', eliminarId)
      fetchPagos()
    }

    setEliminarId(null)
    setPassword('')
    setErrorPassword('')
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

  const formatMoney = (value) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value)
  }

  const pagosFiltrados = pagos.filter(p => {
    const matchSearch = !searchCliente ||
      p.placa_o_persona?.toLowerCase().includes(searchCliente.toLowerCase()) ||
      p.descripcion?.toLowerCase().includes(searchCliente.toLowerCase())
    const matchTipo = !filtroTipo ||
      p.descripcion?.toLowerCase().includes(tiposMembresia.find(t => t.id === filtroTipo)?.nombre?.toLowerCase() || '')

    const fechaStr = p.fecha?.split('T')[0]
    const fechaPago = fechaStr ? new Date(fechaStr + 'T00:00:00') : new Date(p.fecha)
    fechaPago.setHours(0, 0, 0, 0)

    let matchFechaDesde = true
    if (fechaDesde) {
      const desde = new Date(fechaDesde)
      desde.setHours(0, 0, 0, 0)
      matchFechaDesde = fechaPago >= desde
    }

    let matchFechaHasta = true
    if (fechaHasta) {
      const hasta = new Date(fechaHasta)
      hasta.setHours(23, 59, 59, 999)
      matchFechaHasta = fechaPago <= hasta
    }

    return matchSearch && matchTipo && matchFechaDesde && matchFechaHasta
  })

  const totalFiltrado = pagosFiltrados.reduce((sum, p) => sum + Number(p.valor || 0), 0)

  if (loading) {
    return <div className="loading">Cargando...</div>
  }

  return (
    <div className="lavadas-page">
      <div className="page-header">
        <h1 className="page-title">Membresías <span className="total-hoy">({pagosFiltrados.length} - {formatMoney(totalFiltrado)})</span></h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={20} />
          Registrar Pago
        </button>
      </div>

      <div className="filters">
        <div className="filters-row-main">
          <div className="search-box">
            <Search size={18} />
            <input
              type="text"
              placeholder="Buscar por cliente o placa..."
              value={searchCliente}
              onChange={(e) => setSearchCliente(e.target.value)}
            />
          </div>
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="filter-select"
          >
            <option value="">Tipo</option>
            {tiposMembresia.map(m => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </select>
          <button
            className={`filter-toggle-btn ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(prev => !prev)}
            title="Más filtros"
          >
            <SlidersHorizontal size={18} />
          </button>
        </div>

        <div className={`filters-row-extra ${showFilters ? 'open' : ''}`}>
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
      </div>

      {/* Desktop: tabla */}
      <div className="card membresias-tabla-desktop">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th className="th-eliminar"></th>
                <th>Cliente</th>
                <th>Tipo Membresía</th>
                <th>Valor</th>
                <th>Método de Pago</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {pagosFiltrados.map((pago) => (
                <tr key={pago.id} className="fila-lavada">
                  <td className="celda-eliminar">
                    <button
                      className="btn-eliminar"
                      onClick={() => handleEliminarPago(pago.id)}
                      title="Eliminar pago"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                  <td>{pago.placa_o_persona}</td>
                  <td>{pago.descripcion?.replace('Pago membresía ', '')}</td>
                  <td className="valor-cell">{formatMoney(pago.valor)}</td>
                  <td>{pago.metodo_pago?.nombre || '-'}</td>
                  <td>{(() => {
                    const f = pago.fecha?.split('T')[0]
                    if (!f) return '-'
                    const [y, m, d] = f.split('-')
                    return `${d}/${m}/${y}`
                  })()}</td>
                </tr>
              ))}
              {pagosFiltrados.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty">No hay pagos de membresía registrados</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile: cards */}
      <div className="membresias-cards-mobile">
        {pagosFiltrados.map(pago => {
          const isExpanded = expandedCard === pago.id
          const fechaStr = (() => {
            const f = pago.fecha?.split('T')[0]
            if (!f) return '-'
            const [y, m, d] = f.split('-')
            return `${d}/${m}/${y}`
          })()
          return (
            <div key={pago.id} className={`cliente-card ${isExpanded ? 'expanded' : ''}`}>
              <div className="cliente-card-header" onClick={() => setExpandedCard(isExpanded ? null : pago.id)}>
                <div className="cliente-card-left">
                  <span className="cliente-card-nombre">{pago.placa_o_persona}</span>
                  <span className="cliente-card-placa">{pago.descripcion?.replace('Pago membresía ', '')}</span>
                </div>
                <div className="cliente-card-right">
                  <span className="cliente-card-valor">{formatMoney(pago.valor)}</span>
                  <ChevronDown size={16} className={`cliente-card-chevron ${isExpanded ? 'rotated' : ''}`} />
                </div>
              </div>
              {isExpanded && (
                <div className="cliente-card-body">
                  <div className="cliente-card-row">
                    <span className="cliente-card-label">Método</span>
                    <span className="cliente-card-value">{pago.metodo_pago?.nombre || '-'}</span>
                  </div>
                  <div className="cliente-card-row">
                    <span className="cliente-card-label">Fecha</span>
                    <span className="cliente-card-value">{fechaStr}</span>
                  </div>
                  <div className="cliente-card-actions">
                    <button className="btn-secondary btn-danger-outline" onClick={() => handleEliminarPago(pago.id)}>
                      <Trash2 size={16} /> Eliminar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {pagosFiltrados.length === 0 && (
          <div className="clientes-cards-empty">No hay pagos de membresía registrados</div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Registrar Pago de Membresía</h2>
              <button className="btn-close" onClick={() => setShowModal(false)}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label style={{ margin: 0 }}>Cliente</label>
                    <button
                      type="button"
                      className="btn-link"
                      onClick={() => {
                        setNuevoCliente(!nuevoCliente)
                        setFormData(prev => ({ ...prev, cliente_id: '' }))
                        setClienteData({ nombre: '', placa: '', telefono: '', cedula: '', moto: '' })
                      }}
                    >
                      {nuevoCliente ? 'Seleccionar existente' : '+ Nuevo cliente'}
                    </button>
                  </div>
                  {!nuevoCliente ? (
                    <Select
                      value={clientes.filter(c => c.id === formData.cliente_id).map(c => ({ value: c.id, label: `${c.nombre} - ${c.placa}` }))[0] || null}
                      onChange={(opt) => setFormData({ ...formData, cliente_id: opt?.value || '' })}
                      options={clientes.map(c => ({ value: c.id, label: `${c.nombre} - ${c.placa}` }))}
                      placeholder="Buscar cliente..."
                      isClearable
                      noOptionsMessage={() => 'Sin resultados'}
                      styles={{
                        control: (base) => ({ ...base, background: 'var(--bg-hover)', borderColor: 'var(--border-color)', color: 'var(--text-primary)', minHeight: '42px' }),
                        menu: (base) => ({ ...base, background: 'var(--bg-card)', border: '1px solid var(--border-color)' }),
                        option: (base, state) => ({ ...base, background: state.isFocused ? 'var(--bg-hover)' : 'transparent', color: 'var(--text-primary)' }),
                        singleValue: (base) => ({ ...base, color: 'var(--text-primary)' }),
                        input: (base) => ({ ...base, color: 'var(--text-primary)' }),
                        placeholder: (base) => ({ ...base, color: 'var(--text-secondary)' }),
                      }}
                    />
                  ) : (
                    <div className="form-grid" style={{ gap: '0.75rem' }}>
                      <div className="form-group">
                        <label>Nombre</label>
                        <input
                          type="text"
                          value={clienteData.nombre}
                          onChange={(e) => setClienteData({ ...clienteData, nombre: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Placa</label>
                        <input
                          type="text"
                          value={clienteData.placa}
                          onChange={(e) => setClienteData({ ...clienteData, placa: e.target.value.toUpperCase() })}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Teléfono</label>
                        <input
                          type="text"
                          value={clienteData.telefono}
                          onChange={(e) => setClienteData({ ...clienteData, telefono: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Cédula</label>
                        <input
                          type="text"
                          value={clienteData.cedula}
                          onChange={(e) => setClienteData({ ...clienteData, cedula: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>Tipo de Membresía</label>
                  <select
                    value={formData.membresia_id}
                    onChange={(e) => handleMembresiaSelect(e.target.value)}
                    required
                  >
                    <option value="">Seleccionar membresía</option>
                    {tiposMembresia.filter(m => !m.nombre.toLowerCase().includes('sin ')).map(m => (
                      <option key={m.id} value={m.id}>{m.nombre} - {formatMoney(m.precio)}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Método de Pago</label>
                  <select
                    value={formData.metodo_pago_id}
                    onChange={(e) => setFormData({ ...formData, metodo_pago_id: e.target.value })}
                  >
                    <option value="">Seleccionar método</option>
                    {metodosPago.map(m => (
                      <option key={m.id} value={m.id}>{m.nombre}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Valor</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formData.valor === 0 ? '' : formData.valor}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '')
                      setFormData({ ...formData, valor: val === '' ? 0 : Number(val) })
                    }}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Fecha de activación</label>
                  <DatePicker
                    selected={formData.fecha_activacion}
                    onChange={(date) => setFormData({ ...formData, fecha_activacion: date })}
                    dateFormat="dd/MM/yyyy"
                    locale="es"
                    placeholderText="Seleccionar fecha"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Registrar Pago
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {eliminarId && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>Confirmar eliminación</h2>
              <button className="btn-close" onClick={() => { setEliminarId(null); setPassword(''); setErrorPassword('') }}>
                <X size={24} />
              </button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Se eliminará el pago y se revertirá la membresía del cliente. Ingresa tu contraseña para confirmar.
              </p>
              <div className="form-group">
                <label>Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrorPassword('') }}
                  onKeyDown={(e) => { if (e.key === 'Enter') confirmarEliminacion() }}
                  placeholder="Ingresa tu contraseña"
                  autoFocus
                />
                {errorPassword && <span style={{ color: 'var(--accent-red)', fontSize: '0.85rem', marginTop: '0.5rem', display: 'block' }}>{errorPassword}</span>}
              </div>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'center', alignItems: 'center', paddingBottom: '1.5rem' }}>
              <button type="button" className="btn-secondary" onClick={() => { setEliminarId(null); setPassword(''); setErrorPassword('') }}>
                Cancelar
              </button>
              <button type="button" className="btn-primary" style={{ background: 'var(--accent-red)' }} onClick={confirmarEliminacion}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
