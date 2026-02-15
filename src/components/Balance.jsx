import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { useData } from './DataContext'
import { Plus, X, TrendingUp, TrendingDown, Search, Trash2, Pencil, Check, SlidersHorizontal, ChevronDown } from 'lucide-react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { registerLocale } from 'react-datepicker'
import es from 'date-fns/locale/es'
import { formatMoney } from '../utils/money'

registerLocale('es', es)

export default function Balance() {
  const { metodosPago: metodosPagoConfig, lavadas, negocioId } = useData()

  const [transacciones, setTransacciones] = useState([])
  const [showModal, setShowModal] = useState(false)
  // Filtros - cargar desde localStorage
  const loadBalanceFilters = () => {
    try {
      const saved = localStorage.getItem('monaco_balance_filters')
      if (saved) {
        const f = JSON.parse(saved)
        return {
          tipo: f.tipo || '',
          categoria: f.categoria || '',
          metodo: f.metodo || '',
          desde: f.desde ? new Date(f.desde) : null,
          hasta: f.hasta ? new Date(f.hasta) : null,
          rapido: f.rapido || '',
        }
      }
    } catch {}
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
    return { tipo: '', categoria: '', metodo: '', desde: inicioMes, hasta: finMes, rapido: 'mes' }
  }

  const filtrosIniciales = useRef(loadBalanceFilters()).current

  const [searchText, setSearchText] = useState('')
  const [filtroTipo, setFiltroTipo] = useState(filtrosIniciales.tipo)
  const [filtroCategoria, setFiltroCategoria] = useState(filtrosIniciales.categoria)
  const [filtroMetodo, setFiltroMetodo] = useState(filtrosIniciales.metodo)
  const [fechaDesde, setFechaDesde] = useState(filtrosIniciales.desde)
  const [fechaHasta, setFechaHasta] = useState(filtrosIniciales.hasta)
  const [filtroRapido, setFiltroRapido] = useState(filtrosIniciales.rapido)
  const [showFilters, setShowFilters] = useState(false)
  const [expandedCard, setExpandedCard] = useState(null)

  // Eliminar
  const [eliminarId, setEliminarId] = useState(null)
  const [password, setPassword] = useState('')
  const [errorPassword, setErrorPassword] = useState('')

  // Editar transacción completa
  const [editandoId, setEditandoId] = useState(null)
  const [editData, setEditData] = useState(null)

  const [formData, setFormData] = useState({
    tipo: 'INGRESO',
    valor: '',
    categoria: '',
    metodo_pago_id: '',
    placa_o_persona: '',
    descripcion: '',
    fecha: fechaLocalStr(new Date())
  })

  const categorias = {
    INGRESO: ['MEMBRESIA', 'SERVICIO', 'ADICIONAL', 'OTRO'],
    EGRESO: ['INSUMOS', 'SERVICIOS', 'ABONO A SUELDO', 'ARRIENDO', 'PAGO TRABAJADOR', 'OTRO']
  }

  const todasCategorias = [...new Set([...categorias.INGRESO, ...categorias.EGRESO])]

  function fechaLocalStr(date) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  // Guardar filtros en localStorage cuando cambien
  useEffect(() => {
    localStorage.setItem('monaco_balance_filters', JSON.stringify({
      tipo: filtroTipo,
      categoria: filtroCategoria,
      metodo: filtroMetodo,
      desde: fechaDesde ? fechaDesde.toISOString() : null,
      hasta: fechaHasta ? fechaHasta.toISOString() : null,
      rapido: filtroRapido,
    }))
  }, [filtroTipo, filtroCategoria, filtroMetodo, fechaDesde, fechaHasta, filtroRapido])

  useEffect(() => {
    fetchData()
  }, [fechaDesde, fechaHasta])

  const fetchData = async () => {
    let query = supabase
      .from('transacciones')
      .select('*, metodo_pago:metodos_pago(nombre)')
      .order('fecha', { ascending: false })

    if (fechaDesde) {
      query = query.gte('fecha', fechaLocalStr(fechaDesde))
    }
    if (fechaHasta) {
      const hasta = new Date(fechaHasta)
      hasta.setDate(hasta.getDate() + 1)
      query = query.lt('fecha', fechaLocalStr(hasta))
    }

    const { data: transaccionesData } = await query

    setTransacciones(transaccionesData || [])
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

  // Generar entradas virtuales desde pagos de lavadas
  const pagosLavadas = lavadas.flatMap(l => {
    const pagos = l.pagos || []
    if (pagos.length === 0) return []

    const fechaLavada = new Date(l.fecha)
    fechaLavada.setHours(0, 0, 0, 0)

    let dentroDeRango = true
    if (fechaDesde) {
      const desde = new Date(fechaDesde)
      desde.setHours(0, 0, 0, 0)
      if (fechaLavada < desde) dentroDeRango = false
    }
    if (fechaHasta) {
      const hasta = new Date(fechaHasta)
      hasta.setHours(23, 59, 59, 999)
      if (fechaLavada > hasta) dentroDeRango = false
    }
    if (!dentroDeRango) return []

    return pagos.map((p, idx) => ({
      id: `lavada-${l.id}-${idx}`,
      tipo: 'INGRESO',
      categoria: 'SERVICIO',
      valor: p.valor || 0,
      metodo_pago_id: p.metodo_pago_id,
      metodo_pago: { nombre: p.nombre },
      placa_o_persona: l.placa,
      descripcion: `${l.cliente?.nombre || ''} - ${l.placa}`,
      fecha: l.fecha,
      _esLavada: true
    }))
  })

  // Filtrado local
  const todasEntradas = [...transacciones, ...pagosLavadas]

  const transaccionesFiltradas = todasEntradas.filter(t => {
    const matchTipo = !filtroTipo || t.tipo === filtroTipo
    const matchCategoria = !filtroCategoria || t.categoria === filtroCategoria
    const matchMetodo = !filtroMetodo || t.metodo_pago_id == filtroMetodo
    const matchSearch = !searchText ||
      t.placa_o_persona?.toLowerCase().includes(searchText.toLowerCase()) ||
      t.descripcion?.toLowerCase().includes(searchText.toLowerCase()) ||
      t.categoria?.toLowerCase().includes(searchText.toLowerCase())

    return matchTipo && matchCategoria && matchMetodo && matchSearch
  })

  const ingresosFiltrados = transaccionesFiltradas.filter(t => t.tipo === 'INGRESO').reduce((sum, t) => sum + Number(t.valor), 0)
  const egresosFiltrados = transaccionesFiltradas.filter(t => t.tipo === 'EGRESO').reduce((sum, t) => sum + Number(t.valor), 0)
  const balanceFiltrado = ingresosFiltrados - egresosFiltrados

  const resumenPorMetodo = metodosPagoConfig.map(metodo => {
    const total = transaccionesFiltradas.reduce((sum, t) => {
      if (t.metodo_pago_id == metodo.id) {
        return sum + (t.tipo === 'INGRESO' ? Number(t.valor) : -Number(t.valor))
      }
      return sum
    }, 0)
    return { id: metodo.id, nombre: metodo.nombre, total }
  })

  const sinMetodo = transaccionesFiltradas.reduce((sum, t) => {
    if (!t.metodo_pago_id) {
      return sum + (t.tipo === 'INGRESO' ? Number(t.valor) : -Number(t.valor))
    }
    return sum
  }, 0)

  const handleSubmit = async (e) => {
    e.preventDefault()

    await supabase.from('transacciones').insert([{
      ...formData,
      fecha: formData.fecha + 'T12:00:00-05:00',
      negocio_id: negocioId
    }])

    setShowModal(false)
    setFormData({
      tipo: 'INGRESO',
      valor: '',
      categoria: '',
      metodo_pago_id: '',
      placa_o_persona: '',
      descripcion: '',
      fecha: fechaLocalStr(new Date())
    })
    fetchData()
  }

  // Eliminar con contraseña
  const handleEliminar = (id) => {
    setEliminarId(id)
    setPassword('')
    setErrorPassword('')
  }

  const confirmarEliminacion = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const email = session?.user?.email
    if (!email) return

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setErrorPassword('Contraseña incorrecta')
      return
    }

    await supabase.from('transacciones').delete().eq('id', eliminarId)
    setEliminarId(null)
    setPassword('')
    setErrorPassword('')
    fetchData()
  }

  // Editar transacción completa
  const iniciarEdicion = (t) => {
    setEditandoId(t.id)
    setEditData({
      fecha: t.fecha?.split('T')[0] || fechaLocalStr(new Date()),
      tipo: t.tipo,
      categoria: t.categoria || '',
      placa_o_persona: t.placa_o_persona || '',
      descripcion: t.descripcion || '',
      metodo_pago_id: t.metodo_pago_id || '',
      valor: String(t.valor),
      valorDisplay: Number(t.valor).toLocaleString('es-CO'),
    })
  }

  const cancelarEdicion = () => {
    setEditandoId(null)
    setEditData(null)
  }

  const handleEditValorChange = (raw) => {
    const limpio = raw.replace(/[^\d]/g, '')
    if (limpio === '') {
      setEditData(prev => ({ ...prev, valor: '', valorDisplay: '' }))
      return
    }
    const num = Number(limpio)
    setEditData(prev => ({ ...prev, valor: String(num), valorDisplay: num.toLocaleString('es-CO') }))
  }

  const guardarEdicion = async (id) => {
    if (!editData) return
    const nuevoValor = Number(editData.valor)
    if (isNaN(nuevoValor) || nuevoValor < 0) return
    if (!editData.tipo || !editData.categoria || !editData.metodo_pago_id || !editData.fecha) return

    const updates = {
      fecha: editData.fecha + 'T12:00:00-05:00',
      tipo: editData.tipo,
      categoria: editData.categoria,
      placa_o_persona: editData.placa_o_persona,
      descripcion: editData.descripcion,
      metodo_pago_id: editData.metodo_pago_id,
      valor: nuevoValor,
    }

    await supabase.from('transacciones').update(updates).eq('id', id)
    setEditandoId(null)
    setEditData(null)
    fetchData()
  }


  const formatFecha = (fechaStr) => {
    const f = fechaStr?.split('T')[0]
    if (!f) return '-'
    const [y, m, d] = f.split('-')
    return `${d}/${m}/${y}`
  }

  return (
    <div className="balance-page">
      <div className="page-header">
        <h1 className="page-title">Balance</h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={20} />
          Nueva Transacción
        </button>
      </div>

      <div className="balance-resumen">
        <div className="resumen-card ingresos">
          <div className="left">
            <TrendingUp size={24} />
            <span className="label">Ingresos</span>
          </div>
          <span className="valor">{formatMoney(ingresosFiltrados)}</span>
        </div>
        <div className="resumen-card egresos">
          <div className="left">
            <TrendingDown size={24} />
            <span className="label">Egresos</span>
          </div>
          <span className="valor">{formatMoney(egresosFiltrados)}</span>
        </div>
        <div className={`resumen-card balance ${balanceFiltrado >= 0 ? 'positivo' : 'negativo'}`}>
          <div className="left">
            <TrendingUp size={24} />
            <span className="label">Balance</span>
          </div>
          <span className="valor">{formatMoney(balanceFiltrado)}</span>
        </div>
      </div>

      {/* Resumen por método de pago */}
      <div className="resumen-metodos">
        {resumenPorMetodo.map(m => (
          <div key={m.id} className="metodo-card">
            <span className="metodo-nombre">{m.nombre}</span>
            <span className={`metodo-valor ${m.total >= 0 ? 'positivo' : 'negativo'}`}>{formatMoney(m.total)}</span>
          </div>
        ))}
        {sinMetodo !== 0 && (
          <div className="metodo-card">
            <span className="metodo-nombre">Sin método</span>
            <span className={`metodo-valor ${sinMetodo >= 0 ? 'positivo' : 'negativo'}`}>{formatMoney(sinMetodo)}</span>
          </div>
        )}
      </div>

      <div className="filters">
        <div className="filters-row-main">
          <div className="search-box">
            <Search size={18} />
            <input
              type="text"
              placeholder="Buscar descripción, placa..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="filter-select"
          >
            <option value="">Tipo</option>
            <option value="INGRESO">Ingreso</option>
            <option value="EGRESO">Egreso</option>
          </select>
          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            className="filter-select"
          >
            <option value="">Categoría</option>
            {todasCategorias.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={filtroMetodo}
            onChange={(e) => setFiltroMetodo(e.target.value)}
            className="filter-select"
          >
            <option value="">Método</option>
            {metodosPagoConfig.map(m => (
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
              onChange={(date) => { setFechaDesde(date); setFiltroRapido('') }}
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
              onChange={(date) => { setFechaHasta(date); setFiltroRapido('') }}
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
      <div className="card balance-tabla-desktop">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th className="th-eliminar"></th>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Categoría</th>
                <th>Placa/Persona</th>
                <th>Descripción</th>
                <th>Método</th>
                <th>Valor</th>
                <th className="th-eliminar"></th>
              </tr>
            </thead>
            <tbody>
              {[...transaccionesFiltradas].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).map((t) => (
                editandoId === t.id && editData ? (
                  <tr key={t.id} className="fila-lavada fila-editando">
                    <td className="celda-eliminar">
                      <button className="btn-eliminar" onClick={cancelarEdicion} title="Cancelar" style={{ color: 'var(--accent-red)' }}>
                        <X size={16} />
                      </button>
                    </td>
                    <td>
                      <input
                        type="date"
                        value={editData.fecha}
                        onChange={(e) => setEditData(prev => ({ ...prev, fecha: e.target.value }))}
                        className="edit-inline-input"
                      />
                    </td>
                    <td>
                      <select
                        value={editData.tipo}
                        onChange={(e) => setEditData(prev => ({ ...prev, tipo: e.target.value, categoria: '' }))}
                        className="edit-inline-select"
                      >
                        <option value="INGRESO">INGRESO</option>
                        <option value="EGRESO">EGRESO</option>
                      </select>
                    </td>
                    <td>
                      <select
                        value={editData.categoria}
                        onChange={(e) => setEditData(prev => ({ ...prev, categoria: e.target.value }))}
                        className="edit-inline-select"
                      >
                        <option value="">Seleccionar</option>
                        {categorias[editData.tipo].map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        value={editData.placa_o_persona}
                        onChange={(e) => setEditData(prev => ({ ...prev, placa_o_persona: e.target.value }))}
                        className="edit-inline-input"
                        placeholder="Placa o persona"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={editData.descripcion}
                        onChange={(e) => setEditData(prev => ({ ...prev, descripcion: e.target.value }))}
                        className="edit-inline-input"
                        placeholder="Descripción"
                      />
                    </td>
                    <td>
                      <select
                        value={editData.metodo_pago_id}
                        onChange={(e) => setEditData(prev => ({ ...prev, metodo_pago_id: e.target.value }))}
                        className="edit-inline-select"
                      >
                        <option value="">Seleccionar</option>
                        {metodosPagoConfig.map(m => (
                          <option key={m.id} value={m.id}>{m.nombre}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        value={editData.valorDisplay}
                        onChange={(e) => handleEditValorChange(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') guardarEdicion(t.id); if (e.key === 'Escape') cancelarEdicion() }}
                        className="edit-inline-input edit-inline-valor"
                        placeholder="$0"
                        autoFocus
                      />
                    </td>
                    <td className="celda-eliminar">
                      <button className="btn-eliminar" onClick={() => guardarEdicion(t.id)} title="Guardar" style={{ color: 'var(--accent-green)' }}>
                        <Check size={16} />
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={t.id} className="fila-lavada">
                    <td className="celda-eliminar">
                      {!t._esLavada && (
                        <button className="btn-eliminar" onClick={() => handleEliminar(t.id)} title="Eliminar">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                    <td>{formatFecha(t.fecha)}</td>
                    <td>
                      <span className={`tipo-badge ${t.tipo.toLowerCase()}`}>
                        {t.tipo}
                      </span>
                    </td>
                    <td>{t.categoria}</td>
                    <td>{t.placa_o_persona || '-'}</td>
                    <td>{t.descripcion || '-'}</td>
                    <td>{t.metodo_pago?.nombre || '-'}</td>
                    <td className={t.tipo === 'INGRESO' ? 'valor-positivo' : 'valor-negativo'}>
                      <span>{t.tipo === 'EGRESO' ? '-' : ''}{formatMoney(t.valor)}</span>
                    </td>
                    <td className="celda-eliminar">
                      {!t._esLavada && (
                        <button className="btn-eliminar" onClick={() => iniciarEdicion(t)} title="Editar">
                          <Pencil size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              ))}
              {transaccionesFiltradas.length === 0 && (
                <tr>
                  <td colSpan="9" className="empty">No hay transacciones con estos filtros</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile: cards */}
      <div className="balance-cards-mobile">
        {[...transaccionesFiltradas].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).map(t => {
          const isExpanded = expandedCard === t.id
          const esIngreso = t.tipo === 'INGRESO'
          return (
            <div key={t.id} className={`balance-card ${esIngreso ? 'ingreso-border' : 'egreso-border'} ${isExpanded ? 'expanded' : ''}`}>
              <div className="balance-card-header" onClick={() => setExpandedCard(isExpanded ? null : t.id)}>
                <div className="balance-card-left">
                  <span className="balance-card-desc">{t.descripcion || t.categoria}</span>
                  <span className="balance-card-fecha">{formatFecha(t.fecha)}</span>
                </div>
                <div className="balance-card-right">
                  <span className={`balance-card-valor ${esIngreso ? 'positivo' : 'negativo'}`}>
                    {esIngreso ? '' : '-'}{formatMoney(t.valor)}
                  </span>
                  <ChevronDown size={16} className={`balance-card-chevron ${isExpanded ? 'rotated' : ''}`} />
                </div>
              </div>
              {isExpanded && (
                <div className="balance-card-body">
                  <div className="balance-card-row">
                    <span className="balance-card-label">Tipo</span>
                    <span className={`tipo-badge ${t.tipo.toLowerCase()}`}>{t.tipo}</span>
                  </div>
                  <div className="balance-card-row">
                    <span className="balance-card-label">Categoría</span>
                    <span className="balance-card-val">{t.categoria}</span>
                  </div>
                  <div className="balance-card-row">
                    <span className="balance-card-label">Placa/Persona</span>
                    <span className="balance-card-val">{t.placa_o_persona || '—'}</span>
                  </div>
                  <div className="balance-card-row">
                    <span className="balance-card-label">Método</span>
                    <span className="balance-card-val">{t.metodo_pago?.nombre || '—'}</span>
                  </div>
                  {!t._esLavada && (
                    <div className="balance-card-actions">
                      <button className="btn-secondary" onClick={() => iniciarEdicion(t)}>
                        <Pencil size={16} /> Editar
                      </button>
                      <button className="btn-secondary btn-danger-outline" onClick={() => handleEliminar(t.id)}>
                        <Trash2 size={16} /> Eliminar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {transaccionesFiltradas.length === 0 && (
          <div className="balance-cards-empty">No hay transacciones con estos filtros</div>
        )}
      </div>

      {/* Modal nueva transacción */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Nueva Transacción</h2>
              <button className="btn-close" onClick={() => setShowModal(false)}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Tipo</label>
                  <select
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value, categoria: '' })}
                    required
                  >
                    <option value="INGRESO">Ingreso</option>
                    <option value="EGRESO">Egreso</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Valor</label>
                  <input
                    type="number"
                    value={formData.valor}
                    onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Categoría</label>
                  <select
                    value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    required
                  >
                    <option value="">Seleccionar</option>
                    {categorias[formData.tipo].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Método de Pago</label>
                  <select
                    value={formData.metodo_pago_id}
                    onChange={(e) => setFormData({ ...formData, metodo_pago_id: e.target.value })}
                    required
                  >
                    <option value="">Seleccionar</option>
                    {metodosPagoConfig.map(m => (
                      <option key={m.id} value={m.id}>{m.nombre}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Fecha</label>
                  <DatePicker
                    selected={formData.fecha ? new Date(formData.fecha + 'T00:00:00') : null}
                    onChange={(date) => setFormData({ ...formData, fecha: date ? fechaLocalStr(date) : '' })}
                    dateFormat="dd/MM/yyyy"
                    locale="es"
                    placeholderText="Seleccionar fecha"
                    isClearable
                  />
                </div>

                <div className="form-group">
                  <label>Placa o Persona</label>
                  <input
                    type="text"
                    value={formData.placa_o_persona}
                    onChange={(e) => setFormData({ ...formData, placa_o_persona: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Descripción</label>
                <textarea
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  rows="2"
                ></textarea>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal confirmar eliminación */}
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
                Se eliminará esta transacción permanentemente. Ingresa tu contraseña para confirmar.
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
