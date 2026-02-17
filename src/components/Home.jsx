import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useData } from './DataContext'
import { useServiceHandlers } from '../hooks/useServiceHandlers'
import ServiceCard from './ServiceCard'
import NuevoServicioSheet from './NuevoServicioSheet'
import { formatMoney, formatMoneyShort } from '../utils/money'
import { AreaChart, Area, XAxis, ResponsiveContainer } from 'recharts'
import { ESTADO_LABELS, ESTADO_CLASSES } from '../config/constants'
import { Plus, Droplets, DollarSign, X, Search, SlidersHorizontal, CheckSquare, Trash2, Upload, Download, ChevronDown, Pencil, Check } from 'lucide-react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import * as XLSX from 'xlsx'

export default function Home() {
  const navigate = useNavigate()
  const { lavadas, metodosPago, negocioId, clientes, deleteLavadaLocal, loadAllLavadas, lavadasAllLoaded, productos, refreshConfig, tiposMembresia, updateClienteLocal, addClienteLocal } = useData()

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
  const [showServicioModal, setShowServicioModal] = useState(false)
  const [showVentaModal, setShowVentaModal] = useState(false)
  const [ventaForm, setVentaForm] = useState({
    valor: '',
    pagos: [],
    tipo_venta: 'PRODUCTO',
    producto_id: '',
    cantidad: 1,
    membresia_id: '',
    fecha_activacion: null,
    cliente_id: '',
  })
  const [ventaEditingPago, setVentaEditingPago] = useState(null)
  const [minFechaActivacion, setMinFechaActivacion] = useState(null)
  const [ventaClienteSearch, setVentaClienteSearch] = useState('')
  const [showVentaClienteDropdown, setShowVentaClienteDropdown] = useState(false)
  const [showVentaNuevoCliente, setShowVentaNuevoCliente] = useState(false)
  const [ventaNuevoClienteData, setVentaNuevoClienteData] = useState({ nombre: '', placa: '', telefono: '' })
  const [creandoVentaCliente, setCreandoVentaCliente] = useState(false)
  const ventaClienteWrapperRef = useRef(null)
  const [submitting, setSubmitting] = useState(false)
  const [visibleCount, setVisibleCount] = useState({ servicios: 10, productos: 10, movimientos: 10 })
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroLavador, setFiltroLavador] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroMetodoPago, setFiltroMetodoPago] = useState('')
  const searchInputRef = useRef(null)
  const [modoSeleccion, setModoSeleccion] = useState(false)
  const [selectedItems, setSelectedItems] = useState(new Set())
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [highlightId, setHighlightId] = useState(null)

  // Expandable product cards
  const [expandedProductCard, setExpandedProductCard] = useState(null)
  const [editProductId, setEditProductId] = useState(null)
  const [editProductData, setEditProductData] = useState(null)

  // Import states
  const [showImportModal, setShowImportModal] = useState(false)
  const [importStep, setImportStep] = useState('upload')
  const [importErrors, setImportErrors] = useState([])
  const [importNuevos, setImportNuevos] = useState([])
  const [importProgress, setImportProgress] = useState(0)
  const [importResult, setImportResult] = useState(null)
  const [importTipo, setImportTipo] = useState('')
  const fileInputRef = useRef(null)

  // Bottom-sheet drag refs for Nueva Venta
  const ventaSheetRef = useRef(null)
  const [ventaDragY, setVentaDragY] = useState(0)
  const ventaDragStartY = useRef(null)

  // Bubble position from period index
  const periodIdx = ['d', 's', 'm', 'a'].indexOf(periodo)

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

  const detectPeriod = (fechaStr) => {
    const dateOnly = typeof fechaStr === 'string' ? fechaStr.split('T')[0] : null
    if (!dateOnly) return 'a'
    const fecha = new Date(dateOnly + 'T00:00:00')
    for (const p of ['d', 's', 'm', 'a']) {
      const { desde, hasta } = getDateRange(p)
      if (desde && hasta) {
        const h = new Date(hasta); h.setHours(23, 59, 59, 999)
        if (fecha >= desde && fecha <= h) return p
      }
    }
    return 'a'
  }

  function fechaLocalStr(date) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const { desde: fechaDesde, hasta: fechaHasta } = getDateRange(periodo)

  // Fetch transacciones
  const fetchTransacciones = async () => {
    const { desde: d, hasta: h } = getDateRange(periodo)
    let query = supabase
      .from('transacciones')
      .select('*, metodo_pago:metodos_pago(nombre)')
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })

    if (d) {
      query = query.gte('fecha', fechaLocalStr(d))
    }
    if (h) {
      const hasta = new Date(h)
      hasta.setDate(hasta.getDate() + 1)
      query = query.lt('fecha', fechaLocalStr(hasta))
    }

    const { data } = await query
    setTransacciones(data || [])
  }

  useEffect(() => {
    fetchTransacciones()
  }, [periodo])

  useEffect(() => {
    if (periodo === 'a' && !lavadasAllLoaded) {
      loadAllLavadas()
    }
  }, [periodo])

  // Persist periodo to localStorage
  useEffect(() => {
    localStorage.setItem('home-periodo', periodo)
  }, [periodo])

  // Close venta cliente dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ventaClienteWrapperRef.current && !ventaClienteWrapperRef.current.contains(e.target)) {
        setShowVentaClienteDropdown(false)
      }
    }
    if (showVentaClienteDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [showVentaClienteDropdown])

  // Generate virtual entries from lavadas payments (same pattern as Balance.jsx)
  const pagosLavadas = lavadas.flatMap(l => {
    const pagos = l.pagos || []
    if (pagos.length === 0) return []

    const dateOnlyL = typeof l.fecha === 'string' ? l.fecha.split('T')[0] : null
    const fechaLavada = dateOnlyL ? new Date(dateOnlyL + 'T00:00:00') : new Date(l.fecha)
    if (isNaN(fechaLavada.getTime())) return []

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

  // Client-side date filter for transacciones (safety net, mirrors lavadasFiltradas pattern)
  const transaccionesFiltradas = transacciones.filter(t => {
    const dateOnly = typeof t.fecha === 'string' ? t.fecha.split('T')[0] : null
    if (!dateOnly) return true
    const fechaT = new Date(dateOnly + 'T00:00:00')
    if (isNaN(fechaT.getTime())) return true
    if (fechaDesde && fechaT < fechaDesde) return false
    if (fechaHasta) {
      const h = new Date(fechaHasta)
      h.setHours(23, 59, 59, 999)
      if (fechaT > h) return false
    }
    return true
  })

  // Combine all entries for balance
  const todasEntradas = [...transaccionesFiltradas, ...pagosLavadas]

  // Period label
  const periodoLabels = { d: 'Hoy', s: 'Esta semana', m: 'Este mes', a: 'Este año' }
  const periodoLabel = periodoLabels[periodo]

  // Filter lavadas by period for recent services
  const lavadasFiltradas = lavadas.filter(l => {
    const dateOnly = typeof l.fecha === 'string' ? l.fecha.split('T')[0] : null
    if (!dateOnly) return true
    const fechaL = new Date(dateOnly + 'T00:00:00')
    if (isNaN(fechaL.getTime())) return true
    if (fechaDesde && fechaL < fechaDesde) return false
    if (fechaHasta) {
      const h = new Date(fechaHasta)
      h.setHours(23, 59, 59, 999)
      if (fechaL > h) return false
    }
    return true
  })

  // Recent items
  const allServicios = lavadasFiltradas.filter(l => {
    if (filtroEstado && l.estado !== filtroEstado) return false
    if (filtroLavador && l.lavador_id != filtroLavador) return false
    return true
  })
  const allProductos = transaccionesFiltradas
    .filter(t => t.categoria === 'MEMBRESIA' || t.categoria === 'PRODUCTO')
    .filter(t => {
      if (filtroTipo && t.tipo !== filtroTipo) return false
      if (filtroMetodoPago && t.metodo_pago_id != filtroMetodoPago) return false
      return true
    })
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha) || new Date(b.created_at) - new Date(a.created_at))
  const allMovimientos = todasEntradas
    .filter(t => !t._esLavada && t.categoria !== 'MEMBRESIA' && t.categoria !== 'PRODUCTO')
    .filter(t => {
      if (filtroTipo && t.tipo !== filtroTipo) return false
      if (filtroMetodoPago && t.metodo_pago_id != filtroMetodoPago) return false
      return true
    })
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha) || new Date(b.created_at) - new Date(a.created_at))

  // Scroll to highlighted item
  useEffect(() => {
    if (!highlightId) return
    const list = tab === 'servicios' ? allServicios : tab === 'productos' ? allProductos : allMovimientos
    const idx = list.findIndex(i => i.id === highlightId)
    if (idx === -1) return
    const tabKey = tab === 'servicios' ? 'servicios' : tab === 'productos' ? 'productos' : 'movimientos'
    if (idx >= visibleCount[tabKey]) {
      setVisibleCount(prev => ({ ...prev, [tabKey]: idx + 5 }))
    }
    const raf = requestAnimationFrame(() => {
      document.querySelector(`[data-id="${highlightId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    const timer = setTimeout(() => setHighlightId(null), 2500)
    return () => { cancelAnimationFrame(raf); clearTimeout(timer) }
  }, [highlightId, tab, allServicios, allProductos, allMovimientos])

  const pagosServicios = allServicios.flatMap(l => {
    const pagos = l.pagos || []
    return pagos.map(p => ({
      tipo: 'INGRESO',
      valor: p.valor || 0,
      categoria: 'SERVICIO',
      metodo_pago: { nombre: p.nombre },
    }))
  })
  const entradasParaBalance = [...pagosServicios, ...allProductos, ...allMovimientos]

  const ingresos = entradasParaBalance.filter(t => t.tipo === 'INGRESO').reduce((sum, t) => sum + Number(t.valor), 0)
  const egresos = entradasParaBalance.filter(t => t.tipo === 'EGRESO').reduce((sum, t) => sum + Number(t.valor), 0)
  const balance = ingresos - egresos

  const balanceChartData = useMemo(() => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    if (periodo === 'd') {
      // Last 7 days from lavadas + transacciones
      const hace7 = new Date(hoy)
      hace7.setDate(hace7.getDate() - 6)
      const entries = lavadas.flatMap(l => {
        const fecha = new Date(l.fecha)
        fecha.setHours(0, 0, 0, 0)
        if (fecha < hace7 || fecha > hoy) return []
        const pagos = l.pagos || []
        return pagos.map(p => ({ fecha: l.fecha, valor: p.valor || 0, tipo: 'INGRESO' }))
      })
      transacciones.forEach(t => {
        entries.push({ fecha: t.fecha, valor: t.valor, tipo: t.tipo })
      })
      const buckets = []
      for (let i = 0; i < 7; i++) {
        const d = new Date(hace7)
        d.setDate(hace7.getDate() + i)
        buckets.push({ date: d.getTime(), value: 0 })
      }
      entries.forEach(e => {
        const fecha = new Date(e.fecha)
        fecha.setHours(0, 0, 0, 0)
        const idx = buckets.findIndex(b => b.date === fecha.getTime())
        if (idx >= 0) buckets[idx].value += e.tipo === 'INGRESO' ? Number(e.valor) : -Number(e.valor)
      })
      const diasInit = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
      let acc = 0
      return buckets.map(b => { acc += b.value; return { name: diasInit[new Date(b.date).getDay()], value: acc } })
    }

    // For s/m/a use todasEntradas (all entries with dates)
    const entries = todasEntradas
    if (periodo === 's') {
      const dias = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
      const buckets = dias.map(() => 0)
      entries.forEach(e => {
        if (!e.fecha) return
        let day = new Date(e.fecha).getDay()
        day = day === 0 ? 6 : day - 1
        buckets[day] += e.tipo === 'INGRESO' ? Number(e.valor) : -Number(e.valor)
      })
      let acc = 0
      return dias.map((d, i) => { acc += buckets[i]; return { name: d, value: acc } })
    }

    if (periodo === 'm') {
      const daysInMonth = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate()
      const buckets = Array.from({ length: daysInMonth }, () => 0)
      entries.forEach(e => {
        if (!e.fecha) return
        const day = new Date(e.fecha).getDate()
        buckets[day - 1] += e.tipo === 'INGRESO' ? Number(e.valor) : -Number(e.valor)
      })
      let acc = 0
      return buckets.map((v, i) => { acc += v; return { name: String(i + 1), value: acc } })
    }

    if (periodo === 'a') {
      const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
      const buckets = Array.from({ length: 12 }, () => 0)
      entries.forEach(e => {
        if (!e.fecha) return
        const month = new Date(e.fecha).getMonth()
        buckets[month] += e.tipo === 'INGRESO' ? Number(e.valor) : -Number(e.valor)
      })
      let acc = 0
      return meses.map((m, i) => { acc += buckets[i]; return { name: m, value: acc } })
    }

    return []
  }, [periodo, todasEntradas, lavadas, transacciones])

  const [chartMode, setChartMode] = useState('categoria')
  const [chartModeEgresos, setChartModeEgresos] = useState('categoria')
  const DONUT_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4']
  const DONUT_COLORS_EGRESOS = ['#ef4444', '#f97316', '#eab308', '#a855f7', '#ec4899', '#06b6d4']

  const donutData = useMemo(() => {
    const soloIngresos = entradasParaBalance.filter(t => t.tipo === 'INGRESO')
    if (soloIngresos.length === 0) return null

    const grouped = {}
    soloIngresos.forEach(t => {
      const key = chartMode === 'categoria'
        ? (t.categoria || 'OTRO')
        : (t.metodo_pago?.nombre || 'Sin método')
      grouped[key] = (grouped[key] || 0) + Number(t.valor)
    })

    const entries = Object.entries(grouped).sort((a, b) => b[1] - a[1])
    const total = entries.reduce((s, [, v]) => s + v, 0)
    if (total === 0) return null

    let cumDeg = 0
    const segments = entries.map(([label, value], i) => {
      const pct = value / total
      const startDeg = cumDeg
      cumDeg += pct * 360
      return { label, value, pct, startDeg, endDeg: cumDeg, color: DONUT_COLORS[i % DONUT_COLORS.length] }
    })

    const gradient = segments.map(s => `${s.color} ${s.startDeg}deg ${s.endDeg}deg`).join(', ')

    return { segments, gradient }
  }, [entradasParaBalance, chartMode])

  const donutDataEgresos = useMemo(() => {
    const soloEgresos = entradasParaBalance.filter(t => t.tipo === 'EGRESO')
    if (soloEgresos.length === 0) return null

    const grouped = {}
    soloEgresos.forEach(t => {
      const key = chartModeEgresos === 'categoria'
        ? (t.categoria || 'OTRO')
        : (t.metodo_pago?.nombre || 'Sin método')
      grouped[key] = (grouped[key] || 0) + Number(t.valor)
    })

    const entries = Object.entries(grouped).sort((a, b) => b[1] - a[1])
    const total = entries.reduce((s, [, v]) => s + v, 0)
    if (total === 0) return null

    let cumDeg = 0
    const segments = entries.map(([label, value], i) => {
      const pct = value / total
      const startDeg = cumDeg
      cumDeg += pct * 360
      return { label, value, pct, startDeg, endDeg: cumDeg, color: DONUT_COLORS_EGRESOS[i % DONUT_COLORS_EGRESOS.length] }
    })

    const gradient = segments.map(s => `${s.color} ${s.startDeg}deg ${s.endDeg}deg`).join(', ')

    return { segments, gradient }
  }, [entradasParaBalance, chartModeEgresos])

  const recentServicios = allServicios.slice(0, visibleCount.servicios)
  const recentProductos = allProductos.slice(0, visibleCount.productos)
  const recentMovimientos = allMovimientos.slice(0, visibleCount.movimientos)

  const handleShowMore = (tab) => {
    setVisibleCount(prev => ({ ...prev, [tab]: prev[tab] + 10 }))
  }

  const handleShowLess = (tab) => {
    setVisibleCount(prev => ({ ...prev, [tab]: 10 }))
  }

  const toggleSelectItem = (id) => {
    setSelectedItems(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const currentList = tab === 'servicios' ? allServicios
    : tab === 'productos' ? allProductos : allMovimientos

  const toggleSelectAll = () => {
    if (selectedItems.size === currentList.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(currentList.map(i => i.id)))
    }
  }

  const handleBulkDelete = async () => {
    setDeleting(true)
    const ids = [...selectedItems]
    let eliminados = 0

    if (tab === 'servicios') {
      for (const id of ids) {
        const { error } = await supabase.from('lavadas').delete().eq('id', id)
        if (!error) { deleteLavadaLocal(id); eliminados++ }
      }
    } else {
      for (const id of ids) {
        if (String(id).startsWith('lavada-')) continue
        const { error } = await supabase.from('transacciones').delete().eq('id', id)
        if (!error) eliminados++
      }
      if (eliminados > 0) {
        let query = supabase.from('transacciones').select('*, metodo_pago:metodos_pago(nombre)').order('fecha', { ascending: false }).order('created_at', { ascending: false })
        if (fechaDesde) query = query.gte('fecha', fechaLocalStr(fechaDesde))
        if (fechaHasta) { const h = new Date(fechaHasta); h.setDate(h.getDate() + 1); query = query.lt('fecha', fechaLocalStr(h)) }
        const { data } = await query
        setTransacciones(data || [])
      }
    }

    setDeleting(false)
    setShowDeleteModal(false)
    setSelectedItems(new Set())
    setModoSeleccion(false)
    if (eliminados > 0) alert(`Se eliminaron ${eliminados} elemento${eliminados > 1 ? 's' : ''}`)
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

    const matchMovimientos = [...transacciones]
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha) || new Date(b.created_at) - new Date(a.created_at))
      .filter(t =>
        (t.descripcion || '').toLowerCase().includes(q) ||
        (t.placa_o_persona || '').toLowerCase().includes(q) ||
        (t.categoria || '').toLowerCase().includes(q)
      )
      .slice(0, 5)

    return { clientes: matchClientes, servicios: matchServicios, movimientos: matchMovimientos }
  }, [searchQuery, clientes, lavadas, transacciones])

  const openSearch = () => {
    setShowSearch(true)
    setSearchQuery('')
    setTimeout(() => searchInputRef.current?.focus(), 100)
  }
  const closeSearch = () => {
    setShowSearch(false)
    setSearchQuery('')
  }
  const handleSearchNavigate = (type, item) => {
    closeSearch()
    if (type === 'cliente') {
      navigate('/clientes', { state: { highlightId: item.id } })
      return
    }
    // Clear filters so item is visible
    setFiltroEstado('')
    setFiltroLavador('')
    setFiltroTipo('')
    setFiltroMetodoPago('')
    if (type === 'servicio') {
      setTab('servicios')
      const p = detectPeriod(item.fecha)
      setPeriodo(p)
      setHighlightId(item.id)
    } else if (type === 'movimiento') {
      if (item.categoria === 'MEMBRESIA' || item.categoria === 'PRODUCTO') {
        setTab('productos')
      } else {
        setTab('movimientos')
      }
      const p = detectPeriod(item.fecha)
      setPeriodo(p)
      setHighlightId(item.id)
    }
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

  // Product card edit handlers
  const iniciarEdicionProducto = (t) => {
    setEditProductId(t.id)
    setEditProductData({
      fecha: t.fecha?.split('T')[0] || fechaLocalStr(new Date()),
      descripcion: t.descripcion || '',
      placa_o_persona: t.placa_o_persona || '',
      metodo_pago_id: t.metodo_pago_id || '',
      valor: String(t.valor),
      valorDisplay: Number(t.valor).toLocaleString('es-CO'),
    })
  }

  const cancelarEdicionProducto = () => {
    setEditProductId(null)
    setEditProductData(null)
  }

  const handleEditProductoValorChange = (raw) => {
    const limpio = raw.replace(/[^\d]/g, '')
    if (limpio === '') {
      setEditProductData(prev => ({ ...prev, valor: '', valorDisplay: '' }))
      return
    }
    const num = Number(limpio)
    setEditProductData(prev => ({ ...prev, valor: String(num), valorDisplay: num.toLocaleString('es-CO') }))
  }

  const guardarEdicionProducto = async (id) => {
    if (!editProductData) return
    const nuevoValor = Number(editProductData.valor)
    if (isNaN(nuevoValor) || nuevoValor < 0) return
    if (!editProductData.metodo_pago_id || !editProductData.fecha) return

    const updates = {
      fecha: editProductData.fecha + 'T12:00:00-05:00',
      placa_o_persona: editProductData.placa_o_persona,
      descripcion: editProductData.descripcion,
      metodo_pago_id: editProductData.metodo_pago_id,
      valor: nuevoValor,
    }

    await supabase.from('transacciones').update(updates).eq('id', id)
    setEditProductId(null)
    setEditProductData(null)
    fetchTransacciones()
  }

  const checkVentaMembresiaActiva = (cliente) => {
    if (!cliente?.fecha_fin_membresia) {
      setMinFechaActivacion(null)
      return
    }
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const finMembresia = new Date(cliente.fecha_fin_membresia + 'T00:00:00')
    if (finMembresia >= hoy) {
      const minDate = new Date(finMembresia)
      minDate.setDate(minDate.getDate() + 1)
      setMinFechaActivacion(minDate)
      setVentaForm(prev => {
        const currentActivacion = prev.fecha_activacion || new Date()
        return { ...prev, fecha_activacion: currentActivacion < minDate ? minDate : currentActivacion }
      })
    } else {
      setMinFechaActivacion(null)
    }
  }

  // Venta: seleccionar cliente existente
  const handleVentaClienteChange = (clienteId) => {
    const cliente = clientes.find(c => c.id == clienteId)
    if (cliente) {
      setVentaClienteSearch(`${cliente.nombre} - ${cliente.placa}`)
      setShowVentaClienteDropdown(false)
      setVentaForm(prev => ({ ...prev, cliente_id: clienteId }))
      checkVentaMembresiaActiva(cliente)
    } else {
      setMinFechaActivacion(null)
    }
  }

  // Venta: crear cliente inline
  const handleCrearVentaCliente = async () => {
    if (!ventaNuevoClienteData.nombre || !ventaNuevoClienteData.placa) return
    setCreandoVentaCliente(true)
    const hoy = new Date()
    const hoyStr = fechaLocalStr(hoy)
    const sinMembresia = tiposMembresia.find(m => m.nombre.toLowerCase().includes('sin '))

    const { data, error } = await supabase
      .from('clientes')
      .insert([{
        nombre: ventaNuevoClienteData.nombre,
        placa: ventaNuevoClienteData.placa.toUpperCase(),
        telefono: ventaNuevoClienteData.telefono || null,
        membresia_id: sinMembresia?.id || null,
        fecha_inicio_membresia: hoyStr,
        fecha_fin_membresia: hoyStr,
        estado: 'Activo',
        negocio_id: negocioId
      }])
      .select('*, membresia:tipos_membresia(nombre)')
      .single()
    setCreandoVentaCliente(false)
    if (error) {
      const existente = clientes.find(c => c.placa?.toLowerCase() === ventaNuevoClienteData.placa.toLowerCase())
      if (existente) {
        setShowVentaNuevoCliente(false)
        setVentaNuevoClienteData({ nombre: '', placa: '', telefono: '' })
        handleVentaClienteChange(existente.id)
        return
      }
      alert('Error al crear cliente: ' + (error.message || 'Error desconocido'))
      return
    }
    if (data) {
      addClienteLocal(data)
      setShowVentaNuevoCliente(false)
      setVentaNuevoClienteData({ nombre: '', placa: '', telefono: '' })
      setVentaClienteSearch(`${data.nombre} - ${data.placa}`)
      setShowVentaClienteDropdown(false)
      setVentaForm(prev => ({ ...prev, cliente_id: data.id }))
    }
  }

  // Nueva venta submit
  const handleVentaSubmit = async () => {
    if (submitting) return
    if (!ventaForm.cliente_id) return
    if (ventaForm.pagos.length === 0 || ventaForm.pagos.some(p => !p.metodo_pago_id)) return
    setSubmitting(true)

    const valor = Number(ventaForm.valor.replace(/[^\d]/g, ''))
    if (!valor) {
      setSubmitting(false)
      return
    }

    const cliente = clientes.find(c => c.id == ventaForm.cliente_id)
    const clienteNombre = cliente?.nombre || ''
    const clientePlaca = cliente?.placa || ''
    const placaPersona = `${clienteNombre} - ${clientePlaca}`
    const fechaStr = fechaLocalStr(new Date()) + 'T12:00:00-05:00'

    if (ventaForm.tipo_venta === 'PRODUCTO') {
      const producto = productos.find(p => p.id === ventaForm.producto_id)
      const cantidad = ventaForm.cantidad || 1
      const descripcion = producto ? `${producto.nombre} x${cantidad}` : ''

      // Insert 1 transaction per pago
      const rows = ventaForm.pagos.map(p => ({
        tipo: 'INGRESO',
        valor: Number(p.valor.replace(/[^\d]/g, '')),
        categoria: 'PRODUCTO',
        metodo_pago_id: p.metodo_pago_id,
        placa_o_persona: placaPersona,
        descripcion,
        fecha: fechaStr,
        negocio_id: negocioId,
      }))
      await supabase.from('transacciones').insert(rows)

      // Stock: descontar 1 sola vez
      if (producto) {
        await supabase.from('productos').update({ cantidad: Math.max(0, producto.cantidad - cantidad) }).eq('id', producto.id)
        refreshConfig()
      }
    } else {
      // MEMBRESIA path
      const membresia = tiposMembresia.find(m => m.id === ventaForm.membresia_id)
      const descripcion = membresia ? membresia.nombre : 'Membresía'

      // Insert 1 transaction per pago
      const rows = ventaForm.pagos.map(p => ({
        tipo: 'INGRESO',
        valor: Number(p.valor.replace(/[^\d]/g, '')),
        categoria: 'MEMBRESIA',
        metodo_pago_id: p.metodo_pago_id,
        placa_o_persona: placaPersona,
        descripcion,
        fecha: fechaStr,
        negocio_id: negocioId,
      }))
      await supabase.from('transacciones').insert(rows)

      // Membresía: actualizar cliente 1 sola vez
      if (membresia && cliente) {
        const meses = membresia.duracion_dias || 1
        const activacion = ventaForm.fecha_activacion || new Date()
        const hoy = new Date()
        hoy.setHours(0, 0, 0, 0)

        let fechaInicio, fechaFin
        if (cliente.fecha_inicio_membresia && cliente.fecha_fin_membresia) {
          const finActual = new Date(cliente.fecha_fin_membresia + 'T00:00:00')
          if (finActual >= hoy) {
            fechaInicio = cliente.fecha_inicio_membresia
            const nuevaFin = new Date(activacion)
            nuevaFin.setMonth(nuevaFin.getMonth() + meses)
            fechaFin = fechaLocalStr(nuevaFin)
          } else {
            fechaInicio = fechaLocalStr(activacion)
            const fin = new Date(activacion)
            fin.setMonth(fin.getMonth() + meses)
            fechaFin = fechaLocalStr(fin)
          }
        } else {
          fechaInicio = fechaLocalStr(activacion)
          const fin = new Date(activacion)
          fin.setMonth(fin.getMonth() + meses)
          fechaFin = fechaLocalStr(fin)
        }

        const updates = {
          membresia_id: membresia.id,
          fecha_inicio_membresia: fechaInicio,
          fecha_fin_membresia: fechaFin,
        }
        await supabase.from('clientes').update(updates).eq('id', cliente.id)
        updateClienteLocal(cliente.id, { ...updates, membresia: { nombre: membresia.nombre } })
      }
    }

    resetVentaForm()
    setSubmitting(false)

    // Refresh transacciones
    let query = supabase
      .from('transacciones')
      .select('*, metodo_pago:metodos_pago(nombre)')
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
    if (fechaDesde) query = query.gte('fecha', fechaLocalStr(fechaDesde))
    if (fechaHasta) {
      const hasta = new Date(fechaHasta)
      hasta.setDate(hasta.getDate() + 1)
      query = query.lt('fecha', fechaLocalStr(hasta))
    }
    const { data } = await query
    setTransacciones(data || [])
  }

  const resetVentaForm = () => {
    setShowVentaModal(false)
    setVentaForm({ valor: '', pagos: [], tipo_venta: 'PRODUCTO', producto_id: '', cantidad: 1, membresia_id: '', fecha_activacion: null, cliente_id: '' })
    setVentaEditingPago(null)
    setMinFechaActivacion(null)
    setVentaClienteSearch('')
    setShowVentaClienteDropdown(false)
    setShowVentaNuevoCliente(false)
    setVentaNuevoClienteData({ nombre: '', placa: '', telefono: '' })
  }

  const handleCloseVenta = () => {
    resetVentaForm()
  }

  const onVentaSheetTouchStart = (e) => { ventaDragStartY.current = e.touches[0].clientY }
  const onVentaSheetTouchMove = (e) => {
    if (ventaDragStartY.current === null) return
    const delta = e.touches[0].clientY - ventaDragStartY.current
    if (delta > 0) setVentaDragY(delta)
  }
  const onVentaSheetTouchEnd = () => {
    const height = ventaSheetRef.current?.offsetHeight || 500
    if (ventaDragY > height * 0.3) handleCloseVenta()
    setVentaDragY(0)
    ventaDragStartY.current = null
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

  // === Import functions ===
  const descargarPlantilla = () => {
    const bom = '\uFEFF'
    let headers, ejemplo, instrucciones
    if (importTipo === 'productos') {
      headers = 'valor,metodo_pago,placa_o_persona,descripcion,fecha'
      const metodos = metodosPago.map(m => m.nombre)
      ejemplo = `25000,${metodos[0] || 'EFECTIVO'},ABC123,Descripción ejemplo,15-01-2026`
      instrucciones = [
        '\n# INSTRUCCIONES (borra estas líneas antes de importar)',
        '# Columna obligatoria: valor (número sin puntos ni comas)',
        `# metodo_pago: ${metodos.join(' | ') || '(ninguno configurado)'}`,
        '# placa_o_persona: texto libre (opcional)',
        '# descripcion: texto libre (opcional)',
        '# fecha: formato DD-MM-AAAA o DD/MM/AAAA (opcional, default hoy)',
        '# Tipo se asigna automáticamente como INGRESO, categoría como MEMBRESIA'
      ]
    } else {
      headers = 'tipo,valor,categoria,metodo_pago,placa_o_persona,descripcion,fecha'
      const metodos = metodosPago.map(m => m.nombre)
      ejemplo = `INGRESO,25000,OTRO,${metodos[0] || 'EFECTIVO'},ABC123,Descripción ejemplo,15-01-2026`
      instrucciones = [
        '\n# INSTRUCCIONES (borra estas líneas antes de importar)',
        '# Columnas obligatorias: tipo, valor, categoria',
        '# tipo: INGRESO o EGRESO',
        '# valor: número sin puntos ni comas',
        '# categoria: MEMBRESIA | SERVICIO | ADICIONAL | OTRO | INSUMOS | SERVICIOS | ABONO A SUELDO | ARRIENDO | PAGO TRABAJADOR',
        `# metodo_pago: ${metodos.join(' | ') || '(ninguno configurado)'} (opcional)`,
        '# placa_o_persona: texto libre (opcional)',
        '# descripcion: texto libre (opcional)',
        '# fecha: formato DD-MM-AAAA o DD/MM/AAAA (opcional, default hoy)'
      ]
    }
    const csv = bom + [headers, ejemplo, ...instrucciones].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `plantilla_${importTipo}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const parseFecha = (raw) => {
    if (!raw) return fechaLocalStr(new Date()) + 'T12:00:00-05:00'
    if (raw instanceof Date && !isNaN(raw.getTime())) {
      const y = raw.getUTCFullYear()
      const m = String(raw.getUTCMonth() + 1).padStart(2, '0')
      const d = String(raw.getUTCDate()).padStart(2, '0')
      return `${y}-${m}-${d}T12:00:00-05:00`
    }
    const str = raw.toString().trim()
    const matchDMY = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
    if (matchDMY) {
      const dd = String(parseInt(matchDMY[1], 10)).padStart(2, '0')
      const mm = String(parseInt(matchDMY[2], 10)).padStart(2, '0')
      return `${matchDMY[3]}-${mm}-${dd}T12:00:00-05:00`
    }
    const matchISO = str.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (matchISO) return `${matchISO[1]}-${matchISO[2]}-${matchISO[3]}T12:00:00-05:00`
    return null
  }

  const handleImportFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const isCSV = file.name.toLowerCase().endsWith('.csv')
    const reader = new FileReader()
    reader.onload = (evt) => {
      let wb
      if (isCSV) {
        wb = XLSX.read(evt.target.result, { type: 'string', cellDates: true })
      } else {
        const data = new Uint8Array(evt.target.result)
        wb = XLSX.read(data, { type: 'array', cellDates: true })
      }
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: true })

      const errors = []
      const nuevos = []
      const categoriasValidas = ['MEMBRESIA', 'SERVICIO', 'ADICIONAL', 'OTRO', 'INSUMOS', 'SERVICIOS', 'ABONO A SUELDO', 'ARRIENDO', 'PAGO TRABAJADOR']

      rows.forEach((row, idx) => {
        const fila = idx + 2
        const n = {}
        Object.keys(row).forEach(key => {
          n[key.toLowerCase().trim().replace(/\s+/g, '_')] = row[key]
        })

        if (importTipo === 'productos') {
          const valorRaw = (n.valor || '').toString().trim()
          if (!valorRaw) {
            errors.push({ fila, problema: 'La columna "valor" está vacía', tipo: 'error' })
            return
          }
          const valor = Number(valorRaw.replace(/[^\d]/g, ''))
          if (!valor || isNaN(valor)) {
            errors.push({ fila, problema: `Valor "${valorRaw}" no es numérico`, tipo: 'error' })
            return
          }

          const fecha = parseFecha(n.fecha instanceof Date ? n.fecha : (n.fecha || '').toString().trim())
          if (fecha === null) {
            errors.push({ fila, problema: `Fecha "${n.fecha}" no tiene formato válido`, tipo: 'error' })
            return
          }

          let metodo_pago_id = null
          let metodo_pago_nombre = ''
          const mpNombre = (n.metodo_pago || n.metodo_de_pago || '').toString().trim()
          if (mpNombre) {
            const metodo = metodosPago.find(m => m.nombre.toLowerCase() === mpNombre.toLowerCase())
            if (metodo) {
              metodo_pago_id = metodo.id
              metodo_pago_nombre = metodo.nombre
            } else {
              errors.push({ fila, problema: `Método de pago "${mpNombre}" no existe → se importará sin método`, tipo: 'warning' })
            }
          }

          nuevos.push({
            tipo: 'INGRESO',
            valor,
            categoria: 'MEMBRESIA',
            metodo_pago_id,
            metodo_pago_nombre,
            placa_o_persona: (n.placa_o_persona || '').toString().trim(),
            descripcion: (n.descripcion || '').toString().trim(),
            fecha
          })
        } else {
          // Movimientos
          const tipoRaw = (n.tipo || '').toString().trim().toUpperCase()
          const valorRaw = (n.valor || '').toString().trim()
          const categoriaRaw = (n.categoria || '').toString().trim().toUpperCase()

          const camposVacios = []
          if (!tipoRaw) camposVacios.push('tipo')
          if (!valorRaw) camposVacios.push('valor')
          if (!categoriaRaw) camposVacios.push('categoria')
          if (camposVacios.length > 0) {
            errors.push({ fila, problema: `Columna "${camposVacios.join('", "')}" vacía`, tipo: 'error' })
            return
          }

          if (!['INGRESO', 'EGRESO'].includes(tipoRaw)) {
            errors.push({ fila, problema: `Tipo "${tipoRaw}" no válido (usa INGRESO o EGRESO)`, tipo: 'error' })
            return
          }

          const valor = Number(valorRaw.replace(/[^\d]/g, ''))
          if (!valor || isNaN(valor)) {
            errors.push({ fila, problema: `Valor "${valorRaw}" no es numérico`, tipo: 'error' })
            return
          }

          if (!categoriasValidas.includes(categoriaRaw)) {
            errors.push({ fila, problema: `Categoría "${categoriaRaw}" no válida`, tipo: 'error' })
            return
          }

          const fecha = parseFecha(n.fecha instanceof Date ? n.fecha : (n.fecha || '').toString().trim())
          if (fecha === null) {
            errors.push({ fila, problema: `Fecha "${n.fecha}" no tiene formato válido`, tipo: 'error' })
            return
          }

          let metodo_pago_id = null
          let metodo_pago_nombre = ''
          const mpNombre = (n.metodo_pago || n.metodo_de_pago || '').toString().trim()
          if (mpNombre) {
            const metodo = metodosPago.find(m => m.nombre.toLowerCase() === mpNombre.toLowerCase())
            if (metodo) {
              metodo_pago_id = metodo.id
              metodo_pago_nombre = metodo.nombre
            } else {
              errors.push({ fila, problema: `Método de pago "${mpNombre}" no existe → se importará sin método`, tipo: 'warning' })
            }
          }

          nuevos.push({
            tipo: tipoRaw,
            valor,
            categoria: categoriaRaw,
            metodo_pago_id,
            metodo_pago_nombre,
            placa_o_persona: (n.placa_o_persona || '').toString().trim(),
            descripcion: (n.descripcion || '').toString().trim(),
            fecha
          })
        }
      })

      setImportErrors(errors)
      setImportNuevos(nuevos)
      setImportStep('preview')
    }
    if (isCSV) {
      reader.readAsText(file, 'UTF-8')
    } else {
      reader.readAsArrayBuffer(file)
    }
  }

  const ejecutarImportacion = async () => {
    setImportStep('importing')
    setImportProgress(0)

    let insertados = 0
    let errores = 0
    const failedRows = []
    const total = importNuevos.length
    let procesados = 0

    for (const row of importNuevos) {
      const { error } = await supabase.from('transacciones').insert([{
        tipo: row.tipo,
        valor: row.valor,
        categoria: row.categoria,
        metodo_pago_id: row.metodo_pago_id,
        placa_o_persona: row.placa_o_persona,
        descripcion: row.descripcion,
        fecha: row.fecha,
        negocio_id: negocioId
      }])
      if (error) {
        errores++
        failedRows.push({ descripcion: row.descripcion || row.placa_o_persona || `Fila ${procesados + 1}`, error: error.message })
      } else {
        insertados++
      }
      procesados++
      setImportProgress(Math.round((procesados / total) * 100))
    }

    // Refresh transacciones
    let query = supabase.from('transacciones').select('*, metodo_pago:metodos_pago(nombre)').order('fecha', { ascending: false }).order('created_at', { ascending: false })
    if (fechaDesde) query = query.gte('fecha', fechaLocalStr(fechaDesde))
    if (fechaHasta) {
      const hasta = new Date(fechaHasta)
      hasta.setDate(hasta.getDate() + 1)
      query = query.lt('fecha', fechaLocalStr(hasta))
    }
    const { data } = await query
    setTransacciones(data || [])

    setImportResult({ insertados, errores, failedRows })
    setImportStep('done')
  }

  const resetImport = () => {
    setShowImportModal(false)
    setImportErrors([])
    setImportNuevos([])
    setImportStep('upload')
    setImportProgress(0)
    setImportResult(null)
    setImportTipo('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="home-page">
      {/* Balance Carousel */}
      <div className="home-balance-carousel">
        <div className="home-balance-card balance">
          <span className="home-balance-label balance-title">Balance - {periodoLabel}</span>
          <span className={`home-balance-amount ${balance >= 0 ? 'positivo' : 'negativo'}`}>
            {formatMoney(balance)}
          </span>
          <div className="balance-chart">
            <ResponsiveContainer width="100%" height={80}>
              <AreaChart data={balanceChartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                <defs>
                  <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent-blue)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--accent-blue)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} interval="preserveStartEnd" />
                <Area type="monotone" dataKey="value" stroke="var(--accent-blue)" strokeWidth={2} fill="url(#balanceGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="home-balance-card ingresos">
          {donutData ? (
            <>
              <div className="ingresos-header">
                <span className="home-balance-label ingresos-title">Ingresos - {periodoLabel}</span>
                <div className="ingresos-chart-toggle">
                  <button
                    className={`ingresos-toggle-btn ${chartMode === 'categoria' ? 'active' : ''}`}
                    onClick={() => setChartMode('categoria')}
                  >
                    Categoría
                  </button>
                  <button
                    className={`ingresos-toggle-btn ${chartMode === 'metodo' ? 'active' : ''}`}
                    onClick={() => setChartMode('metodo')}
                  >
                    Método
                  </button>
                </div>
              </div>
              <div className="ingresos-body">
                <div className="ingresos-left">
                  <span className="home-balance-amount positivo">{formatMoney(ingresos)}</span>
                  <div className="ingresos-legend">
                    {donutData.segments.map(s => (
                      <div key={s.label} className="ingresos-legend-item">
                        <span className="ingresos-legend-dot" style={{ background: s.color }} />
                        <span className="ingresos-legend-label">{s.label}</span>
                        <span className="ingresos-legend-value">{formatMoneyShort(s.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="ingresos-right">
                  <div className="ingresos-donut" style={{ background: `conic-gradient(${donutData.gradient})` }}>
                    <div className="ingresos-donut-hole" />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <span className="home-balance-label ingresos-title">Ingresos - {periodoLabel}</span>
              <span className="home-balance-amount positivo">{formatMoney(ingresos)}</span>
            </>
          )}
        </div>
        <div className="home-balance-card egresos">
          {donutDataEgresos ? (
            <>
              <div className="egresos-header">
                <span className="home-balance-label egresos-title">Egresos - {periodoLabel}</span>
                <div className="egresos-chart-toggle">
                  <button
                    className={`egresos-toggle-btn ${chartModeEgresos === 'categoria' ? 'active' : ''}`}
                    onClick={() => setChartModeEgresos('categoria')}
                  >
                    Categoría
                  </button>
                  <button
                    className={`egresos-toggle-btn ${chartModeEgresos === 'metodo' ? 'active' : ''}`}
                    onClick={() => setChartModeEgresos('metodo')}
                  >
                    Método
                  </button>
                </div>
              </div>
              <div className="egresos-body">
                <div className="egresos-left">
                  <span className="home-balance-amount negativo">{formatMoney(egresos)}</span>
                  <div className="egresos-legend">
                    {donutDataEgresos.segments.map(s => (
                      <div key={s.label} className="egresos-legend-item">
                        <span className="egresos-legend-dot" style={{ background: s.color }} />
                        <span className="egresos-legend-label">{s.label}</span>
                        <span className="egresos-legend-value">{formatMoneyShort(s.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="egresos-right">
                  <div className="egresos-donut" style={{ background: `conic-gradient(${donutDataEgresos.gradient})` }}>
                    <div className="egresos-donut-hole" />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <span className="home-balance-label egresos-title">Egresos - {periodoLabel}</span>
              <span className="home-balance-amount negativo">{formatMoney(egresos)}</span>
            </>
          )}
        </div>
      </div>

      {/* Period Pills */}
      <div className="home-period-pills">
        <div className="home-period-bubble" style={{ transform: `translateX(${periodIdx * 100}%)` }} />
        {['d', 's', 'm', 'a'].map(p => (
          <button
            key={p}
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
          onClick={() => { setTab('servicios'); setFiltroEstado(''); setFiltroLavador(''); setFiltroTipo(''); setFiltroMetodoPago(''); setModoSeleccion(false); setSelectedItems(new Set()) }}
        >
          Servicios
        </button>
        <button
          className={`home-tab-pill ${tab === 'productos' ? 'active' : ''}`}
          onClick={() => { setTab('productos'); setFiltroEstado(''); setFiltroLavador(''); setFiltroTipo(''); setFiltroMetodoPago(''); setModoSeleccion(false); setSelectedItems(new Set()) }}
        >
          Prod/Memb
        </button>
        <button
          className={`home-tab-pill ${tab === 'movimientos' ? 'active' : ''}`}
          onClick={() => { setTab('movimientos'); setFiltroEstado(''); setFiltroLavador(''); setFiltroTipo(''); setFiltroMetodoPago(''); setModoSeleccion(false); setSelectedItems(new Set()) }}
        >
          Movimientos
        </button>
      </div>

      {/* Recent Cards */}
      <div className="home-section-header">
        <p className="home-section-title">
          Recientes — {{ servicios: 'Servicios', productos: 'Prod/Memb', movimientos: 'Movimientos' }[tab]}
        </p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={`home-filter-btn ${modoSeleccion ? 'active' : ''}`}
            onClick={() => { setModoSeleccion(prev => !prev); setSelectedItems(new Set()) }}
          >
            <CheckSquare size={16} />
          </button>
          <button
            className={`home-filter-btn ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(prev => !prev)}
          >
            <SlidersHorizontal size={16} />
          </button>
        </div>
      </div>
      {showFilters && (
        <div className="home-filters-panel">
          {tab === 'servicios' && (
            <>
              <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
                <option value="">Todos los estados</option>
                {Object.entries(ESTADO_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <select value={filtroLavador} onChange={e => setFiltroLavador(e.target.value)}>
                <option value="">Todos los lavadores</option>
                {lavadores.map(l => (
                  <option key={l.id} value={l.id}>{l.nombre}</option>
                ))}
              </select>
            </>
          )}
          {(tab === 'productos' || tab === 'movimientos') && (
            <>
              <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
                <option value="">Ingreso y Egreso</option>
                <option value="INGRESO">Ingreso</option>
                <option value="EGRESO">Egreso</option>
              </select>
              <select value={filtroMetodoPago} onChange={e => setFiltroMetodoPago(e.target.value)}>
                <option value="">Todos los metodos</option>
                {metodosPago.map(m => (
                  <option key={m.id} value={m.id}>{m.nombre}</option>
                ))}
              </select>
            </>
          )}
        </div>
      )}
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
                  selectionMode={modoSeleccion}
                  isSelected={selectedItems.has(item.id)}
                  onToggleSelect={toggleSelectItem}
                  isHighlighted={highlightId === item.id}
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
            recentProductos.map(item => {
              const isExpanded = expandedProductCard === item.id
              const isEditing = editProductId === item.id && editProductData
              return (
                <div key={item.id} data-id={item.id}
                  className={`home-recent-card ${isExpanded ? 'expanded' : ''} ${modoSeleccion && selectedItems.has(item.id) ? 'card-selected' : ''} ${highlightId === item.id ? 'card-highlight' : ''}`}>
                  <div className="home-recent-card-header"
                    onClick={() => {
                      if (modoSeleccion) { toggleSelectItem(item.id); return }
                      setExpandedProductCard(isExpanded ? null : item.id)
                      if (isExpanded) { cancelarEdicionProducto() }
                    }}>
                    {modoSeleccion && (
                      <label className="custom-check" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedItems.has(item.id)} onChange={() => toggleSelectItem(item.id)} />
                        <span className="checkmark"></span>
                      </label>
                    )}
                    <div className="home-recent-card-left">
                      <span className="home-recent-placa">{item.descripcion || item.placa_o_persona || item.categoria}</span>
                      <span className="home-recent-desc">
                        {item.categoria}{item.placa_o_persona ? ` · ${item.placa_o_persona.includes(' - ') ? item.placa_o_persona.split(' - ').pop() : item.placa_o_persona}` : ''} · {formatFechaRelativa(item.fecha)}
                      </span>
                    </div>
                    <div className="home-recent-card-right">
                      <span className={`home-recent-valor ${item.tipo === 'INGRESO' ? 'positivo' : 'negativo'}`}>
                        {item.tipo === 'EGRESO' ? '-' : ''}{formatMoney(item.valor)}
                      </span>
                      <ChevronDown size={16} className={`home-recent-chevron ${isExpanded ? 'rotated' : ''}`} />
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="home-recent-card-body">
                      {isEditing ? (
                        <div className="home-product-edit-form">
                          <div className="edit-row">
                            <label>Valor</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={editProductData.valorDisplay}
                              onChange={(e) => handleEditProductoValorChange(e.target.value)}
                              placeholder="$0"
                              autoFocus
                            />
                          </div>
                          <div className="edit-row">
                            <label>Método de pago</label>
                            <select
                              value={editProductData.metodo_pago_id}
                              onChange={(e) => setEditProductData(prev => ({ ...prev, metodo_pago_id: e.target.value }))}
                            >
                              <option value="">Seleccionar</option>
                              {metodosPago.map(m => (
                                <option key={m.id} value={m.id}>{m.nombre}</option>
                              ))}
                            </select>
                          </div>
                          <div className="edit-row">
                            <label>Descripción</label>
                            <input
                              type="text"
                              value={editProductData.descripcion}
                              onChange={(e) => setEditProductData(prev => ({ ...prev, descripcion: e.target.value }))}
                              placeholder="Descripción"
                            />
                          </div>
                          <div className="edit-row">
                            <label>Placa/Persona</label>
                            <input
                              type="text"
                              value={editProductData.placa_o_persona}
                              onChange={(e) => setEditProductData(prev => ({ ...prev, placa_o_persona: e.target.value }))}
                              placeholder="Placa o persona"
                            />
                          </div>
                          <div className="edit-row">
                            <label>Fecha</label>
                            <input
                              type="date"
                              value={editProductData.fecha}
                              onChange={(e) => setEditProductData(prev => ({ ...prev, fecha: e.target.value }))}
                            />
                          </div>
                          <div className="home-product-edit-actions">
                            <button className="btn-secondary" onClick={cancelarEdicionProducto}>Cancelar</button>
                            <button className="btn-primary" onClick={() => guardarEdicionProducto(item.id)}>
                              <Check size={16} /> Guardar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="home-recent-detail-row">
                            <span className="home-recent-detail-label">Tipo</span>
                            <span className={`tipo-badge ${item.tipo.toLowerCase()}`}>{item.tipo}</span>
                          </div>
                          <div className="home-recent-detail-row">
                            <span className="home-recent-detail-label">Categoría</span>
                            <span>{item.categoria}</span>
                          </div>
                          <div className="home-recent-detail-row">
                            <span className="home-recent-detail-label">Placa/Persona</span>
                            <span>{item.placa_o_persona || '—'}</span>
                          </div>
                          <div className="home-recent-detail-row">
                            <span className="home-recent-detail-label">Método</span>
                            <span>{item.metodo_pago?.nombre || '—'}</span>
                          </div>
                          <div className="home-recent-detail-row">
                            <span className="home-recent-detail-label">Fecha</span>
                            <span>{item.fecha?.split('T')[0]?.split('-').reverse().join('/') || '—'}</span>
                          </div>
                          <div className="home-recent-card-actions">
                            <button className="btn-secondary" onClick={() => iniciarEdicionProducto(item)}>
                              <Pencil size={16} /> Editar
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })
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
            recentMovimientos.map(item => {
              const isExpanded = expandedProductCard === item.id
              const isEditing = editProductId === item.id && editProductData
              return (
                <div key={item.id} data-id={item.id}
                  className={`home-recent-card ${isExpanded ? 'expanded' : ''} ${modoSeleccion && selectedItems.has(item.id) ? 'card-selected' : ''} ${highlightId === item.id ? 'card-highlight' : ''}`}>
                  <div className="home-recent-card-header"
                    onClick={() => {
                      if (modoSeleccion) { toggleSelectItem(item.id); return }
                      setExpandedProductCard(isExpanded ? null : item.id)
                      if (isExpanded) { cancelarEdicionProducto() }
                    }}>
                    {modoSeleccion && (
                      <label className="custom-check" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedItems.has(item.id)} onChange={() => toggleSelectItem(item.id)} />
                        <span className="checkmark"></span>
                      </label>
                    )}
                    <div className="home-recent-card-left">
                      <span className="home-recent-placa">{item.descripcion || item.placa_o_persona || item.categoria}</span>
                      <span className="home-recent-desc">
                        {item.categoria}{item.placa_o_persona ? ` · ${item.placa_o_persona.includes(' - ') ? item.placa_o_persona.split(' - ').pop() : item.placa_o_persona}` : ''} · {formatFechaRelativa(item.fecha)}
                      </span>
                    </div>
                    <div className="home-recent-card-right">
                      <span className={`home-recent-valor ${item.tipo === 'INGRESO' ? 'positivo' : 'negativo'}`}>
                        {item.tipo === 'EGRESO' ? '-' : ''}{formatMoney(item.valor)}
                      </span>
                      <ChevronDown size={16} className={`home-recent-chevron ${isExpanded ? 'rotated' : ''}`} />
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="home-recent-card-body">
                      {isEditing ? (
                        <div className="home-product-edit-form">
                          <div className="edit-row">
                            <label>Valor</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={editProductData.valorDisplay}
                              onChange={(e) => handleEditProductoValorChange(e.target.value)}
                              placeholder="$0"
                              autoFocus
                            />
                          </div>
                          <div className="edit-row">
                            <label>Método de pago</label>
                            <select
                              value={editProductData.metodo_pago_id}
                              onChange={(e) => setEditProductData(prev => ({ ...prev, metodo_pago_id: e.target.value }))}
                            >
                              <option value="">Seleccionar</option>
                              {metodosPago.map(m => (
                                <option key={m.id} value={m.id}>{m.nombre}</option>
                              ))}
                            </select>
                          </div>
                          <div className="edit-row">
                            <label>Descripción</label>
                            <input
                              type="text"
                              value={editProductData.descripcion}
                              onChange={(e) => setEditProductData(prev => ({ ...prev, descripcion: e.target.value }))}
                              placeholder="Descripción"
                            />
                          </div>
                          <div className="edit-row">
                            <label>Placa/Persona</label>
                            <input
                              type="text"
                              value={editProductData.placa_o_persona}
                              onChange={(e) => setEditProductData(prev => ({ ...prev, placa_o_persona: e.target.value }))}
                              placeholder="Placa o persona"
                            />
                          </div>
                          <div className="edit-row">
                            <label>Fecha</label>
                            <input
                              type="date"
                              value={editProductData.fecha}
                              onChange={(e) => setEditProductData(prev => ({ ...prev, fecha: e.target.value }))}
                            />
                          </div>
                          <div className="home-product-edit-actions">
                            <button className="btn-secondary" onClick={cancelarEdicionProducto}>Cancelar</button>
                            <button className="btn-primary" onClick={() => guardarEdicionProducto(item.id)}>
                              <Check size={16} /> Guardar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="home-recent-detail-row">
                            <span className="home-recent-detail-label">Tipo</span>
                            <span className={`tipo-badge ${item.tipo.toLowerCase()}`}>{item.tipo}</span>
                          </div>
                          <div className="home-recent-detail-row">
                            <span className="home-recent-detail-label">Categoría</span>
                            <span>{item.categoria}</span>
                          </div>
                          <div className="home-recent-detail-row">
                            <span className="home-recent-detail-label">Placa/Persona</span>
                            <span>{item.placa_o_persona || '—'}</span>
                          </div>
                          <div className="home-recent-detail-row">
                            <span className="home-recent-detail-label">Método</span>
                            <span>{item.metodo_pago?.nombre || '—'}</span>
                          </div>
                          <div className="home-recent-detail-row">
                            <span className="home-recent-detail-label">Fecha</span>
                            <span>{item.fecha?.split('T')[0]?.split('-').reverse().join('/') || '—'}</span>
                          </div>
                          <div className="home-recent-card-actions">
                            <button className="btn-secondary" onClick={() => iniciarEdicionProducto(item)}>
                              <Pencil size={16} /> Editar
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })
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

      {/* Bulk Action Bar */}
      {modoSeleccion && selectedItems.size > 0 && (
        <div className="bulk-action-bar">
          <span>{selectedItems.size} seleccionado{selectedItems.size > 1 ? 's' : ''}</span>
          <div className="bulk-action-buttons">
            <button className="btn-secondary" onClick={toggleSelectAll}>
              {selectedItems.size === currentList.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
            </button>
            <button className="btn-secondary" onClick={() => { setSelectedItems(new Set()); setModoSeleccion(false) }}>
              <X size={16} /> Cancelar
            </button>
            <button className="btn-danger" onClick={() => setShowDeleteModal(true)}>
              <Trash2 size={16} /> Eliminar
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>Confirmar eliminación</h2>
              <button className="btn-close" onClick={() => setShowDeleteModal(false)}>
                <X size={24} />
              </button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <p style={{ color: 'var(--text-secondary)' }}>
                Vas a eliminar <strong style={{ color: 'var(--accent-red, #ff4d4d)' }}>{selectedItems.size}</strong> elemento{selectedItems.size > 1 ? 's' : ''}. Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDeleteModal(false)} disabled={deleting}>Cancelar</button>
              <button className="btn-danger" onClick={handleBulkDelete} disabled={deleting}>
                <Trash2 size={16} /> {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="modal-overlay">
          <div className="modal import-modal">
            <div className="modal-header">
              <h2>Importar {importTipo === 'productos' ? 'Productos' : 'Movimientos'}</h2>
              <button className="btn-close" onClick={resetImport}>
                <X size={24} />
              </button>
            </div>
            <div className="import-body">
              {importStep === 'upload' && (
                <>
                  <button className="btn-secondary" onClick={descargarPlantilla} style={{ marginBottom: '1rem' }}>
                    <Download size={18} /> Descargar Plantilla
                  </button>
                  <div
                    className="import-drop-zone"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      const file = e.dataTransfer.files[0]
                      if (file) {
                        const dt = new DataTransfer()
                        dt.items.add(file)
                        fileInputRef.current.files = dt.files
                        handleImportFileUpload({ target: { files: [file] } })
                      }
                    }}
                  >
                    <Upload size={32} />
                    <p>Arrastra un archivo o haz clic para seleccionar</p>
                    <span className="import-drop-hint">.csv, .xlsx, .xls</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleImportFileUpload}
                      style={{ display: 'none' }}
                    />
                  </div>
                  <div className="import-instructions">
                    {importTipo === 'productos' ? (
                      <>
                        <p>Columna obligatoria: <strong>valor</strong></p>
                        <p>Opcionales: metodo_pago, placa_o_persona, descripcion, fecha</p>
                      </>
                    ) : (
                      <>
                        <p>Columnas obligatorias: <strong>tipo</strong>, <strong>valor</strong>, <strong>categoria</strong></p>
                        <p>Opcionales: metodo_pago, placa_o_persona, descripcion, fecha</p>
                      </>
                    )}
                  </div>
                </>
              )}

              {importStep === 'preview' && (
                <>
                  <div className="import-summary">
                    <div className="import-stat stat-green">
                      <span className="import-stat-value">{importNuevos.length}</span>
                      <span className="import-stat-label">{importTipo === 'productos' ? 'Productos' : 'Movimientos'} válidos</span>
                    </div>
                    <div className="import-stat stat-red">
                      <span className="import-stat-value">{importErrors.filter(e => e.tipo !== 'warning').length}</span>
                      <span className="import-stat-label">Errores</span>
                    </div>
                  </div>

                  {importErrors.filter(e => e.tipo !== 'warning').length > 0 && (
                    <div className="import-errors">
                      <h4>Errores — estas filas no se importarán</h4>
                      {importErrors.filter(e => e.tipo !== 'warning').map((err, i) => (
                        <div key={i} className="import-error-item">
                          <div className="import-error-fila">Fila {err.fila}</div>
                          <div className="import-error-problema">{err.problema}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {importErrors.filter(e => e.tipo === 'warning').length > 0 && (
                    <div className="import-warnings">
                      <h4>Advertencias — se importarán con ajustes</h4>
                      {importErrors.filter(e => e.tipo === 'warning').map((err, i) => (
                        <div key={i} className="import-warning-item">
                          <div className="import-error-fila">Fila {err.fila}</div>
                          <div className="import-error-problema">{err.problema}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {importNuevos.length > 0 && (
                    <div className="import-preview-wrapper">
                      <h4>Vista previa</h4>
                      <div className="import-preview-table-wrapper">
                        <table className="import-preview-table">
                          <thead>
                            <tr>
                              {importTipo === 'productos' ? (
                                <>
                                  <th>Valor</th>
                                  <th>Persona/Placa</th>
                                  <th>Descripción</th>
                                  <th>Fecha</th>
                                  <th>M. Pago</th>
                                </>
                              ) : (
                                <>
                                  <th>Tipo</th>
                                  <th>Valor</th>
                                  <th>Categoría</th>
                                  <th>Fecha</th>
                                  <th>M. Pago</th>
                                </>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {importNuevos.slice(0, 10).map((row, i) => (
                              <tr key={i}>
                                {importTipo === 'productos' ? (
                                  <>
                                    <td>{formatMoney(row.valor)}</td>
                                    <td>{row.placa_o_persona || '—'}</td>
                                    <td>{row.descripcion || '—'}</td>
                                    <td>{new Date(row.fecha).toLocaleDateString('es-CO')}</td>
                                    <td>{row.metodo_pago_nombre || '—'}</td>
                                  </>
                                ) : (
                                  <>
                                    <td>{row.tipo}</td>
                                    <td>{formatMoney(row.valor)}</td>
                                    <td>{row.categoria}</td>
                                    <td>{new Date(row.fecha).toLocaleDateString('es-CO')}</td>
                                    <td>{row.metodo_pago_nombre || '—'}</td>
                                  </>
                                )}
                              </tr>
                            ))}
                            {importNuevos.length > 10 && (
                              <tr><td colSpan="5" className="import-more">... y {importNuevos.length - 10} más</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="modal-footer">
                    <button className="btn-secondary" onClick={resetImport}>Cancelar</button>
                    <button
                      className="btn-primary"
                      onClick={ejecutarImportacion}
                      disabled={importNuevos.length === 0}
                    >
                      Importar {importNuevos.length} {importTipo === 'productos' ? 'productos' : 'movimientos'}
                    </button>
                  </div>
                </>
              )}

              {importStep === 'importing' && (
                <div className="import-progress-container">
                  <p>Importando {importTipo === 'productos' ? 'productos' : 'movimientos'}...</p>
                  <div className="import-progress-bar">
                    <div className="import-progress-fill" style={{ width: `${importProgress}%` }}></div>
                  </div>
                  <span className="import-progress-text">{importProgress}%</span>
                </div>
              )}

              {importStep === 'done' && importResult && (
                <div className="import-done">
                  <div className="import-summary">
                    <div className="import-stat stat-green">
                      <span className="import-stat-value">{importResult.insertados}</span>
                      <span className="import-stat-label">Importados</span>
                    </div>
                    <div className="import-stat stat-red">
                      <span className="import-stat-value">{importResult.errores}</span>
                      <span className="import-stat-label">Errores</span>
                    </div>
                  </div>
                  {importResult.failedRows?.length > 0 && (
                    <div className="import-errors">
                      <h4>Items que no se pudieron importar</h4>
                      {importResult.failedRows.map((f, i) => (
                        <div key={i} className="import-error-item">
                          <div className="import-error-fila">{f.descripcion}</div>
                          <div className="import-error-problema">{f.error}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="modal-footer">
                    <button className="btn-primary" onClick={resetImport}>Cerrar</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Search FAB */}
      {!showFabMenu && !modoSeleccion && (
        <button className="home-search-fab" onClick={openSearch}>
          <Search size={20} />
        </button>
      )}

      {/* FAB */}
      {!modoSeleccion && (
        <button
          className={`home-fab ${showFabMenu ? 'open' : ''}`}
          onClick={() => setShowFabMenu(!showFabMenu)}
        >
          <Plus size={24} />
        </button>
      )}
      {showFabMenu && (
        <>
          <div className="home-fab-overlay" onClick={() => setShowFabMenu(false)} />
          <div className="home-fab-menu">
            <button onClick={() => { setShowFabMenu(false); setShowServicioModal(true) }}>
              <Droplets size={18} /> Nuevo Servicio
            </button>
            <button onClick={() => { setShowFabMenu(false); setShowVentaModal(true) }}>
              <DollarSign size={18} /> Nueva Venta
            </button>
            <button onClick={() => {
              setShowFabMenu(false)
              if (tab === 'servicios') {
                navigate('/lavadas?import=1')
              } else {
                setImportTipo(tab)
                setShowImportModal(true)
              }
            }}>
              <Upload size={18} /> Importar {{ servicios: 'Servicios', productos: 'Productos', movimientos: 'Movimientos' }[tab]}
            </button>
          </div>
        </>
      )}

      {/* Modal Nueva Venta (bottom-sheet) */}
      {showVentaModal && (
        <div className="modal-overlay" onClick={handleCloseVenta}>
          <div
            className="modal modal-sheet"
            ref={ventaSheetRef}
            onClick={e => e.stopPropagation()}
            style={ventaDragY > 0 ? { transform: `translateY(${ventaDragY}px)`, transition: 'none' } : {}}
          >
            {/* Drag handle */}
            <div
              className="modal-sheet-handle"
              onTouchStart={onVentaSheetTouchStart}
              onTouchMove={onVentaSheetTouchMove}
              onTouchEnd={onVentaSheetTouchEnd}
            >
              <div className="modal-sheet-handle-bar" />
            </div>

            {/* Header: X | título | Guardar */}
            <div className="modal-sheet-header">
              <button className="btn-sheet-close" onClick={handleCloseVenta}>
                <X size={20} />
              </button>
              <h2>Nueva Venta</h2>
              <button
                className="btn-sheet-action"
                onClick={handleVentaSubmit}
                disabled={submitting || !ventaForm.cliente_id || ventaForm.pagos.length === 0 || ventaForm.pagos.some(p => !p.metodo_pago_id)}
              >
                {submitting ? 'Guardando...' : 'Guardar'}
              </button>
            </div>

            <form onSubmit={e => e.preventDefault()}>
              {/* 1. Cliente (obligatorio) */}
              <div className="form-group cliente-search-group">
                <label>Cliente *</label>
                <div className="cliente-search-wrapper" ref={ventaClienteWrapperRef}>
                  <input
                    type="text"
                    value={ventaClienteSearch}
                    onChange={(e) => {
                      setVentaClienteSearch(e.target.value)
                      setShowVentaClienteDropdown(true)
                      if (!e.target.value) {
                        setVentaForm(prev => ({ ...prev, cliente_id: '' }))
                      }
                    }}
                    onFocus={() => setShowVentaClienteDropdown(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setShowVentaClienteDropdown(false)
                        e.target.blur()
                      }
                    }}
                    placeholder="Buscar por nombre o placa..."
                    autoComplete="off"
                  />
                  {ventaForm.cliente_id && (
                    <button
                      type="button"
                      className="cliente-search-clear"
                      onClick={() => {
                        setVentaClienteSearch('')
                        setShowVentaClienteDropdown(false)
                        setVentaForm(prev => ({ ...prev, cliente_id: '' }))
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                  {showVentaClienteDropdown && !ventaForm.cliente_id && (
                    <div className="cliente-search-dropdown">
                      {clientes
                        .filter(c => {
                          const q = ventaClienteSearch.toLowerCase()
                          return !q || c.nombre?.toLowerCase().includes(q) || c.placa?.toLowerCase().includes(q)
                        })
                        .slice(0, 8)
                        .map(c => (
                          <div
                            key={c.id}
                            className="cliente-search-option"
                            onMouseDown={() => handleVentaClienteChange(c.id)}
                          >
                            <span className="cliente-search-nombre">{c.nombre}</span>
                            <span className="cliente-search-placa">{c.placa}</span>
                          </div>
                        ))}
                      {clientes.filter(c => {
                        const q = ventaClienteSearch.toLowerCase()
                        return !q || c.nombre?.toLowerCase().includes(q) || c.placa?.toLowerCase().includes(q)
                      }).length === 0 && (
                        <div className="cliente-search-empty">
                          No se encontraron clientes
                          <button
                            type="button"
                            className="btn-nuevo-cliente-inline"
                            onMouseDown={() => {
                              setShowVentaNuevoCliente(true)
                              setShowVentaClienteDropdown(false)
                              setVentaNuevoClienteData({ nombre: ventaClienteSearch, placa: '', telefono: '' })
                            }}
                          >
                            <Plus size={14} /> Agregar cliente
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {showVentaNuevoCliente && (
                    <div className="nuevo-cliente-inline">
                      <div className="nuevo-cliente-inline-header">
                        <span>Nuevo cliente</span>
                        <button type="button" onClick={() => setShowVentaNuevoCliente(false)}><X size={14} /></button>
                      </div>
                      <input
                        type="text"
                        placeholder="Nombre"
                        value={ventaNuevoClienteData.nombre}
                        onChange={(e) => setVentaNuevoClienteData(prev => ({ ...prev, nombre: e.target.value }))}
                        autoFocus
                      />
                      <input
                        type="text"
                        placeholder="Placa"
                        value={ventaNuevoClienteData.placa}
                        onChange={(e) => setVentaNuevoClienteData(prev => ({ ...prev, placa: e.target.value }))}
                      />
                      <input
                        type="text"
                        placeholder="Teléfono (opcional)"
                        value={ventaNuevoClienteData.telefono}
                        onChange={(e) => setVentaNuevoClienteData(prev => ({ ...prev, telefono: e.target.value }))}
                      />
                      <button
                        type="button"
                        className="btn-primary btn-crear-cliente"
                        onClick={handleCrearVentaCliente}
                        disabled={creandoVentaCliente || !ventaNuevoClienteData.nombre || !ventaNuevoClienteData.placa}
                      >
                        {creandoVentaCliente ? 'Creando...' : 'Crear y seleccionar'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Tipo de venta (toggle segmentado) */}
              <div className="form-group">
                <label>Tipo de venta</label>
                <div className="venta-tipo-toggle">
                  <button
                    type="button"
                    className={`venta-tipo-btn ${ventaForm.tipo_venta === 'PRODUCTO' ? 'active' : ''}`}
                    onClick={() => { setVentaForm(prev => ({ ...prev, tipo_venta: 'PRODUCTO', producto_id: '', cantidad: 1, membresia_id: '', fecha_activacion: null, valor: '', pagos: [] })); setVentaEditingPago(null) }}
                  >
                    Producto
                  </button>
                  <button
                    type="button"
                    className={`venta-tipo-btn ${ventaForm.tipo_venta === 'MEMBRESIA' ? 'active' : ''}`}
                    onClick={() => { setVentaEditingPago(null); setVentaForm(prev => ({ ...prev, tipo_venta: 'MEMBRESIA', producto_id: '', cantidad: 1, membresia_id: '', fecha_activacion: new Date(), valor: '', pagos: [] })); if (ventaForm.cliente_id) { const c = clientes.find(cl => cl.id == ventaForm.cliente_id); if (c) checkVentaMembresiaActiva(c) } }}
                  >
                    Membresía
                  </button>
                </div>
              </div>

              {/* 3A. Producto fields */}
              {ventaForm.tipo_venta === 'PRODUCTO' && (
                <div className="form-grid">
                  <div className="form-group">
                    <label>Producto</label>
                    <select
                      value={ventaForm.producto_id}
                      onChange={(e) => {
                        const prodId = e.target.value
                        if (prodId) {
                          const prod = productos.find(p => p.id === prodId)
                          if (prod) {
                            const precioTotal = Number(prod.precio) * ventaForm.cantidad
                            setVentaForm(prev => ({ ...prev, producto_id: prodId, valor: precioTotal.toLocaleString('es-CO') }))
                          }
                        } else {
                          setVentaForm(prev => ({ ...prev, producto_id: '', valor: '' }))
                        }
                      }}
                    >
                      <option value="">Seleccionar producto</option>
                      {productos.filter(p => p.activo && p.cantidad > 0).map(p => (
                        <option key={p.id} value={p.id}>{p.nombre} ({p.cantidad} disp.)</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Cantidad</label>
                    <input
                      type="number"
                      min="1"
                      max={ventaForm.producto_id ? (productos.find(p => p.id === ventaForm.producto_id)?.cantidad || 1) : 999}
                      value={ventaForm.cantidad}
                      onChange={(e) => {
                        const cant = Math.max(1, Number(e.target.value) || 1)
                        const prod = productos.find(p => p.id === ventaForm.producto_id)
                        const maxStock = prod ? prod.cantidad : 999
                        const cantFinal = Math.min(cant, maxStock)
                        const newValor = prod ? (Number(prod.precio) * cantFinal).toLocaleString('es-CO') : ventaForm.valor
                        setVentaForm(prev => ({ ...prev, cantidad: cantFinal, valor: newValor }))
                      }}
                    />
                  </div>
                </div>
              )}

              {/* 3B. Membresía fields */}
              {ventaForm.tipo_venta === 'MEMBRESIA' && (
                <div className="form-grid">
                  <div className="form-group">
                    <label>Membresía</label>
                    <select
                      value={ventaForm.membresia_id}
                      onChange={(e) => {
                        const membId = e.target.value
                        const memb = tiposMembresia.find(m => m.id === membId)
                        const precio = memb?.precio || 0
                        setVentaForm(prev => ({ ...prev, membresia_id: membId, valor: precio ? Number(precio).toLocaleString('es-CO') : '' }))
                      }}
                    >
                      <option value="">Seleccionar membresía</option>
                      {tiposMembresia
                        .filter(m => !m.nombre.toLowerCase().includes('sin '))
                        .map(m => (
                          <option key={m.id} value={m.id}>{m.nombre} - {formatMoney(m.precio || 0)}</option>
                        ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Fecha activación</label>
                    <DatePicker
                      selected={ventaForm.fecha_activacion}
                      onChange={(date) => setVentaForm(prev => ({ ...prev, fecha_activacion: date }))}
                      dateFormat="dd/MM/yyyy"
                      locale="es"
                      placeholderText="Seleccionar fecha"
                      minDate={minFechaActivacion}
                    />
                    {minFechaActivacion && (
                      <span style={{ color: '#f59e0b', fontSize: '0.8rem', marginTop: '0.35rem', display: 'block' }}>
                        Cliente tiene membresía activa hasta {(() => {
                          const fin = new Date(minFechaActivacion)
                          fin.setDate(fin.getDate() - 1)
                          const d = String(fin.getDate()).padStart(2, '0')
                          const m = String(fin.getMonth() + 1).padStart(2, '0')
                          const y = fin.getFullYear()
                          return `${d}/${m}/${y}`
                        })()}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* 4. Valor */}
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

              {/* 5. Pagos (múltiples métodos) */}
              <div className="form-group">
                <label>Pagos *</label>
                <div className="venta-pagos-wrapper">
                  {ventaForm.pagos.map((pago, idx) => (
                    ventaEditingPago === idx ? (
                      <span key={idx} className="pago-pill editing">
                        <select
                          className="pago-pill-select"
                          value={pago.metodo_pago_id}
                          onChange={(e) => {
                            const newPagos = [...ventaForm.pagos]
                            newPagos[idx] = { ...newPagos[idx], metodo_pago_id: e.target.value }
                            setVentaForm(prev => ({ ...prev, pagos: newPagos }))
                          }}
                          autoFocus
                        >
                          <option value="">Método</option>
                          {metodosPago.map(m => (
                            <option key={m.id} value={m.id}>{m.nombre}</option>
                          ))}
                        </select>
                        <input
                          className="pago-pill-input"
                          type="text"
                          inputMode="numeric"
                          value={pago.valor}
                          onChange={(e) => {
                            const limpio = e.target.value.replace(/[^\d]/g, '')
                            const formatted = limpio ? Number(limpio).toLocaleString('es-CO') : ''
                            const newPagos = [...ventaForm.pagos]
                            newPagos[idx] = { ...newPagos[idx], valor: formatted }
                            setVentaForm(prev => ({ ...prev, pagos: newPagos }))
                          }}
                          placeholder="$0"
                        />
                        <button type="button" className="pago-pill-x" onClick={() => setVentaEditingPago(null)}>
                          <X size={12} />
                        </button>
                      </span>
                    ) : (
                      <span key={idx} className="pago-pill" onClick={() => setVentaEditingPago(idx)}>
                        <span className="pago-pill-metodo">
                          {metodosPago.find(m => m.id === pago.metodo_pago_id)?.nombre || 'Sin método'}
                        </span>
                        <span className="pago-pill-valor">{formatMoney(Number(pago.valor.replace(/[^\d]/g, '') || 0))}</span>
                        <button type="button" className="pago-pill-x" onClick={(e) => {
                          e.stopPropagation()
                          const newPagos = ventaForm.pagos.filter((_, i) => i !== idx)
                          setVentaForm(prev => ({ ...prev, pagos: newPagos }))
                          if (ventaEditingPago === idx) setVentaEditingPago(null)
                          else if (ventaEditingPago > idx) setVentaEditingPago(ventaEditingPago - 1)
                        }}>
                          <X size={12} />
                        </button>
                      </span>
                    )
                  ))}
                  <button
                    type="button"
                    className="pago-pill-add"
                    onClick={() => {
                      const totalValor = Number(ventaForm.valor.replace(/[^\d]/g, '') || 0)
                      const sumaExistente = ventaForm.pagos.reduce((acc, p) => acc + Number(p.valor.replace(/[^\d]/g, '') || 0), 0)
                      const restante = Math.max(0, totalValor - sumaExistente)
                      const newPagos = [...ventaForm.pagos, { metodo_pago_id: '', valor: restante ? restante.toLocaleString('es-CO') : '' }]
                      setVentaForm(prev => ({ ...prev, pagos: newPagos }))
                      setVentaEditingPago(newPagos.length - 1)
                    }}
                  >
                    <Plus size={14} />
                  </button>
                </div>
                {(() => {
                  const totalValor = Number(ventaForm.valor.replace(/[^\d]/g, '') || 0)
                  const sumaPagos = ventaForm.pagos.reduce((acc, p) => acc + Number(p.valor.replace(/[^\d]/g, '') || 0), 0)
                  const diff = totalValor - sumaPagos
                  if (ventaForm.pagos.length > 0 && diff !== 0) {
                    return <span className="pago-diff-msg">{diff > 0 ? `Falta ${formatMoney(diff)}` : `Excede ${formatMoney(Math.abs(diff))}`}</span>
                  }
                  return null
                })()}
              </div>
            </form>
          </div>
        </div>
      )}
      <NuevoServicioSheet
        isOpen={showServicioModal}
        onClose={() => setShowServicioModal(false)}
        onSuccess={() => setShowServicioModal(false)}
      />

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
                  <div key={c.id} className="search-result-card" onClick={() => handleSearchNavigate('cliente', c)}>
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
                  <div key={l.id} className="search-result-card" onClick={() => handleSearchNavigate('servicio', l)}>
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
                  <div key={t.id} className="search-result-card" onClick={() => handleSearchNavigate('movimiento', t)}>
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
