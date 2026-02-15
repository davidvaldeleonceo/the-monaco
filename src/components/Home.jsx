import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useData } from './DataContext'
import { useServiceHandlers } from '../hooks/useServiceHandlers'
import ServiceCard from './ServiceCard'
import { formatMoney } from '../utils/money'
import { ESTADO_LABELS, ESTADO_CLASSES } from '../config/constants'
import { Plus, Droplets, DollarSign, X, Search } from 'lucide-react'

export default function Home() {
  const navigate = useNavigate()
  const { lavadas, metodosPago, negocioId, clientes } = useData()

  const {
    expandedCards, setExpandedCards,
    editingPago, setEditingPago,
    validationErrors, setValidationErrors,
    collapsingCards,
    updatingCards,
    smoothCollapse,
    getTimerProps,
    hasActiveTimer,
    getEstadoClass,
    handleEstadoChange,
    handleLavadorChange,
    handleTipoLavadoChangeInline,
    handlePagosChange,
    handleAdicionalChange,
    handleEliminarLavada,
    enviarWhatsApp,
    tiposLavado,
    serviciosAdicionales,
    lavadores,
    metodosPago: _mp,
  } = useServiceHandlers()

  const [periodo, setPeriodo] = useState(() => {
    return localStorage.getItem('home-periodo') || 'm'
  })
  const [tab, setTab] = useState('servicios')
  const [transacciones, setTransacciones] = useState([])
  const [showFabMenu, setShowFabMenu] = useState(false)
  const [showVentaModal, setShowVentaModal] = useState(false)
  const [ventaForm, setVentaForm] = useState({
    valor: '',
    descripcion: '',
    metodo_pago_id: '',
    categoria: 'MEMBRESIA',
    placa_o_persona: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [visibleCount, setVisibleCount] = useState({ servicios: 10, productos: 10, movimientos: 10 })
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef(null)

  // Bubble animation refs
  const pillRefs = useRef({})
  const [bubbleStyle, setBubbleStyle] = useState({})

  // Calculate date range from period
  const getDateRange = (p) => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    switch (p) {
      case 'd':
        return { desde: hoy, hasta: hoy }
      case 's': {
        const inicioSemana = new Date(hoy)
        const diaS = hoy.getDay()
        inicioSemana.setDate(hoy.getDate() - (diaS === 0 ? 6 : diaS - 1))
        const finSemana = new Date(inicioSemana)
        finSemana.setDate(inicioSemana.getDate() + 6)
        return { desde: inicioSemana, hasta: finSemana }
      }
      case 'm': {
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
        const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
        return { desde: inicioMes, hasta: finMes }
      }
      case 'a': {
        const inicioAño = new Date(hoy.getFullYear(), 0, 1)
        const finAño = new Date(hoy.getFullYear(), 11, 31)
        return { desde: inicioAño, hasta: finAño }
      }
      default:
        return { desde: null, hasta: null }
    }
  }

  function fechaLocalStr(date) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const { desde: fechaDesde, hasta: fechaHasta } = getDateRange(periodo)

  // Fetch transacciones when period changes
  useEffect(() => {
    const fetchTransacciones = async () => {
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

      const { data } = await query
      setTransacciones(data || [])
    }

    fetchTransacciones()
  }, [periodo])

  // Persist periodo to localStorage
  useEffect(() => {
    localStorage.setItem('home-periodo', periodo)
  }, [periodo])

  // Bubble animation
  useEffect(() => {
    const el = pillRefs.current[periodo]
    if (el) {
      const container = el.parentElement
      const containerRect = container.getBoundingClientRect()
      const pillRect = el.getBoundingClientRect()
      setBubbleStyle({
        width: pillRect.width,
        transform: `translateX(${pillRect.left - containerRect.left - 4}px)`
      })
    }
  }, [periodo])

  // Generate virtual entries from lavadas payments (same pattern as Balance.jsx)
  const pagosLavadas = lavadas.flatMap(l => {
    const pagos = l.pagos || []
    if (pagos.length === 0) return []

    const fechaLavada = new Date(l.fecha)
    fechaLavada.setHours(0, 0, 0, 0)

    let dentroDeRango = true
    if (fechaDesde) {
      const d = new Date(fechaDesde)
      d.setHours(0, 0, 0, 0)
      if (fechaLavada < d) dentroDeRango = false
    }
    if (fechaHasta) {
      const h = new Date(fechaHasta)
      h.setHours(23, 59, 59, 999)
      if (fechaLavada > h) dentroDeRango = false
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

  // Combine all entries for balance
  const todasEntradas = [...transacciones, ...pagosLavadas]
  const ingresos = todasEntradas.filter(t => t.tipo === 'INGRESO').reduce((sum, t) => sum + Number(t.valor), 0)
  const egresos = todasEntradas.filter(t => t.tipo === 'EGRESO').reduce((sum, t) => sum + Number(t.valor), 0)
  const balance = ingresos - egresos

  // Period label
  const periodoLabels = { d: 'Hoy', s: 'Esta semana', m: 'Este mes', a: 'Este año' }
  const periodoLabel = periodoLabels[periodo]

  // Filter lavadas by period for recent services
  const lavadasFiltradas = lavadas.filter(l => {
    const fechaL = new Date(l.fecha)
    fechaL.setHours(0, 0, 0, 0)
    if (fechaDesde && fechaL < fechaDesde) return false
    if (fechaHasta) {
      const h = new Date(fechaHasta)
      h.setHours(23, 59, 59, 999)
      if (fechaL > h) return false
    }
    return true
  })

  // Recent items
  const allServicios = lavadasFiltradas
  const allProductos = transacciones
    .filter(t => t.categoria === 'MEMBRESIA')
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
  const allMovimientos = todasEntradas
    .filter(t => !t._esLavada && t.categoria !== 'MEMBRESIA')
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))

  const recentServicios = allServicios.slice(0, visibleCount.servicios)
  const recentProductos = allProductos.slice(0, visibleCount.productos)
  const recentMovimientos = allMovimientos.slice(0, visibleCount.movimientos)

  const handleShowMore = (tab) => {
    setVisibleCount(prev => ({ ...prev, [tab]: prev[tab] + 10 }))
  }

  const handleShowLess = (tab) => {
    setVisibleCount(prev => ({ ...prev, [tab]: 10 }))
  }

  // Global search
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return null

    const matchClientes = (clientes || [])
      .filter(c => (c.nombre || '').toLowerCase().includes(q) || (c.placa || '').toLowerCase().includes(q))
      .slice(0, 5)

    const matchServicios = lavadas
      .filter(l => (l.placa || '').toLowerCase().includes(q) || (l.cliente?.nombre || '').toLowerCase().includes(q))
      .slice(0, 5)

    const matchMovimientos = [...transacciones, ...pagosLavadas]
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
      .filter(t =>
        (t.descripcion || '').toLowerCase().includes(q) ||
        (t.placa_o_persona || '').toLowerCase().includes(q) ||
        (t.categoria || '').toLowerCase().includes(q)
      )
      .slice(0, 5)

    return { clientes: matchClientes, servicios: matchServicios, movimientos: matchMovimientos }
  }, [searchQuery, clientes, lavadas, transacciones, pagosLavadas])

  const openSearch = () => {
    setShowSearch(true)
    setSearchQuery('')
    setTimeout(() => searchInputRef.current?.focus(), 100)
  }
  const closeSearch = () => {
    setShowSearch(false)
    setSearchQuery('')
  }
  const handleSearchNavigate = (path) => {
    closeSearch()
    navigate(path)
  }

  // Format relative date
  const formatFechaRelativa = (fechaStr) => {
    const fecha = new Date(fechaStr)
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const diff = Math.floor((hoy - fecha) / (1000 * 60 * 60 * 24))
    if (diff === 0) return 'Hoy'
    if (diff === 1) return 'Ayer'
    if (diff < 7) return `Hace ${diff} días`
    const d = fecha.getDate()
    const m = fecha.getMonth() + 1
    return `${d}/${m}`
  }

  // Nueva venta submit
  const handleVentaSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)

    const valor = Number(ventaForm.valor.replace(/[^\d]/g, ''))
    if (!valor || !ventaForm.metodo_pago_id) {
      setSubmitting(false)
      return
    }

    await supabase.from('transacciones').insert([{
      tipo: 'INGRESO',
      valor,
      categoria: ventaForm.categoria || 'OTRO',
      metodo_pago_id: ventaForm.metodo_pago_id,
      placa_o_persona: ventaForm.placa_o_persona,
      descripcion: ventaForm.descripcion,
      fecha: fechaLocalStr(new Date()) + 'T12:00:00-05:00',
      negocio_id: negocioId,
    }])

    setShowVentaModal(false)
    setVentaForm({ valor: '', descripcion: '', metodo_pago_id: '', categoria: 'MEMBRESIA', placa_o_persona: '' })
    setSubmitting(false)

    // Refresh transacciones
    let query = supabase
      .from('transacciones')
      .select('*, metodo_pago:metodos_pago(nombre)')
      .order('fecha', { ascending: false })
    if (fechaDesde) query = query.gte('fecha', fechaLocalStr(fechaDesde))
    if (fechaHasta) {
      const hasta = new Date(fechaHasta)
      hasta.setDate(hasta.getDate() + 1)
      query = query.lt('fecha', fechaLocalStr(hasta))
    }
    const { data } = await query
    setTransacciones(data || [])
  }

  const handleValorChange = (raw) => {
    const limpio = raw.replace(/[^\d]/g, '')
    if (limpio === '') {
      setVentaForm(prev => ({ ...prev, valor: '' }))
      return
    }
    const num = Number(limpio)
    setVentaForm(prev => ({ ...prev, valor: num.toLocaleString('es-CO') }))
  }

  const categorias = ['MEMBRESIA', 'OTRO']

  return (
    <div className="home-page">
      {/* Balance Carousel */}
      <div className="home-balance-carousel">
        <div className="home-balance-card balance">
          <span className="home-balance-label">Balance</span>
          <span className={`home-balance-amount ${balance >= 0 ? 'positivo' : 'negativo'}`}>
            {formatMoney(balance)}
          </span>
          <span className="home-balance-periodo">{periodoLabel}</span>
        </div>
        <div className="home-balance-card ingresos">
          <span className="home-balance-label">Ingresos</span>
          <span className="home-balance-amount positivo">{formatMoney(ingresos)}</span>
          <span className="home-balance-periodo">{periodoLabel}</span>
        </div>
        <div className="home-balance-card egresos">
          <span className="home-balance-label">Egresos</span>
          <span className="home-balance-amount negativo">{formatMoney(egresos)}</span>
          <span className="home-balance-periodo">{periodoLabel}</span>
        </div>
      </div>

      {/* Period Pills */}
      <div className="home-period-pills">
        <div className="home-period-bubble" style={bubbleStyle} />
        {['d', 's', 'm', 'a'].map(p => (
          <button
            key={p}
            ref={el => pillRefs.current[p] = el}
            className={`home-period-pill ${periodo === p ? 'active' : ''}`}
            onClick={() => setPeriodo(p)}
          >
            {p.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Tab Pills: Servicios / Productos / Movimientos */}
      <div className="home-tab-pills">
        <button
          className={`home-tab-pill ${tab === 'servicios' ? 'active' : ''}`}
          onClick={() => setTab('servicios')}
        >
          Servicios
        </button>
        <button
          className={`home-tab-pill ${tab === 'productos' ? 'active' : ''}`}
          onClick={() => setTab('productos')}
        >
          Productos
        </button>
        <button
          className={`home-tab-pill ${tab === 'movimientos' ? 'active' : ''}`}
          onClick={() => setTab('movimientos')}
        >
          Movimientos
        </button>
      </div>

      {/* Recent Cards */}
      <p className="home-section-title">
        Recientes — {{ servicios: 'Servicios', productos: 'Productos', movimientos: 'Movimientos' }[tab]}
      </p>
      <div className="home-recent-list">
        {tab === 'servicios' && (
          recentServicios.length > 0 ? (
            <div className="lavadas-cards">
              {recentServicios.map(item => (
                <ServiceCard
                  key={item.id}
                  lavada={item}
                  onEstadoChange={handleEstadoChange}
                  onTipoLavadoChange={handleTipoLavadoChangeInline}
                  onAdicionalChange={handleAdicionalChange}
                  onLavadorChange={handleLavadorChange}
                  onPagosChange={handlePagosChange}
                  onEliminar={handleEliminarLavada}
                  onWhatsApp={enviarWhatsApp}
                  isExpanded={expandedCards[item.id]}
                  isCollapsing={collapsingCards[item.id]}
                  isUpdating={updatingCards.has(item.id)}
                  editingPago={editingPago}
                  validationErrors={validationErrors[item.id]}
                  onToggleExpand={() => setExpandedCards(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                  onSetEditingPago={setEditingPago}
                  onSetValidationErrors={(errs) => errs ? setValidationErrors(prev => ({ ...prev, [item.id]: errs })) : setValidationErrors(prev => { const n = { ...prev }; delete n[item.id]; return n })}
                  onSmoothCollapse={smoothCollapse}
                  tiposLavado={tiposLavado}
                  serviciosAdicionales={serviciosAdicionales}
                  lavadores={lavadores}
                  metodosPago={metodosPago}
                  getTimerProps={getTimerProps}
                  hasActiveTimer={hasActiveTimer}
                  getEstadoClass={getEstadoClass}
                />
              ))}
            </div>
          ) : (
            <p className="home-recent-empty">No hay servicios en este periodo</p>
          )
        )}
        {tab === 'servicios' && visibleCount.servicios > 10 && (
          <div className="home-show-more-group">
            <button className="home-show-more home-show-less" onClick={() => handleShowLess('servicios')}>
              Mostrar menos
            </button>
            {allServicios.length > recentServicios.length && (
              <button className="home-show-more" onClick={() => handleShowMore('servicios')}>
                Mostrar más
              </button>
            )}
          </div>
        )}
        {tab === 'servicios' && visibleCount.servicios <= 10 && allServicios.length > recentServicios.length && (
          <button className="home-show-more" onClick={() => handleShowMore('servicios')}>
            Mostrar más
          </button>
        )}
        {tab === 'productos' && (
          recentProductos.length > 0 ? (
            recentProductos.map(item => (
              <div key={item.id} className="home-recent-card" onClick={() => navigate('/balance')}>
                <div className="home-recent-card-left">
                  <span className="home-recent-placa">{item.descripcion || item.placa_o_persona || item.categoria}</span>
                  <span className="home-recent-desc">{item.categoria} · {formatFechaRelativa(item.fecha)}</span>
                </div>
                <div className="home-recent-card-right">
                  <span className={`home-recent-valor ${item.tipo === 'INGRESO' ? 'positivo' : 'negativo'}`}>
                    {item.tipo === 'EGRESO' ? '-' : ''}{formatMoney(item.valor)}
                  </span>
                  <span className="home-recent-desc">{item.metodo_pago?.nombre || '—'}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="home-recent-empty">No hay productos en este periodo</p>
          )
        )}
        {tab === 'productos' && visibleCount.productos > 10 && (
          <div className="home-show-more-group">
            <button className="home-show-more home-show-less" onClick={() => handleShowLess('productos')}>
              Mostrar menos
            </button>
            {allProductos.length > recentProductos.length && (
              <button className="home-show-more" onClick={() => handleShowMore('productos')}>
                Mostrar más
              </button>
            )}
          </div>
        )}
        {tab === 'productos' && visibleCount.productos <= 10 && allProductos.length > recentProductos.length && (
          <button className="home-show-more" onClick={() => handleShowMore('productos')}>
            Mostrar más
          </button>
        )}
        {tab === 'movimientos' && (
          recentMovimientos.length > 0 ? (
            recentMovimientos.map(item => (
              <div key={item.id} className="home-recent-card" onClick={() => navigate('/balance')}>
                <div className="home-recent-card-left">
                  <span className="home-recent-placa">{item.descripcion || item.placa_o_persona || item.categoria}</span>
                  <span className="home-recent-desc">{item.categoria} · {formatFechaRelativa(item.fecha)}</span>
                </div>
                <div className="home-recent-card-right">
                  <span className={`home-recent-valor ${item.tipo === 'INGRESO' ? 'positivo' : 'negativo'}`}>
                    {item.tipo === 'EGRESO' ? '-' : ''}{formatMoney(item.valor)}
                  </span>
                  <span className="home-recent-desc">{item.metodo_pago?.nombre || '—'}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="home-recent-empty">No hay movimientos en este periodo</p>
          )
        )}
        {tab === 'movimientos' && visibleCount.movimientos > 10 && (
          <div className="home-show-more-group">
            <button className="home-show-more home-show-less" onClick={() => handleShowLess('movimientos')}>
              Mostrar menos
            </button>
            {allMovimientos.length > recentMovimientos.length && (
              <button className="home-show-more" onClick={() => handleShowMore('movimientos')}>
                Mostrar más
              </button>
            )}
          </div>
        )}
        {tab === 'movimientos' && visibleCount.movimientos <= 10 && allMovimientos.length > recentMovimientos.length && (
          <button className="home-show-more" onClick={() => handleShowMore('movimientos')}>
            Mostrar más
          </button>
        )}
      </div>

      {/* Search FAB */}
      {!showFabMenu && (
        <button className="home-search-fab" onClick={openSearch}>
          <Search size={20} />
        </button>
      )}

      {/* FAB */}
      <button
        className={`home-fab ${showFabMenu ? 'open' : ''}`}
        onClick={() => setShowFabMenu(!showFabMenu)}
      >
        <Plus size={24} />
      </button>
      {showFabMenu && (
        <>
          <div className="home-fab-overlay" onClick={() => setShowFabMenu(false)} />
          <div className="home-fab-menu">
            <button onClick={() => { setShowFabMenu(false); navigate('/lavadas?new=1') }}>
              <Droplets size={18} /> Nuevo Servicio
            </button>
            <button onClick={() => { setShowFabMenu(false); setShowVentaModal(true) }}>
              <DollarSign size={18} /> Nueva Venta
            </button>
          </div>
        </>
      )}

      {/* Modal Nueva Venta */}
      {showVentaModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2>Nueva Venta</h2>
              <button className="btn-close" onClick={() => setShowVentaModal(false)}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleVentaSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Valor *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={ventaForm.valor}
                    onChange={(e) => handleValorChange(e.target.value)}
                    placeholder="$0"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Método de Pago *</label>
                  <select
                    value={ventaForm.metodo_pago_id}
                    onChange={(e) => setVentaForm(prev => ({ ...prev, metodo_pago_id: e.target.value }))}
                    required
                  >
                    <option value="">Seleccionar</option>
                    {metodosPago.map(m => (
                      <option key={m.id} value={m.id}>{m.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Categoría</label>
                  <select
                    value={ventaForm.categoria}
                    onChange={(e) => setVentaForm(prev => ({ ...prev, categoria: e.target.value }))}
                  >
                    {categorias.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Persona / Placa</label>
                  <input
                    type="text"
                    value={ventaForm.placa_o_persona}
                    onChange={(e) => setVentaForm(prev => ({ ...prev, placa_o_persona: e.target.value }))}
                    placeholder="Opcional"
                  />
                </div>
              </div>
              <div className="form-group" style={{ padding: '0 1.5rem' }}>
                <label>Descripción</label>
                <input
                  type="text"
                  value={ventaForm.descripcion}
                  onChange={(e) => setVentaForm(prev => ({ ...prev, descripcion: e.target.value }))}
                  placeholder="Opcional"
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowVentaModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Search Overlay */}
      {showSearch && (
        <div className="search-overlay">
          <div className="search-header">
            <div className="search-input-row">
              <Search size={20} className="search-input-icon" />
              <input
                ref={searchInputRef}
                type="text"
                className="search-input"
                placeholder="Buscar por placa o nombre..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button className="search-close-btn" onClick={closeSearch}>
                <X size={20} />
              </button>
            </div>
          </div>
          <div className="search-body">
            {!searchQuery.trim() && (
              <p className="search-hint">Escribe para buscar clientes, servicios o movimientos</p>
            )}
            {searchResults && searchResults.clientes.length === 0 && searchResults.servicios.length === 0 && searchResults.movimientos.length === 0 && (
              <p className="search-hint">No se encontraron resultados</p>
            )}
            {searchResults && searchResults.clientes.length > 0 && (
              <div className="search-section">
                <h3 className="search-section-title">Clientes</h3>
                {searchResults.clientes.map(c => (
                  <div key={c.id} className="search-result-card" onClick={() => handleSearchNavigate('/clientes')}>
                    <span className="search-result-main">{c.nombre}</span>
                    <span className="search-result-sub">{c.placa}</span>
                  </div>
                ))}
              </div>
            )}
            {searchResults && searchResults.servicios.length > 0 && (
              <div className="search-section">
                <h3 className="search-section-title">Servicios</h3>
                {searchResults.servicios.map(l => (
                  <div key={l.id} className="search-result-card" onClick={() => handleSearchNavigate('/lavadas')}>
                    <span className="search-result-main">{l.placa} — {l.cliente?.nombre || '—'}</span>
                    <span className="search-result-sub">{formatFechaRelativa(l.fecha)}</span>
                  </div>
                ))}
              </div>
            )}
            {searchResults && searchResults.movimientos.length > 0 && (
              <div className="search-section">
                <h3 className="search-section-title">Movimientos</h3>
                {searchResults.movimientos.map(t => (
                  <div key={t.id} className="search-result-card" onClick={() => handleSearchNavigate('/balance')}>
                    <span className="search-result-main">{t.descripcion || t.placa_o_persona || t.categoria}</span>
                    <span className="search-result-sub">{t.categoria} · {formatMoney(t.valor)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
