import { useState, useEffect, useRef, useMemo, useCallback, Fragment, lazy, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../apiClient'
import { useData } from '../context/DataContext'
import { useTenant } from '../context/TenantContext'
import { getPhoneCode } from '../../config/currencies'
import { useServiceHandlers } from '../../hooks/useServiceHandlers'
import ServiceCard from '../shared/ServiceCard'
import SwipeableCard from '../shared/SwipeableCard'
import NuevoServicioSheet from '../shared/NuevoServicioSheet'
import NumberTicker from '../shared/NumberTicker'
import { formatMoney, formatMoneyShort, getCurrencySymbol, formatPriceLocale } from '../../utils/money'
import { useMoneyVisibility } from '../context/MoneyVisibilityContext'
import { useToast } from '../layout/Toast'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Cell, LabelList } from 'recharts'
import { ESTADO_LABELS, ESTADO_CLASSES } from '../../config/constants'
import { Plus, Droplets, DollarSign, X, Search, SlidersHorizontal, CheckSquare, Trash2, Upload, Download, ChevronDown, Pencil, Check, Eye, EyeOff, TrendingUp, TrendingDown, UserPlus, Calendar, Flag, CreditCard, User, ArrowUpDown, Wallet, Tag, ShoppingBag, ArrowLeftRight, ArrowLeft, Users, Wrench } from 'lucide-react'
import useIsMobile from '../../hooks/useIsMobile'
// PlanGuard removed — free plan now uses backend limits
import ConfirmDeleteModal from '../shared/ConfirmDeleteModal'
import UpgradeModal from '../payment/UpgradeModal'
import DatePicker, { registerLocale } from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import es from 'date-fns/locale/es'
import * as XLSX from 'xlsx'
import { fechaToBogotaDate, nowBogota, getTimezoneOffset } from '../../utils/date'

registerLocale('es', es)

const Clientes = lazy(() => import('./Clientes'))
const PagoTrabajadores = lazy(() => import('./PagoTrabajadores'))

function SearchPillMobile({ searchQuery, setSearchQuery, searchInputRef, onClose }) {
  const [bottomOffset, setBottomOffset] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      setBottomOffset(window.innerHeight - vv.height - vv.offsetTop)
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return (
    <>
      <div className="home-search-pill-overlay" onClick={onClose} />
      <div className="home-search-pill">
        <Search size={18} className="home-search-pill-icon" />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Buscar placa, cliente, producto..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoFocus
        />
        {searchQuery && (
          <button className="home-search-pill-clear" onClick={() => { setSearchQuery(''); searchInputRef.current?.focus() }}>
            <X size={16} />
          </button>
        )}
        <button className="home-search-pill-close" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
    </>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { lavadas, metodosPago, negocioId, clientes, deleteLavadaLocal, loadAllLavadas, lavadasAllLoaded, productos, refreshConfig, tiposMembresia, updateClienteLocal, addClienteLocal, refreshClientes, categoriasTransaccion, initialTransacciones, clearInitialTransacciones, transaccionesVersion } = useData()
  const { negocioNombre, userEmail, userProfile, isPro, pais } = useTenant()
  const phoneCode = getPhoneCode(pais)
  const isMobile = useIsMobile()
  const rol = userProfile?.rol || 'admin'
  const { showMoney, toggleMoney, displayMoney, displayMoneyShort } = useMoneyVisibility()
  const toast = useToast()

  const {
    expandedCards, setExpandedCards,
    editingPago, setEditingPago,
    validationErrors, setValidationErrors,
    collapsingCards,
    updatingCards,
    smoothCollapse,
    collapseAllExcept,
    getTimerProps,
    hasActiveTimer,
    getEstadoClass,
    handleEstadoChange,
    handleLavadorChange,
    handleTipoLavadoChangeInline,
    handlePagosChange,
    handleNotasChange,
    handleValorChange: handleServiceValorChange,
    handleAdicionalChange,
    pendingDeleteLavadaId, setPendingDeleteLavadaId,
    requestEliminarLavada, executeEliminarLavada,
    enviarWhatsApp,
    plantillasMensaje,
    tiposLavado,
    serviciosAdicionales,
    lavadores,
    metodosPago: _mp,
  } = useServiceHandlers()

  const [activePopoverId, setActivePopoverId] = useState(null)

  const [periodo, setPeriodo] = useState(() => {
    return localStorage.getItem('home-periodo') || 'm'
  })
  const validTabs = ['servicios', 'productos', 'movimientos', 'clientes', 'trabajadores']
  const [tab, setTab] = useState(() => {
    const urlTab = searchParams.get('tab')
    return urlTab && validTabs.includes(urlTab) ? urlTab : 'servicios'
  })
  const [transacciones, setTransacciones] = useState([])
  const [transaccionesReady, setTransaccionesReady] = useState(false)
  const [prevTransacciones, setPrevTransacciones] = useState([])
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
  const [visibleCount, setVisibleCount] = useState({ servicios: 20, productos: 20, movimientos: 20 })
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilterCards, setShowFilterCards] = useState(false)
  const [expandedFilterCard, setExpandedFilterCard] = useState(null)
  const [filtroEstado, setFiltroEstado] = useState([])
  const [showQuickFilter, setShowQuickFilter] = useState(false)
  const [quickFilterClosing, setQuickFilterClosing] = useState(false)
  const closeQuickFilter = useCallback(() => {
    setQuickFilterClosing(true)
    setTimeout(() => { setShowQuickFilter(false); setQuickFilterClosing(false) }, 200)
  }, [])
  const [filtroLavador, setFiltroLavador] = useState([])
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroMetodoPago, setFiltroMetodoPago] = useState('')
  // Nuevos filtros avanzados
  const [filtroPago, setFiltroPago] = useState('')
  const [filtroTipoLavado, setFiltroTipoLavado] = useState([])
  const [filtroAdicionales, setFiltroAdicionales] = useState([])
  const [filtroFechaDesde, setFiltroFechaDesde] = useState(null)
  const [filtroFechaHasta, setFiltroFechaHasta] = useState(null)
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const searchInputRef = useRef(null)
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false)
  const [showDesdeCalendar, setShowDesdeCalendar] = useState(false)
  const [showHastaCalendar, setShowHastaCalendar] = useState(false)
  const [modoSeleccion, setModoSeleccion] = useState(false)
  const [selectedItems, setSelectedItems] = useState(new Set())
  const [openSwipeId, setOpenSwipeId] = useState(null)
  const [swipeWaLavada, setSwipeWaLavada] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [highlightId, setHighlightId] = useState(null)
  const [clienteInfoModal, setClienteInfoModal] = useState(null)
  const [showNuevoClienteModal, setShowNuevoClienteModal] = useState(false)
  const [nuevoClienteData, setNuevoClienteData] = useState({
    nombre: '', cedula: '', telefono: '', correo: '', placa: '', moto: '',
    membresia_id: '', fecha_inicio_membresia: null, fecha_fin_membresia: null
  })
  const [creandoCliente, setCreandoCliente] = useState(false)

  // Expandable product cards
  const [expandedProductCard, setExpandedProductCard] = useState(null)
  const [pendingDeleteMovimientoId, setPendingDeleteMovimientoId] = useState(null)
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

  // Nuevo Movimiento (Ingreso/Egreso adicional)
  const [showMovimientoModal, setShowMovimientoModal] = useState(false)
  const [movimientoForm, setMovimientoForm] = useState({
    tipo: 'INGRESO',
    valor: '',
    categoria: '',
    metodo_pago_id: '',
    placa_o_persona: '',
    descripcion: '',
    fecha: ''
  })
  const [movimientoSubmitting, setMovimientoSubmitting] = useState(false)
  const movimientoSheetRef = useRef(null)
  const [movimientoDragY, setMovimientoDragY] = useState(0)
  const movimientoDragStartY = useRef(null)

  const defaultCatMov = {
    INGRESO: ['SERVICIO', 'ADICIONAL', 'OTRO'],
    EGRESO: ['INSUMOS', 'SERVICIOS', 'ABONO A SUELDO', 'ARRIENDO', 'PAGO TRABAJADOR', 'OTRO']
  }
  const catIngresosCustom = categoriasTransaccion.filter(c => c.tipo === 'INGRESO').map(c => c.nombre)
  const catEgresosCustom = categoriasTransaccion.filter(c => c.tipo === 'EGRESO').map(c => c.nombre)
  const categoriasMovimiento = {
    INGRESO: [...new Set([...defaultCatMov.INGRESO, ...catIngresosCustom])],
    EGRESO: [...new Set([...defaultCatMov.EGRESO, ...catEgresosCustom])],
  }

  const handleWhatsApp = (lavada, opts = {}) => {
    enviarWhatsApp(lavada, { ...opts, negocioNombre, userEmail, origen: 'servicios' })
  }

  // Bottom-sheet drag refs for Nueva Venta
  const ventaSheetRef = useRef(null)
  const [ventaDragY, setVentaDragY] = useState(0)
  const ventaDragStartY = useRef(null)

  // Auto-open UpgradeModal when coming from "Comprar ahora" flow
  const [showBalanceSheet, setShowBalanceSheet] = useState(false)
  const [closingBalanceSheet, setClosingBalanceSheet] = useState(false)
  const [activeBalancePanel, setActiveBalancePanel] = useState(null)
  const [showPeriodOptions, setShowPeriodOptions] = useState(false)
  const [showBSDesde, setShowBSDesde] = useState(false)
  const [showBSHasta, setShowBSHasta] = useState(false)
  const [balanceSheetPill, setBalanceSheetPill] = useState('balance')
  const [balanceSheetView, setBalanceSheetView] = useState('metodo')
  const [balancePillDropdown, setBalancePillDropdown] = useState(false)
  const [balanceViewDropdown, setBalanceViewDropdown] = useState(false)
  const [showPeriodOptionsDesktop, setShowPeriodOptionsDesktop] = useState(false)

  const closeBalanceSheet = () => {
    setClosingBalanceSheet(true)
    setTimeout(() => { setShowBalanceSheet(false); setClosingBalanceSheet(false) }, 250)
  }
  const [selectedBarIndex, setSelectedBarIndex] = useState(null)
  const [chartAnimKey, setChartAnimKey] = useState(0)
  const [showSearchBar, setShowSearchBar] = useState(false)
  const [showFullSearch, setShowFullSearch] = useState(false)
  const [fullSearchQuery, setFullSearchQuery] = useState('')
  const fullSearchInputRef = useRef(null)
  const periodWheelRef = useRef(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [upgradePeriod, setUpgradePeriod] = useState(null)
  useEffect(() => {
    if (searchParams.get('upgrade') === '1') {
      const p = searchParams.get('period')
      if (p === 'monthly' || p === 'yearly') setUpgradePeriod(p)
      setShowUpgradeModal(true)
      searchParams.delete('upgrade')
      searchParams.delete('period')
      setSearchParams(searchParams, { replace: true })
    }
  }, [])

  // Escape key to close balance panel
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && activeBalancePanel) setActiveBalancePanel(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeBalancePanel])

  // Calculate date range from period (using Bogotá timezone)
  const getDateRange = (p) => {
    const hoy = nowBogota()
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

  const getPreviousPeriodRange = (p) => {
    const hoy = nowBogota()
    hoy.setHours(0, 0, 0, 0)
    switch (p) {
      case 'd': {
        const ayer = new Date(hoy)
        ayer.setDate(ayer.getDate() - 1)
        return { desde: ayer, hasta: ayer }
      }
      case 's': {
        const inicioSemana = new Date(hoy)
        const diaS = hoy.getDay()
        inicioSemana.setDate(hoy.getDate() - (diaS === 0 ? 6 : diaS - 1))
        const inicioSemanaAnterior = new Date(inicioSemana)
        inicioSemanaAnterior.setDate(inicioSemanaAnterior.getDate() - 7)
        const finSemanaAnterior = new Date(inicioSemanaAnterior)
        finSemanaAnterior.setDate(finSemanaAnterior.getDate() + 6)
        return { desde: inicioSemanaAnterior, hasta: finSemanaAnterior }
      }
      case 'm': {
        const inicioMesPasado = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
        const finMesPasado = new Date(hoy.getFullYear(), hoy.getMonth(), 0)
        return { desde: inicioMesPasado, hasta: finMesPasado }
      }
      case 'a': {
        const inicioAnoPasado = new Date(hoy.getFullYear() - 1, 0, 1)
        const finAnoPasado = new Date(hoy.getFullYear() - 1, 11, 31)
        return { desde: inicioAnoPasado, hasta: finAnoPasado }
      }
      default:
        return { desde: null, hasta: null }
    }
  }

  const detectPeriod = (fechaStr) => {
    const dateOnly = fechaToBogotaDate(fechaStr)
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

  function getClienteCategoria(cliente) {
    const nombre = (cliente?.membresia?.nombre || '').trim()
    if (!nombre || nombre.toLowerCase() === 'sin membresia' || nombre.toLowerCase() === 'sin membresía') return 'Cliente'
    return nombre
  }

  function fechaLocalStr(date) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  // Effective date range: union of period range and custom date filters
  // Ensures custom pills like "Ayer" always include the target dates
  // If only start date selected, treat it as a single-day filter
  const _effectiveHasta = filtroFechaHasta ?? filtroFechaDesde
  const _periodRange = getDateRange(periodo)
  const fechaDesde = (!filtroFechaDesde || !_periodRange.desde)
    ? (filtroFechaDesde || _periodRange.desde)
    : (filtroFechaDesde < _periodRange.desde ? filtroFechaDesde : _periodRange.desde)
  const fechaHasta = (!_effectiveHasta || !_periodRange.hasta)
    ? (_effectiveHasta || _periodRange.hasta)
    : (_effectiveHasta > _periodRange.hasta ? _effectiveHasta : _periodRange.hasta)

  // Fetch transacciones
  const fetchTransacciones = async () => {
    if (!negocioId) return
    setTransaccionesReady(false)
    let query = supabase
      .from('transacciones')
      .select('*, metodo_pago:metodos_pago(nombre)')
      .eq('negocio_id', negocioId)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })

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
    setTransaccionesReady(true)
  }

  // Consume bootstrap transacciones on first mount if available and period is 'm' (default)
  const bootstrapConsumedRef = useRef(false)

  useEffect(() => {
    if (!bootstrapConsumedRef.current && initialTransacciones && periodo === 'm' && !filtroFechaDesde && !filtroFechaHasta) {
      setTransacciones(initialTransacciones)
      setTransaccionesReady(true)
      clearInitialTransacciones()
      bootstrapConsumedRef.current = true
    } else {
      fetchTransacciones()
    }
    // Fetch previous period transacciones for comparison
    const fetchPrevTransacciones = async () => {
      const { desde: d, hasta: h } = getPreviousPeriodRange(periodo)
      if (!d || !h) { setPrevTransacciones([]); return }
      let query = supabase
        .from('transacciones')
        .select('id, tipo, valor, categoria, fecha')
        .eq('negocio_id', negocioId)
        .gte('fecha', fechaLocalStr(d))
      const hasta = new Date(h)
      hasta.setDate(hasta.getDate() + 1)
      query = query.lt('fecha', fechaLocalStr(hasta))
      const { data } = await query
      setPrevTransacciones(data || [])
    }
    fetchPrevTransacciones()
  }, [periodo, filtroFechaDesde, filtroFechaHasta, negocioId, transaccionesVersion])

  useEffect(() => {
    if (periodo === 'a' && !lavadasAllLoaded) {
      loadAllLavadas()
    }
  }, [periodo])

  // Persist periodo to localStorage
  useEffect(() => {
    localStorage.setItem('home-periodo', periodo)
  }, [periodo])

  // Persist advanced filters to localStorage
  useEffect(() => {
    const filtros = {
      filtroEstado, filtroLavador,
      filtroPago, filtroTipoLavado, filtroAdicionales,
      filtroFechaDesde: filtroFechaDesde ? filtroFechaDesde.toISOString() : null,
      filtroFechaHasta: filtroFechaHasta ? filtroFechaHasta.toISOString() : null,
      filtroCategoria,
    }
    localStorage.setItem('home-filtros', JSON.stringify(filtros))
  }, [filtroEstado, filtroLavador, filtroPago, filtroTipoLavado, filtroAdicionales, filtroFechaDesde, filtroFechaHasta, filtroCategoria])

  // Restore advanced filters from localStorage on mount
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('home-filtros'))
      if (saved) {
        if (saved.filtroEstado?.length) setFiltroEstado(saved.filtroEstado)
        if (saved.filtroLavador?.length) setFiltroLavador(saved.filtroLavador)
        if (saved.filtroPago) setFiltroPago(saved.filtroPago)
        if (saved.filtroTipoLavado?.length) setFiltroTipoLavado(saved.filtroTipoLavado)
        if (saved.filtroAdicionales?.length) setFiltroAdicionales(saved.filtroAdicionales)
        if (saved.filtroFechaDesde) setFiltroFechaDesde(new Date(saved.filtroFechaDesde))
        if (saved.filtroFechaHasta) setFiltroFechaHasta(new Date(saved.filtroFechaHasta))
        if (saved.filtroCategoria) setFiltroCategoria(saved.filtroCategoria)
      }
    } catch {}
  }, [])

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

    const dateOnlyL = fechaToBogotaDate(l.fecha)
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
    const dateOnly = fechaToBogotaDate(t.fecha)
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

  // Filter card config
  const FILTER_CARDS = {
    servicios: ['fechas', 'estado', 'estadoPago', 'tipoLavado', 'adicionales', 'lavador', 'metodoPago'],
    productos: ['fechas', 'tipo', 'metodoPago'],
    movimientos: ['fechas', 'tipo', 'categoria', 'metodoPago'],
  }
  const FILTER_CARD_LABELS = {
    fechas: 'Fechas', estado: 'Estado', estadoPago: 'Estado de pago',
    tipoLavado: 'Tipo de servicio', adicionales: 'Adicionales', lavador: 'Trabajador',
    tipo: 'Tipo', metodoPago: 'Método de pago', categoria: 'Categoría',
  }
  const FILTER_CARD_ICONS = {
    fechas: Calendar, estado: Flag, estadoPago: CreditCard,
    tipoLavado: Droplets, adicionales: Plus, lavador: User,
    tipo: ArrowUpDown, metodoPago: Wallet, categoria: Tag,
  }

  const handleQuickDatePill = (key) => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    switch (key) {
      case 'hoy':
        setPeriodo('d'); setFiltroFechaDesde(null); setFiltroFechaHasta(null); break
      case 'ayer': {
        const ayer = new Date(hoy); ayer.setDate(ayer.getDate() - 1)
        setPeriodo('s'); setFiltroFechaDesde(ayer); setFiltroFechaHasta(ayer); break
      }
      case 'semana':
        setPeriodo('s'); setFiltroFechaDesde(null); setFiltroFechaHasta(null); break
      case 'mes':
        setPeriodo('m'); setFiltroFechaDesde(null); setFiltroFechaHasta(null); break
      case 'ano':
        setPeriodo('a'); setFiltroFechaDesde(null); setFiltroFechaHasta(null); break
    }
  }

  const getActiveQuickPill = () => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    if (filtroFechaDesde && filtroFechaHasta) {
      const ayer = new Date(hoy); ayer.setDate(ayer.getDate() - 1)
      const dDesde = new Date(filtroFechaDesde); dDesde.setHours(0, 0, 0, 0)
      const dHasta = new Date(filtroFechaHasta); dHasta.setHours(0, 0, 0, 0)
      if (dDesde.getTime() === ayer.getTime() && dHasta.getTime() === ayer.getTime()) return 'ayer'
      return null
    }
    if (!filtroFechaDesde && !filtroFechaHasta) {
      if (periodo === 'd') return 'hoy'
      if (periodo === 's') return 'semana'
      if (periodo === 'm') return 'mes'
      if (periodo === 'a') return 'ano'
    }
    return null
  }

  const periodWheelItems = [
    { key: 'ayer', label: 'Ayer' },
    { key: 'hoy', label: 'Hoy' },
    { key: 'semana', label: 'Semana' },
    { key: 'mes', label: 'Mes' },
    { key: 'ano', label: 'Año' },
  ]

  const [wheelIndex, setWheelIndex] = useState(() => {
    const active = getActiveQuickPill()
    const idx = periodWheelItems.findIndex(i => i.key === active)
    return idx >= 0 ? idx : 1
  })

  // Sync wheel when period changes externally (e.g. from filter cards)
  useEffect(() => {
    const active = getActiveQuickPill()
    const idx = periodWheelItems.findIndex(i => i.key === active)
    if (idx >= 0 && idx !== wheelIndex) setWheelIndex(idx)
  }, [periodo, filtroFechaDesde, filtroFechaHasta])

  const WHEEL_COUNT = periodWheelItems.length
  const circularOffset = (center, i) => {
    const raw = i - center
    if (raw > WHEEL_COUNT / 2) return raw - WHEEL_COUNT
    if (raw < -WHEEL_COUNT / 2) return raw + WHEEL_COUNT
    return raw
  }

  const handleWheelNav = (dir) => {
    const next = ((wheelIndex + dir) % WHEEL_COUNT + WHEEL_COUNT) % WHEEL_COUNT
    setWheelIndex(next)
    handleQuickDatePill(periodWheelItems[next].key)
  }

  const wheelSwipeRef = useRef(null)
  const onWheelTouchStart = (e) => { wheelSwipeRef.current = e.touches[0].clientX }
  const onWheelTouchEnd = (e) => {
    if (wheelSwipeRef.current === null) return
    const diff = wheelSwipeRef.current - e.changedTouches[0].clientX
    wheelSwipeRef.current = null
    if (Math.abs(diff) < 30) return
    handleWheelNav(diff > 0 ? 1 : -1)
  }

  const getCardActiveCount = (cardKey) => {
    switch (cardKey) {
      case 'fechas': return (filtroFechaDesde || filtroFechaHasta) ? 1 : 0
      case 'estado': return filtroEstado.length
      case 'estadoPago': return filtroPago ? 1 : 0
      case 'tipoLavado': return filtroTipoLavado.length
      case 'adicionales': return filtroAdicionales.length
      case 'lavador': return filtroLavador.length
      case 'tipo': return filtroTipo ? 1 : 0
      case 'metodoPago': return filtroMetodoPago ? 1 : 0
      case 'categoria': return filtroCategoria ? 1 : 0
      default: return 0
    }
  }

  const displayPeriodoLabel = useMemo(() => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    if (filtroFechaDesde && filtroFechaHasta) {
      const dDesde = new Date(filtroFechaDesde); dDesde.setHours(0, 0, 0, 0)
      const dHasta = new Date(filtroFechaHasta); dHasta.setHours(0, 0, 0, 0)
      const ayer = new Date(hoy); ayer.setDate(ayer.getDate() - 1)
      if (dDesde.getTime() === ayer.getTime() && dHasta.getTime() === ayer.getTime()) return 'Ayer'
      const fmtD = `${dDesde.getDate()}/${dDesde.getMonth() + 1}`
      const fmtH = `${dHasta.getDate()}/${dHasta.getMonth() + 1}`
      return `${fmtD} - ${fmtH}`
    }
    return periodoLabels[periodo] || 'Este mes'
  }, [filtroFechaDesde, filtroFechaHasta, periodo])

  const clearCardFilter = (cardKey) => {
    switch (cardKey) {
      case 'fechas': setFiltroFechaDesde(null); setFiltroFechaHasta(null); setPeriodo('m'); break
      case 'estado': setFiltroEstado([]); break
      case 'estadoPago': setFiltroPago(''); break
      case 'tipoLavado': setFiltroTipoLavado([]); break
      case 'adicionales': setFiltroAdicionales([]); break
      case 'lavador': setFiltroLavador([]); break
      case 'tipo': setFiltroTipo(''); setFiltroCategoria(''); break
      case 'metodoPago': setFiltroMetodoPago(''); break
      case 'categoria': setFiltroCategoria(''); break
    }
  }

  const renderFilterCardContent = (cardKey) => {
    const activeQuickPill = getActiveQuickPill()
    switch (cardKey) {
      case 'fechas':
        return (
          <div className="home-filter-fechas-layout">
            <div className="home-filter-fechas-range">
              <DatePicker
                selectsRange
                startDate={filtroFechaDesde}
                endDate={filtroFechaHasta}
                onChange={([start, end]) => { setFiltroFechaDesde(start); setFiltroFechaHasta(end); }}
                locale="es"
                inline
              />
            </div>
          </div>
        )
      case 'estado':
        return (
          <div className="home-filter-chips">
            {Object.entries(ESTADO_LABELS).map(([key, label]) => (
              <button
                key={key}
                className={`home-filter-chip ${filtroEstado.includes(key) ? 'active' : ''}`}
                onClick={() => setFiltroEstado(prev =>
                  prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )
      case 'estadoPago':
        return (
          <div className="home-filter-chips">
            {[
              { key: 'pagado', label: 'Pagado' },
              { key: 'parcial', label: 'Parcial' },
              { key: 'sin-pagar', label: 'Sin pagar' },
            ].map(p => (
              <button
                key={p.key}
                className={`home-filter-chip ${filtroPago === p.key ? 'active' : ''}`}
                onClick={() => setFiltroPago(prev => prev === p.key ? '' : p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
        )
      case 'tipoLavado':
        return tiposLavado.length > 0 ? (
          <div className="home-filter-chips">
            {tiposLavado.map(t => (
              <button
                key={t.id}
                className={`home-filter-chip ${filtroTipoLavado.includes(String(t.id)) ? 'active' : ''}`}
                onClick={() => setFiltroTipoLavado(prev => {
                  const id = String(t.id)
                  return prev.includes(id) ? prev.filter(k => k !== id) : [...prev, id]
                })}
              >
                {t.nombre}
              </button>
            ))}
          </div>
        ) : <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>No hay tipos configurados</span>
      case 'adicionales':
        return serviciosAdicionales.length > 0 ? (
          <div className="home-filter-chips">
            {serviciosAdicionales.map(a => (
              <button
                key={a.id}
                className={`home-filter-chip ${filtroAdicionales.includes(a.id) ? 'active' : ''}`}
                onClick={() => setFiltroAdicionales(prev =>
                  prev.includes(a.id) ? prev.filter(id => id !== a.id) : [...prev, a.id]
                )}
              >
                {a.nombre}
              </button>
            ))}
          </div>
        ) : <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>No hay adicionales configurados</span>
      case 'lavador':
        return lavadores.length > 0 ? (
          <div className="home-filter-chips">
            {lavadores.map(l => (
              <button
                key={l.id}
                className={`home-filter-chip ${filtroLavador.includes(String(l.id)) ? 'active' : ''}`}
                onClick={() => setFiltroLavador(prev => {
                  const id = String(l.id)
                  return prev.includes(id) ? prev.filter(k => k !== id) : [...prev, id]
                })}
              >
                {l.nombre}
              </button>
            ))}
          </div>
        ) : <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>No hay lavadores configurados</span>
      case 'tipo':
        return (
          <div className="home-filter-chips">
            {[
              { key: 'INGRESO', label: 'Ingreso' },
              { key: 'EGRESO', label: 'Egreso' },
            ].map(p => (
              <button
                key={p.key}
                className={`home-filter-chip ${filtroTipo === p.key ? 'active' : ''}`}
                onClick={() => { setFiltroTipo(prev => prev === p.key ? '' : p.key); setFiltroCategoria('') }}
              >
                {p.label}
              </button>
            ))}
          </div>
        )
      case 'metodoPago':
        return (
          <div className="home-filter-chips">
            {metodosPago.map(m => (
              <button
                key={m.id}
                className={`home-filter-chip ${filtroMetodoPago == m.id ? 'active' : ''}`}
                onClick={() => setFiltroMetodoPago(prev => prev == m.id ? '' : String(m.id))}
              >
                {m.nombre}
              </button>
            ))}
          </div>
        )
      case 'categoria':
        return (
          <div className="home-filter-chips">
            {(filtroTipo ? categoriasMovimiento[filtroTipo] || [] : [...new Set([...categoriasMovimiento.INGRESO, ...categoriasMovimiento.EGRESO])]).map(c => (
              <button
                key={c}
                className={`home-filter-chip ${filtroCategoria === c ? 'active' : ''}`}
                onClick={() => setFiltroCategoria(prev => prev === c ? '' : c)}
              >
                {c}
              </button>
            ))}
          </div>
        )
      default:
        return null
    }
  }

  // Filter lavadas by period for recent services (Bogotá timezone)
  const lavadasFiltradas = lavadas.filter(l => {
    const dateOnly = fechaToBogotaDate(l.fecha)
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
    if (filtroEstado.length > 0 && !filtroEstado.includes(l.estado)) return false
    if (filtroLavador.length > 0 && !filtroLavador.some(id => id == l.lavador_id)) return false

    // Estado de pago
    if (filtroPago) {
      const sumaPagos = (l.pagos || []).reduce((s, p) => s + Number(p.valor || 0), 0)
      const total = Number(l.valor || 0)
      const esPagado = total === 0
        ? (l.pagos?.length === 0 || Math.abs(sumaPagos - total) < 1)
        : (l.pagos?.length > 0 && Math.abs(sumaPagos - total) < 1)
      const esParcial = sumaPagos > 0 && !esPagado
      const esSinPagar = sumaPagos === 0 && !esPagado
      if (filtroPago === 'pagado' && !esPagado) return false
      if (filtroPago === 'parcial' && !esParcial) return false
      if (filtroPago === 'sin-pagar' && !esSinPagar) return false
    }

    // Tipo de lavado
    if (filtroTipoLavado.length > 0 && !filtroTipoLavado.some(id => id == l.tipo_lavado_id)) return false

    // Adicionales (TODOS los seleccionados deben estar presentes)
    if (filtroAdicionales.length > 0) {
      const idsLavada = (l.adicionales || []).map(a => a.id)
      if (!filtroAdicionales.every(id => idsLavada.includes(id))) return false
    }

    // Método de pago (busca en los pagos de la lavada)
    if (filtroMetodoPago && !(l.pagos || []).some(p => p.metodo_pago_id == filtroMetodoPago)) return false

    // Fecha personalizada (se aplica DESPUES del filtro de periodo)
    if (filtroFechaDesde || _effectiveHasta) {
      const dateOnly = fechaToBogotaDate(l.fecha)
      if (!dateOnly) return false
      const fechaL = new Date(dateOnly + 'T00:00:00')
      if (filtroFechaDesde && fechaL < filtroFechaDesde) return false
      if (_effectiveHasta) {
        const h = new Date(_effectiveHasta)
        h.setHours(23, 59, 59, 999)
        if (fechaL > h) return false
      }
    }

    const q = searchQuery.trim().toLowerCase()
    if (q && !(l.placa || '').toLowerCase().includes(q) && !(l.cliente?.nombre || '').toLowerCase().includes(q)) return false
    return true
  })
  const allProductos = transaccionesFiltradas
    .filter(t => t.categoria === 'MEMBRESIA' || t.categoria === 'PRODUCTO')
    .filter(t => {
      if (filtroTipo && t.tipo !== filtroTipo) return false
      if (filtroMetodoPago && t.metodo_pago_id != filtroMetodoPago) return false
      // Fecha personalizada
      if (filtroFechaDesde || _effectiveHasta) {
        const dateOnly = fechaToBogotaDate(t.fecha)
        if (!dateOnly) return false
        const fechaT = new Date(dateOnly + 'T00:00:00')
        if (filtroFechaDesde && fechaT < filtroFechaDesde) return false
        if (_effectiveHasta) {
          const h = new Date(_effectiveHasta)
          h.setHours(23, 59, 59, 999)
          if (fechaT > h) return false
        }
      }
      const q = searchQuery.trim().toLowerCase()
      if (q && !(t.descripcion || '').toLowerCase().includes(q) && !(t.placa_o_persona || '').toLowerCase().includes(q) && !(t.categoria || '').toLowerCase().includes(q)) return false
      return true
    })
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha) || new Date(b.created_at) - new Date(a.created_at))
  const allMovimientos = todasEntradas
    .filter(t => !t._esLavada && t.categoria !== 'MEMBRESIA' && t.categoria !== 'PRODUCTO')
    .filter(t => {
      if (filtroTipo && t.tipo !== filtroTipo) return false
      if (filtroMetodoPago && t.metodo_pago_id != filtroMetodoPago) return false
      if (filtroCategoria && t.categoria !== filtroCategoria) return false
      // Fecha personalizada
      if (filtroFechaDesde || _effectiveHasta) {
        const dateOnly = fechaToBogotaDate(t.fecha)
        if (!dateOnly) return false
        const fechaT = new Date(dateOnly + 'T00:00:00')
        if (filtroFechaDesde && fechaT < filtroFechaDesde) return false
        if (_effectiveHasta) {
          const h = new Date(_effectiveHasta)
          h.setHours(23, 59, 59, 999)
          if (fechaT > h) return false
        }
      }
      const q = searchQuery.trim().toLowerCase()
      if (q && !(t.descripcion || '').toLowerCase().includes(q) && !(t.placa_o_persona || '').toLowerCase().includes(q) && !(t.categoria || '').toLowerCase().includes(q)) return false
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

  const totalServicios = allServicios.reduce((sum, l) => sum + Number(l.valor || 0), 0)
  const cobradoServicios = allServicios.reduce((sum, l) => sum + (l.pagos || []).reduce((s, p) => s + Number(p.valor || 0), 0), 0)
  const totalProductos = allProductos.reduce((sum, t) => sum + (t.tipo === 'EGRESO' ? -1 : 1) * Number(t.valor || 0), 0)
  const totalMovimientos = allMovimientos.reduce((sum, t) => sum + (t.tipo === 'EGRESO' ? -1 : 1) * Number(t.valor || 0), 0)
  const totalTab = tab === 'servicios' ? totalServicios : tab === 'productos' ? totalProductos : totalMovimientos
  const cobradoTab = tab === 'servicios' ? cobradoServicios : tab === 'productos' ? totalProductos : totalMovimientos

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

  // Stable values for NumberTicker — only update when transacciones are fully loaded
  const stableRef = useRef({ balance: 0, ingresos: 0, egresos: 0 })
  if (transaccionesReady) {
    stableRef.current = { balance, ingresos, egresos }
  }
  const stableBalance = stableRef.current.balance
  const stableIngresos = stableRef.current.ingresos
  const stableEgresos = stableRef.current.egresos

  // Previous period comparison
  const { prevIngresos, prevEgresos } = useMemo(() => {
    const { desde: prevDesde, hasta: prevHasta } = getPreviousPeriodRange(periodo)
    if (!prevDesde || !prevHasta) return { prevIngresos: 0, prevEgresos: 0 }

    const prevPagosLavadas = lavadas.flatMap(l => {
      const pagos = l.pagos || []
      if (pagos.length === 0) return []
      const dateOnlyL = fechaToBogotaDate(l.fecha)
      const fechaLavada = dateOnlyL ? new Date(dateOnlyL + 'T00:00:00') : new Date(l.fecha)
      if (isNaN(fechaLavada.getTime())) return []
      const d = new Date(prevDesde); d.setHours(0, 0, 0, 0)
      const h = new Date(prevHasta); h.setHours(23, 59, 59, 999)
      if (fechaLavada < d || fechaLavada > h) return []
      return pagos.map(p => ({ tipo: 'INGRESO', valor: p.valor || 0 }))
    })

    const prevEntradas = [...prevTransacciones, ...prevPagosLavadas]
    const pi = prevEntradas.filter(t => t.tipo === 'INGRESO').reduce((sum, t) => sum + Number(t.valor), 0)
    const pe = prevEntradas.filter(t => t.tipo === 'EGRESO').reduce((sum, t) => sum + Number(t.valor), 0)
    return { prevIngresos: pi, prevEgresos: pe }
  }, [periodo, lavadas, prevTransacciones])

  const pctIngresos = prevIngresos === 0
    ? (ingresos > 0 ? 100 : 0)
    : ((ingresos - prevIngresos) / prevIngresos) * 100
  const pctEgresos = prevEgresos === 0
    ? (egresos > 0 ? 100 : 0)
    : ((egresos - prevEgresos) / prevEgresos) * 100
  const prevBalance = prevIngresos - prevEgresos
  const pctBalance = prevBalance === 0
    ? (balance !== 0 ? 100 : 0)
    : ((balance - prevBalance) / Math.abs(prevBalance)) * 100
  const comparisonLabels = { d: 'vs ayer', s: 'vs semana pasada', m: 'vs mes pasado', a: 'vs año pasado' }
  const comparisonLabel = comparisonLabels[periodo] || ''

  const balancePorMetodo = useMemo(() => {
    const grouped = {}
    metodosPago.forEach(m => { grouped[m.nombre] = { ingresos: 0, egresos: 0 } })
    entradasParaBalance.forEach(t => {
      const metodo = t.metodo_pago?.nombre || 'Sin método'
      if (!grouped[metodo]) grouped[metodo] = { ingresos: 0, egresos: 0 }
      if (t.tipo === 'INGRESO') grouped[metodo].ingresos += Number(t.valor)
      else grouped[metodo].egresos += Number(t.valor)
    })
    return Object.entries(grouped)
      .map(([metodo, v]) => ({ metodo, ingresos: v.ingresos, egresos: v.egresos, balance: v.ingresos - v.egresos }))
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
  }, [entradasParaBalance, metodosPago])

  const balancePorCategoria = useMemo(() => {
    const grouped = {}
    const allCats = [...categoriasMovimiento.INGRESO, ...categoriasMovimiento.EGRESO]
    allCats.forEach(c => { if (!grouped[c]) grouped[c] = { ingresos: 0, egresos: 0 } })
    entradasParaBalance.forEach(t => {
      const cat = t.categoria || 'Sin categoría'
      if (!grouped[cat]) grouped[cat] = { ingresos: 0, egresos: 0 }
      if (t.tipo === 'INGRESO') grouped[cat].ingresos += Number(t.valor)
      else grouped[cat].egresos += Number(t.valor)
    })
    return Object.entries(grouped)
      .map(([categoria, v]) => ({ categoria, ingresos: v.ingresos, egresos: v.egresos, balance: v.ingresos - v.egresos }))
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
  }, [entradasParaBalance, categoriasMovimiento.INGRESO, categoriasMovimiento.EGRESO])

  const balanceChartData = useMemo(() => {
    const hoy = nowBogota()
    hoy.setHours(0, 0, 0, 0)

    const parseFechaBogota = (f) => {
      const d = fechaToBogotaDate(f)
      return d ? new Date(d + 'T00:00:00') : null
    }

    if (periodo === 'd') {
      // Last 7 days from lavadas + transacciones
      const hace7 = new Date(hoy)
      hace7.setDate(hace7.getDate() - 6)
      const entries = lavadas.flatMap(l => {
        const fecha = parseFechaBogota(l.fecha)
        if (!fecha || fecha < hace7 || fecha > hoy) return []
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
        const fecha = parseFechaBogota(e.fecha)
        if (!fecha) return
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
        const fecha = parseFechaBogota(e.fecha)
        if (!fecha) return
        let day = fecha.getDay()
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
        const fecha = parseFechaBogota(e.fecha)
        if (!fecha) return
        const day = fecha.getDate()
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
        const fecha = parseFechaBogota(e.fecha)
        if (!fecha) return
        const month = fecha.getMonth()
        buckets[month] += e.tipo === 'INGRESO' ? Number(e.valor) : -Number(e.valor)
      })
      let acc = 0
      return meses.map((m, i) => { acc += buckets[i]; return { name: m, value: acc } })
    }

    return []
  }, [periodo, todasEntradas, lavadas, transacciones])

  const buildChartData = (tipoFilter) => {
    const hoy = nowBogota()
    hoy.setHours(0, 0, 0, 0)

    const parseFB = (f) => {
      const d = fechaToBogotaDate(f)
      return d ? new Date(d + 'T00:00:00') : null
    }

    if (periodo === 'd') {
      const hace7 = new Date(hoy)
      hace7.setDate(hace7.getDate() - 6)
      const entries = lavadas.flatMap(l => {
        const fecha = parseFB(l.fecha)
        if (!fecha || fecha < hace7 || fecha > hoy) return []
        const pagos = l.pagos || []
        return pagos.map(p => ({ fecha: l.fecha, valor: p.valor || 0, tipo: 'INGRESO' }))
      }).filter(e => e.tipo === tipoFilter)
      transacciones.filter(t => t.tipo === tipoFilter).forEach(t => {
        entries.push({ fecha: t.fecha, valor: t.valor, tipo: t.tipo })
      })
      const buckets = []
      for (let i = 0; i < 7; i++) {
        const d = new Date(hace7)
        d.setDate(hace7.getDate() + i)
        buckets.push({ date: d.getTime(), value: 0 })
      }
      entries.forEach(e => {
        const fecha = parseFB(e.fecha)
        if (!fecha) return
        const idx = buckets.findIndex(b => b.date === fecha.getTime())
        if (idx >= 0) buckets[idx].value += Number(e.valor)
      })
      const diasInit = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
      let acc = 0
      return buckets.map(b => { acc += b.value; return { name: diasInit[new Date(b.date).getDay()], value: acc } })
    }

    const entries = todasEntradas.filter(e => e.tipo === tipoFilter)
    if (periodo === 's') {
      const dias = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
      const buckets = dias.map(() => 0)
      entries.forEach(e => {
        if (!e.fecha) return
        const fecha = parseFB(e.fecha)
        if (!fecha) return
        let day = fecha.getDay()
        day = day === 0 ? 6 : day - 1
        buckets[day] += Number(e.valor)
      })
      let acc = 0
      return dias.map((d, i) => { acc += buckets[i]; return { name: d, value: acc } })
    }
    if (periodo === 'm') {
      const daysInMonth = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate()
      const buckets = Array.from({ length: daysInMonth }, () => 0)
      entries.forEach(e => {
        if (!e.fecha) return
        const fecha = parseFB(e.fecha)
        if (!fecha) return
        const day = fecha.getDate()
        buckets[day - 1] += Number(e.valor)
      })
      let acc = 0
      return buckets.map((v, i) => { acc += v; return { name: String(i + 1), value: acc } })
    }
    if (periodo === 'a') {
      const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
      const buckets = Array.from({ length: 12 }, () => 0)
      entries.forEach(e => {
        if (!e.fecha) return
        const fecha = parseFB(e.fecha)
        if (!fecha) return
        const month = fecha.getMonth()
        buckets[month] += Number(e.valor)
      })
      let acc = 0
      return meses.map((m, i) => { acc += buckets[i]; return { name: m, value: acc } })
    }
    return []
  }

  const ingresosChartData = useMemo(() => buildChartData('INGRESO'), [periodo, todasEntradas, lavadas, transacciones])
  const egresosChartData = useMemo(() => buildChartData('EGRESO'), [periodo, todasEntradas, lavadas, transacciones])

  const [chartMode, setChartMode] = useState('categoria')
  const [chartModeEgresos, setChartModeEgresos] = useState('categoria')
  const DONUT_COLORS = ['#006048', '#0A2F7E', '#575200', '#006048', '#EC4899', '#0050B8']
  const DONUT_COLORS_EGRESOS = ['#A32B1A', '#F97316', '#575200', '#006048', '#EC4899', '#0050B8']

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

  // Active filter count for badge
  const activeFilterCount = [
    filtroEstado.length > 0, filtroLavador.length > 0,
    filtroTipo, filtroMetodoPago,
    filtroPago, filtroTipoLavado.length > 0, filtroCategoria,
    filtroFechaDesde, filtroFechaHasta,
    filtroAdicionales.length > 0,
  ].filter(Boolean).length

  const limpiarFiltros = () => {
    setFiltroEstado([]); setFiltroLavador([]); setFiltroTipo(''); setFiltroMetodoPago('')
    setFiltroPago(''); setFiltroTipoLavado([]); setFiltroAdicionales([])
    setFiltroFechaDesde(null); setFiltroFechaHasta(null); setFiltroCategoria('')
    setSearchQuery(''); setPeriodo('m')
    localStorage.removeItem('home-filtros')
  }

  const resetFiltrosTab = () => {
    setFiltroEstado([]); setFiltroLavador([]); setFiltroTipo(''); setFiltroMetodoPago('')
    setFiltroPago(''); setFiltroTipoLavado([]); setFiltroAdicionales([])
    setFiltroCategoria('')
    setModoSeleccion(false); setSelectedItems(new Set()); setExpandedFilterCard(null)
  }

  const recentServicios = allServicios.slice(0, visibleCount.servicios)
  const recentProductos = allProductos.slice(0, visibleCount.productos)
  const recentMovimientos = allMovimientos.slice(0, visibleCount.movimientos)

  const handleShowMore = (tab) => {
    setVisibleCount(prev => ({ ...prev, [tab]: prev[tab] + 20 }))
  }

  const handleShowLess = (tab) => {
    setVisibleCount(prev => ({ ...prev, [tab]: 20 }))
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
        const { error } = await supabase.from('transacciones').delete().eq('id', id).eq('negocio_id', negocioId)
        if (!error) eliminados++
      }
      if (eliminados > 0) {
        let query = supabase.from('transacciones').select('*, metodo_pago:metodos_pago(nombre)').eq('negocio_id', negocioId).order('fecha', { ascending: false }).order('created_at', { ascending: false })
        if (fechaDesde) query = query.gte('fecha', fechaLocalStr(fechaDesde))
        if (fechaHasta) { const h = new Date(fechaHasta); h.setDate(h.getDate() + 1); query = query.lt('fecha', fechaLocalStr(h)) }
        const { data } = await query
        setTransacciones(data || [])
      }
    }

    setDeleting(false)
    setSelectedItems(new Set())
    setModoSeleccion(false)
    if (eliminados > 0) toast.info(`Se eliminaron ${eliminados} elemento${eliminados > 1 ? 's' : ''}`)
  }


  // Format relative date
  const formatFechaRelativa = (fechaStr) => {
    const dateOnly = fechaToBogotaDate(fechaStr) || fechaStr
    const fecha = new Date(dateOnly + 'T00:00:00')
    const hoy = nowBogota()
    hoy.setHours(0, 0, 0, 0)
    const diff = Math.round((hoy - fecha) / (1000 * 60 * 60 * 24))
    if (diff === 0) return 'Hoy'
    if (diff === 1) return 'Ayer'
    const d = fecha.getDate()
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
    return `${d} de ${meses[fecha.getMonth()]}`
  }

  // Delete transaccion (producto/movimiento)
  const executeEliminarMovimiento = async () => {
    const id = pendingDeleteMovimientoId
    if (!id) return
    try {
      const { error } = await supabase.from('transacciones').delete().eq('id', id).eq('negocio_id', negocioId)
      if (error) throw error
      await fetchTransacciones()
      toast.success('Movimiento eliminado')
      setExpandedProductCard(null)
    } catch (err) {
      toast.error('Error al eliminar movimiento')
    } finally {
      setPendingDeleteMovimientoId(null)
    }
  }

  // Product card edit handlers
  const iniciarEdicionProducto = (t) => {
    setEditProductId(t.id)
    setEditProductData({
      fecha: fechaToBogotaDate(t.fecha) || fechaLocalStr(nowBogota()),
      descripcion: t.descripcion || '',
      placa_o_persona: t.placa_o_persona || '',
      metodo_pago_id: t.metodo_pago_id || '',
      valor: String(t.valor),
      valorDisplay: formatPriceLocale(t.valor),
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
    setEditProductData(prev => ({ ...prev, valor: String(num), valorDisplay: formatPriceLocale(num) }))
  }

  const guardarEdicionProducto = async (id) => {
    if (!editProductData) return
    const nuevoValor = Number(editProductData.valor)
    if (isNaN(nuevoValor) || nuevoValor < 0) return
    if (!editProductData.metodo_pago_id || !editProductData.fecha) return

    const updates = {
      fecha: editProductData.fecha + 'T12:00:00' + getTimezoneOffset(),
      placa_o_persona: editProductData.placa_o_persona,
      descripcion: editProductData.descripcion,
      metodo_pago_id: editProductData.metodo_pago_id,
      valor: nuevoValor,
    }

    await supabase.from('transacciones').update(updates).eq('id', id).eq('negocio_id', negocioId)
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
    const defaultMem = tiposMembresia.find(m => m.nombre.toLowerCase().trim() === 'cliente')
      || tiposMembresia.find(m => m.nombre.toLowerCase().includes('sin '))

    const { data, error } = await supabase
      .from('clientes')
      .insert([{
        nombre: ventaNuevoClienteData.nombre,
        placa: ventaNuevoClienteData.placa.toUpperCase(),
        telefono: ventaNuevoClienteData.telefono || null,
        membresia_id: defaultMem?.id || null,
        fecha_inicio_membresia: hoyStr,
        fecha_fin_membresia: hoyStr,
        estado: 'Activo',
        negocio_id: negocioId
      }])
      .select('*, membresia:tipos_membresia(nombre)')
      .single()
    setCreandoVentaCliente(false)
    if (error) {
      if (error.message?.includes('PLAN_LIMIT_REACHED')) {
        setShowUpgradeModal(true)
        return
      }
      const existente = clientes.find(c => c.placa?.toLowerCase() === ventaNuevoClienteData.placa.toLowerCase())
      if (existente) {
        setShowVentaNuevoCliente(false)
        setVentaNuevoClienteData({ nombre: '', placa: '', telefono: '' })
        handleVentaClienteChange(existente.id)
        return
      }
      toast.error('Error al crear cliente: ' + (error.message || 'Error desconocido'))
      return
    }
    if (data) {
      addClienteLocal(data)
      refreshClientes()
      setShowVentaNuevoCliente(false)
      setVentaNuevoClienteData({ nombre: '', placa: '', telefono: '' })
      setVentaClienteSearch(`${data.nombre} - ${data.placa}`)
      setShowVentaClienteDropdown(false)
      setVentaForm(prev => ({ ...prev, cliente_id: data.id }))
    }
  }

  // Nuevo cliente desde FAB
  const handleNuevoClienteMembresiaChange = (membresiaId) => {
    const membresia = tiposMembresia.find(m => m.id === membresiaId)
    const hoy = new Date()
    const nomMem = (membresia?.nombre || '').toLowerCase().trim()
    if (!membresiaId || nomMem === 'cliente' || nomMem === 'cliente frecuente' || nomMem.includes('sin ')) {
      setNuevoClienteData(prev => ({ ...prev, membresia_id: membresiaId, fecha_inicio_membresia: hoy, fecha_fin_membresia: hoy }))
    } else {
      const fin = new Date()
      fin.setMonth(fin.getMonth() + (membresia?.duracion_dias || 1))
      setNuevoClienteData(prev => ({ ...prev, membresia_id: membresiaId, fecha_inicio_membresia: hoy, fecha_fin_membresia: fin }))
    }
  }

  const resetNuevoClienteData = () => setNuevoClienteData({
    nombre: '', cedula: '', telefono: '', correo: '', placa: '', moto: '',
    membresia_id: '', fecha_inicio_membresia: null, fecha_fin_membresia: null
  })

  const handleNuevoCliente = async (e) => {
    e?.preventDefault()
    if (creandoCliente || !nuevoClienteData.nombre || !nuevoClienteData.placa) return
    setCreandoCliente(true)

    let formToSend = { ...nuevoClienteData }
    if (!formToSend.membresia_id) {
      const defaultMem2 = tiposMembresia.find(m => m.nombre.toLowerCase().trim() === 'cliente')
        || tiposMembresia.find(m => m.nombre.toLowerCase().includes('sin '))
      if (defaultMem2) {
        const hoy = new Date()
        formToSend.membresia_id = defaultMem2.id
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

    const { data, error } = await supabase
      .from('clientes')
      .insert([{ ...cleanData, negocio_id: negocioId }])
      .select('*, membresia:tipos_membresia(nombre)')
      .single()
    setCreandoCliente(false)
    if (error) {
      if (error.message?.includes('PLAN_LIMIT_REACHED')) {
        setShowUpgradeModal(true)
        return
      }
      toast.error('Error al crear cliente: ' + (error.message || 'Error desconocido'))
      return
    }
    if (data) {
      addClienteLocal(data)
      refreshClientes()
      setShowNuevoClienteModal(false)
      resetNuevoClienteData()
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
    const fechaStr = fechaLocalStr(new Date()) + 'T12:00:00' + getTimezoneOffset()

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
      .eq('negocio_id', negocioId)
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
    setVentaForm(prev => ({ ...prev, valor: formatPriceLocale(num) }))
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
    if (!raw) return fechaLocalStr(new Date()) + 'T12:00:00' + getTimezoneOffset()
    if (raw instanceof Date && !isNaN(raw.getTime())) {
      const y = raw.getUTCFullYear()
      const m = String(raw.getUTCMonth() + 1).padStart(2, '0')
      const d = String(raw.getUTCDate()).padStart(2, '0')
      return `${y}-${m}-${d}T12:00:00${getTimezoneOffset()}`
    }
    const str = raw.toString().trim()
    const matchDMY = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
    if (matchDMY) {
      const dd = String(parseInt(matchDMY[1], 10)).padStart(2, '0')
      const mm = String(parseInt(matchDMY[2], 10)).padStart(2, '0')
      return `${matchDMY[3]}-${mm}-${dd}T12:00:00${getTimezoneOffset()}`
    }
    const matchISO = str.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (matchISO) return `${matchISO[1]}-${matchISO[2]}-${matchISO[3]}T12:00:00${getTimezoneOffset()}`
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
    let query = supabase.from('transacciones').select('*, metodo_pago:metodos_pago(nombre)').eq('negocio_id', negocioId).order('fecha', { ascending: false }).order('created_at', { ascending: false })
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

  // Nuevo Movimiento handlers
  const openMovimientoModal = (tipo) => {
    setMovimientoForm({
      tipo,
      valor: '',
      categoria: '',
      metodo_pago_id: '',
      placa_o_persona: '',
      descripcion: '',
      fecha: fechaLocalStr(new Date())
    })
    setShowMovimientoModal(true)
  }

  const handleMovimientoValorChange = (raw) => {
    const limpio = raw.replace(/[^\d]/g, '')
    if (limpio === '') {
      setMovimientoForm(prev => ({ ...prev, valor: '' }))
      return
    }
    const num = Number(limpio)
    setMovimientoForm(prev => ({ ...prev, valor: formatPriceLocale(num) }))
  }

  const handleMovimientoSubmit = async () => {
    if (movimientoSubmitting) return
    const valor = Number(movimientoForm.valor.replace(/[^\d]/g, ''))
    if (!valor || !movimientoForm.categoria || !movimientoForm.metodo_pago_id) return
    setMovimientoSubmitting(true)

    const { data, error } = await supabase.from('transacciones').insert([{
      tipo: movimientoForm.tipo,
      valor,
      categoria: movimientoForm.categoria,
      metodo_pago_id: movimientoForm.metodo_pago_id,
      placa_o_persona: movimientoForm.placa_o_persona,
      descripcion: movimientoForm.descripcion,
      fecha: movimientoForm.fecha + 'T12:00:00' + getTimezoneOffset(),
      negocio_id: negocioId
    }]).select('id').single()

    setMovimientoSubmitting(false)
    setShowMovimientoModal(false)

    // Refresh transacciones
    let query = supabase
      .from('transacciones')
      .select('*, metodo_pago:metodos_pago(nombre)')
      .eq('negocio_id', negocioId)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
    if (fechaDesde) query = query.gte('fecha', fechaLocalStr(fechaDesde))
    if (fechaHasta) {
      const hasta = new Date(fechaHasta)
      hasta.setDate(hasta.getDate() + 1)
      query = query.lt('fecha', fechaLocalStr(hasta))
    }
    const { data: refreshed } = await query
    setTransacciones(refreshed || [])

    // Navigate to movimientos tab and highlight new item
    setTab('movimientos')
    if (data?.id) {
      setHighlightId(data.id)
      // Auto-adjust period if needed
      const bestPeriod = detectPeriod(movimientoForm.fecha + 'T12:00:00')
      if (bestPeriod !== periodo) setPeriodo(bestPeriod)
    }
  }

  const handleCloseMovimiento = () => {
    setShowMovimientoModal(false)
    setMovimientoDragY(0)
    movimientoDragStartY.current = null
  }

  const onMovimientoSheetTouchStart = (e) => { movimientoDragStartY.current = e.touches[0].clientY }
  const onMovimientoSheetTouchMove = (e) => {
    if (movimientoDragStartY.current === null) return
    const delta = e.touches[0].clientY - movimientoDragStartY.current
    if (delta > 0) setMovimientoDragY(delta)
  }
  const onMovimientoSheetTouchEnd = () => {
    const height = movimientoSheetRef.current?.offsetHeight || 500
    if (movimientoDragY > height * 0.3) handleCloseMovimiento()
    setMovimientoDragY(0)
    movimientoDragStartY.current = null
  }

  return (
    <div className={`home-page ${activeBalancePanel ? 'balance-panel-active' : ''}`}>
      {/* Balance Inline (mobile) */}
      <div className="home-balance-inline" onClick={() => setShowBalanceSheet(true)}>
        <div>
          <span className="home-balance-inline-label">
            Balance {displayPeriodoLabel.toLowerCase()}
            <button className="money-toggle-btn" onClick={e => { e.stopPropagation(); toggleMoney() }} title={showMoney ? 'Ocultar valores' : 'Mostrar valores'}>
              {showMoney ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
          </span>
          <span className={`home-balance-inline-amount ${stableBalance >= 0 ? 'positivo' : 'negativo'}`}>
            <NumberTicker value={stableBalance} masked={!showMoney} />
            <ChevronDown size={18} className="home-balance-inline-chevron" />
          </span>
        </div>
      </div>

      {/* Mobile Glass Filters (period + desde/hasta) */}
      {isMobile && (
        <div className="home-mobile-filters">
          <div className="glass-filter-wrapper">
            <button
              className={`glass-filter glass-filter-periodo ${showPeriodDropdown ? 'active' : ''}`}
              onClick={() => { setShowPeriodDropdown(prev => !prev); setShowDesdeCalendar(false); setShowHastaCalendar(false) }}
            >
              <span className="glass-filter-text">{displayPeriodoLabel}</span>
              <ChevronDown
                size={14}
                className={`glass-filter-chevron ${showPeriodDropdown ? 'rotated' : ''}`}
              />
            </button>
            {showPeriodDropdown && (
              <>
                <div className="glass-dropdown-backdrop" onClick={() => setShowPeriodDropdown(false)} />
                <div className="glass-dropdown">
                  {periodWheelItems.map(item => (
                    <button
                      key={item.key}
                      className={`glass-dropdown-item ${getActiveQuickPill() === item.key ? 'active' : ''}`}
                      onClick={() => {
                        handleQuickDatePill(item.key)
                        setShowPeriodDropdown(false)
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="glass-filter-wrapper">
            <button
              className={`glass-filter ${filtroFechaDesde ? 'active' : ''}`}
              onClick={() => { setShowDesdeCalendar(prev => !prev); setShowHastaCalendar(false) }}
            >
              <Calendar size={14} className="glass-filter-icon" />
              <span className="glass-filter-text">
                {filtroFechaDesde
                  ? filtroFechaDesde.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
                  : 'Desde'}
              </span>
              {filtroFechaDesde && (
                <X size={12} className="glass-filter-clear" onClick={(e) => { e.stopPropagation(); setFiltroFechaDesde(null) }} />
              )}
            </button>
            {showDesdeCalendar && (
              <>
                <div className="glass-dropdown-backdrop" onClick={() => setShowDesdeCalendar(false)} />
                <div className="glass-calendar-dropdown">
                  <DatePicker
                    selected={filtroFechaDesde}
                    onChange={(date) => { setFiltroFechaDesde(date); setShowDesdeCalendar(false) }}
                    locale="es"
                    inline
                    maxDate={filtroFechaHasta || undefined}
                    calendarClassName="glass-calendar"
                  />
                </div>
              </>
            )}
          </div>

          <div className="glass-filter-wrapper">
            <button
              className={`glass-filter ${filtroFechaHasta ? 'active' : ''}`}
              onClick={() => { setShowHastaCalendar(prev => !prev); setShowDesdeCalendar(false) }}
            >
              <Calendar size={14} className="glass-filter-icon" />
              <span className="glass-filter-text">
                {filtroFechaHasta
                  ? filtroFechaHasta.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
                  : 'Hasta'}
              </span>
              {filtroFechaHasta && (
                <X size={12} className="glass-filter-clear" onClick={(e) => { e.stopPropagation(); setFiltroFechaHasta(null) }} />
              )}
            </button>
            {showHastaCalendar && (
              <>
                <div className="glass-dropdown-backdrop" onClick={() => setShowHastaCalendar(false)} />
                <div className="glass-calendar-dropdown">
                  <DatePicker
                    selected={filtroFechaHasta}
                    onChange={(date) => { setFiltroFechaHasta(date); setShowHastaCalendar(false) }}
                    locale="es"
                    inline
                    minDate={filtroFechaDesde || undefined}
                    calendarClassName="glass-calendar"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Balance Sheet (mobile) */}
      {showBalanceSheet && (
        <>
          <div className="pago-popover-overlay" onClick={closeBalanceSheet} />
          <div className={`home-balance-sheet ${closingBalanceSheet ? 'home-balance-sheet-closing' : ''}`} onClick={e => e.stopPropagation()}>
            <div className="home-balance-sheet-header">
              <span className="home-balance-sheet-title">Resumen de {displayPeriodoLabel.toLowerCase()}</span>
              <button className="home-balance-sheet-close" onClick={closeBalanceSheet}>
                <X size={20} />
              </button>
            </div>

            <div className="balance-sheet-filters">
              <div className="glass-filter-wrapper">
                <button
                  className={`glass-filter glass-filter-periodo ${showPeriodOptions ? 'active' : ''}`}
                  onClick={() => { setShowPeriodOptions(p => !p); setShowBSDesde(false); setShowBSHasta(false) }}
                >
                  <span className="glass-filter-text">{displayPeriodoLabel}</span>
                  <ChevronDown size={14} className={`glass-filter-chevron ${showPeriodOptions ? 'rotated' : ''}`} />
                </button>
                {showPeriodOptions && (
                  <>
                    <div className="glass-dropdown-backdrop" onClick={() => setShowPeriodOptions(false)} />
                    <div className="glass-dropdown">
                      {periodWheelItems.map(item => (
                        <button
                          key={item.key}
                          className={`glass-dropdown-item ${getActiveQuickPill() === item.key ? 'active' : ''}`}
                          onClick={() => { handleQuickDatePill(item.key); setSelectedBarIndex(null); setChartAnimKey(k => k + 1); setShowPeriodOptions(false) }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="glass-filter-wrapper">
                <button
                  className={`glass-filter ${filtroFechaDesde ? 'active' : ''}`}
                  onClick={() => { setShowBSDesde(p => !p); setShowBSHasta(false); setShowPeriodOptions(false) }}
                >
                  <Calendar size={14} className="glass-filter-icon" />
                  <span className="glass-filter-text">
                    {filtroFechaDesde
                      ? filtroFechaDesde.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
                      : 'Desde'}
                  </span>
                  {filtroFechaDesde && (
                    <X size={12} className="glass-filter-clear" onClick={(e) => { e.stopPropagation(); setFiltroFechaDesde(null); setSelectedBarIndex(null); setChartAnimKey(k => k + 1) }} />
                  )}
                </button>
                {showBSDesde && (
                  <>
                    <div className="glass-dropdown-backdrop" onClick={() => setShowBSDesde(false)} />
                    <div className="glass-calendar-dropdown">
                      <DatePicker
                        selected={filtroFechaDesde}
                        onChange={(date) => { setFiltroFechaDesde(date); setShowBSDesde(false); setSelectedBarIndex(null); setChartAnimKey(k => k + 1) }}
                        locale="es"
                        inline
                        maxDate={filtroFechaHasta || undefined}
                        calendarClassName="glass-calendar"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="glass-filter-wrapper">
                <button
                  className={`glass-filter ${filtroFechaHasta ? 'active' : ''}`}
                  onClick={() => { setShowBSHasta(p => !p); setShowBSDesde(false); setShowPeriodOptions(false) }}
                >
                  <Calendar size={14} className="glass-filter-icon" />
                  <span className="glass-filter-text">
                    {filtroFechaHasta
                      ? filtroFechaHasta.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
                      : 'Hasta'}
                  </span>
                  {filtroFechaHasta && (
                    <X size={12} className="glass-filter-clear" onClick={(e) => { e.stopPropagation(); setFiltroFechaHasta(null); setSelectedBarIndex(null); setChartAnimKey(k => k + 1) }} />
                  )}
                </button>
                {showBSHasta && (
                  <>
                    <div className="glass-dropdown-backdrop" onClick={() => setShowBSHasta(false)} />
                    <div className="glass-calendar-dropdown">
                      <DatePicker
                        selected={filtroFechaHasta}
                        onChange={(date) => { setFiltroFechaHasta(date); setShowBSHasta(false); setSelectedBarIndex(null); setChartAnimKey(k => k + 1) }}
                        locale="es"
                        inline
                        minDate={filtroFechaDesde || undefined}
                        calendarClassName="glass-calendar"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            <span className={`home-balance-sheet-big-value ${
              balanceSheetPill === 'balance' ? (stableBalance >= 0 ? 'positivo' : 'negativo')
              : balanceSheetPill === 'ingresos' ? 'positivo' : 'negativo'
            }`}>
              <NumberTicker value={balanceSheetPill === 'balance' ? stableBalance : balanceSheetPill === 'ingresos' ? stableIngresos : -stableEgresos} masked={!showMoney} />
            </span>

            <div className="home-balance-sheet-pills">
              {['balance', 'ingresos', 'egresos'].map(pill => (
                <button
                  key={pill}
                  className={`home-balance-sheet-pill ${balanceSheetPill === pill ? 'active' : ''}`}
                  onClick={() => { setBalanceSheetPill(pill); setSelectedBarIndex(null); setChartAnimKey(k => k + 1) }}
                >
                  {pill.charAt(0).toUpperCase() + pill.slice(1)}
                </button>
              ))}
            </div>

            {(() => {
              const sourceData = balanceSheetView === 'metodo' ? balancePorMetodo : balancePorCategoria
              const chartData = sourceData.map(m => {
                const raw = balanceSheetPill === 'ingresos' ? m.ingresos
                  : balanceSheetPill === 'egresos' ? m.egresos
                  : m.balance
                return { nombre: balanceSheetView === 'metodo' ? m.metodo : m.categoria, valor: Math.abs(raw), negativo: raw < 0 }
              })
              const barColor = balanceSheetPill === 'ingresos' ? 'var(--accent-green)'
                : balanceSheetPill === 'egresos' ? 'var(--accent-red)'
                : 'var(--accent-blue)'

              const CustomXTick = ({ x, y, payload }) => {
                const words = payload.value.split(' ')
                return (
                  <text x={x} y={y + 12} textAnchor="middle" fontSize={11} fill="var(--text-secondary)">
                    {words.length > 1 ? words.map((w, i) => (
                      <tspan key={i} x={x} dy={i === 0 ? 0 : 14}>{w}</tspan>
                    )) : <tspan>{payload.value}</tspan>}
                  </text>
                )
              }

              return chartData.length > 0 ? (
                <div className="home-balance-sheet-chart animate" key={chartAnimKey}>
                  <div className="chart-scroll-wrapper">
                    <BarChart data={chartData} width={Math.max(chartData.length * 90, 300)} height={340} margin={{ top: 30, right: 0, left: 0, bottom: 20 }} barCategoryGap={20}>
                      <XAxis dataKey="nombre" tick={<CustomXTick />} axisLine={false} tickLine={false} interval={0} />
                      <YAxis hide />
                      <Bar dataKey="valor" radius={[16, 16, 16, 16]} barSize={72} minPointSize={32} isAnimationActive={false} onClick={(_, index) => setSelectedBarIndex(selectedBarIndex === index ? null : index)}>
                        {chartData.map((entry, index) => {
                          const isSelected = selectedBarIndex === index
                          const baseColor = entry.negativo ? 'var(--accent-red)' : barColor
                          return (
                            <Cell
                              key={index}
                              fill={baseColor}
                              style={{ cursor: 'pointer', opacity: selectedBarIndex !== null && !isSelected ? 0.4 : 1, filter: isSelected ? 'brightness(1.3)' : 'none', transition: 'opacity 0.3s ease, filter 0.3s ease' }}
                            />
                          )
                        })}
                        <LabelList
                          position="top"
                          offset={11}
                          content={({ x, y, width, height, index: idx }) => {
                            const total = chartData.reduce((s, d) => s + d.valor, 0)
                            const val = chartData[idx]?.valor || 0
                            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0
                            const isSelected = selectedBarIndex === idx
                            return (
                              <>
                                <text x={x + width / 2} y={y - 11} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--text-primary)">
                                  {formatMoney(val)}
                                </text>
                                {isSelected && (
                                  <text x={x + width / 2} y={y + height / 2 + 6} textAnchor="middle" fontSize={16} fontWeight={700} fill="#fff">
                                    {pct}%
                                  </text>
                                )}
                              </>
                            )
                          }}
                        />
                      </Bar>
                    </BarChart>
                  </div>
                </div>
              ) : <div className="chart-empty">Sin datos para mostrar</div>
            })()}

            <div className="home-balance-sheet-view-switch">
              <div className={`home-balance-sheet-view-item ${balanceSheetView === 'metodo' ? 'active' : ''}`} onClick={() => { setBalanceSheetView('metodo'); setSelectedBarIndex(null); setChartAnimKey(k => k + 1) }}>
                <div className="home-balance-sheet-view-circle"><Wallet size={20} /></div>
                <span>Métodos de pago</span>
              </div>
              <div className={`home-balance-sheet-view-item ${balanceSheetView === 'categoria' ? 'active' : ''}`} onClick={() => { setBalanceSheetView('categoria'); setSelectedBarIndex(null); setChartAnimKey(k => k + 1) }}>
                <div className="home-balance-sheet-view-circle"><Tag size={20} /></div>
                <span>Categorías</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Balance Cards (desktop) — simplified */}
      {!activeBalancePanel && (
        <div className="home-balance-desktop">
          <div className="home-balance-carousel">
            <div className="home-balance-card balance home-balance-clickable" onClick={() => { setActiveBalancePanel('balance'); setBalanceSheetPill('balance'); setSelectedBarIndex(null); setChartAnimKey(k => k + 1); window.scrollTo(0, 0) }}>
              <button className="money-toggle-btn money-toggle-card" onClick={e => { e.stopPropagation(); toggleMoney() }} title={showMoney ? 'Ocultar valores' : 'Mostrar valores'}>
                {showMoney ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
              <span className="home-balance-label balance-title">Balance - {displayPeriodoLabel}</span>
              <span className={`home-balance-amount ${stableBalance >= 0 ? 'positivo' : 'negativo'}`}>
                <NumberTicker value={stableBalance} masked={!showMoney} />
              </span>
            </div>
            <div className="home-balance-card ingresos home-balance-clickable" onClick={() => { setActiveBalancePanel('ingresos'); setBalanceSheetPill('ingresos'); setSelectedBarIndex(null); setChartAnimKey(k => k + 1); window.scrollTo(0, 0) }}>
              <button className="money-toggle-btn money-toggle-card" onClick={e => { e.stopPropagation(); toggleMoney() }} title={showMoney ? 'Ocultar valores' : 'Mostrar valores'}>
                {showMoney ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
              <span className="home-balance-label ingresos-title">Ingresos - {displayPeriodoLabel}</span>
              <span className="home-balance-amount positivo"><NumberTicker value={stableIngresos} masked={!showMoney} /></span>
            </div>
            <div className="home-balance-card egresos home-balance-clickable" onClick={() => { setActiveBalancePanel('egresos'); setBalanceSheetPill('egresos'); setSelectedBarIndex(null); setChartAnimKey(k => k + 1); window.scrollTo(0, 0) }}>
              <button className="money-toggle-btn money-toggle-card" onClick={e => { e.stopPropagation(); toggleMoney() }} title={showMoney ? 'Ocultar valores' : 'Mostrar valores'}>
                {showMoney ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
              <span className="home-balance-label egresos-title">Egresos - {displayPeriodoLabel}</span>
              <span className="home-balance-amount negativo"><NumberTicker value={-stableEgresos} masked={!showMoney} /></span>
            </div>
          </div>
        </div>
      )}

      {/* Balance Detail Panel (desktop fullscreen) */}
      {activeBalancePanel && (
        <div className="balance-detail-panel">
          <div className="balance-detail-panel-header">
            <button className="balance-detail-panel-back" onClick={() => setActiveBalancePanel(null)}>
              <ArrowLeft size={20} />
              <span>Volver</span>
            </button>
          </div>
          <div className="balance-detail-panel-title-row">
            <span className="balance-detail-panel-title">Resumen de {displayPeriodoLabel.toLowerCase()}</span>
            <div className="balance-detail-panel-filters">
              <div className="glass-filter-wrapper">
                <button
                  className={`glass-filter glass-filter-periodo ${showPeriodOptionsDesktop ? 'active' : ''}`}
                  onClick={() => { setShowPeriodOptionsDesktop(p => !p); setShowBSDesde(false); setShowBSHasta(false) }}
                >
                  <span className="glass-filter-text">{displayPeriodoLabel}</span>
                  <ChevronDown size={14} className={`glass-filter-chevron ${showPeriodOptionsDesktop ? 'rotated' : ''}`} />
                </button>
                {showPeriodOptionsDesktop && (
                  <>
                    <div className="glass-dropdown-backdrop" onClick={() => setShowPeriodOptionsDesktop(false)} />
                    <div className="glass-dropdown">
                      {periodWheelItems.map(item => (
                        <button
                          key={item.key}
                          className={`glass-dropdown-item ${getActiveQuickPill() === item.key ? 'active' : ''}`}
                          onClick={() => { handleQuickDatePill(item.key); setSelectedBarIndex(null); setChartAnimKey(k => k + 1); setShowPeriodOptionsDesktop(false) }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="glass-filter-wrapper">
                <button
                  className={`glass-filter ${filtroFechaDesde ? 'active' : ''}`}
                  onClick={() => { setShowBSDesde(p => !p); setShowBSHasta(false); setShowPeriodOptionsDesktop(false) }}
                >
                  <Calendar size={14} className="glass-filter-icon" />
                  <span className="glass-filter-text">
                    {filtroFechaDesde
                      ? filtroFechaDesde.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
                      : 'Desde'}
                  </span>
                  {filtroFechaDesde && (
                    <X size={12} className="glass-filter-clear" onClick={(e) => { e.stopPropagation(); setFiltroFechaDesde(null); setSelectedBarIndex(null); setChartAnimKey(k => k + 1) }} />
                  )}
                </button>
                {showBSDesde && (
                  <>
                    <div className="glass-dropdown-backdrop" onClick={() => setShowBSDesde(false)} />
                    <div className="glass-calendar-dropdown">
                      <DatePicker
                        selected={filtroFechaDesde}
                        onChange={(date) => { setFiltroFechaDesde(date); setShowBSDesde(false); setSelectedBarIndex(null); setChartAnimKey(k => k + 1) }}
                        locale="es"
                        inline
                        maxDate={filtroFechaHasta || undefined}
                        calendarClassName="glass-calendar"
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="glass-filter-wrapper">
                <button
                  className={`glass-filter ${filtroFechaHasta ? 'active' : ''}`}
                  onClick={() => { setShowBSHasta(p => !p); setShowBSDesde(false); setShowPeriodOptionsDesktop(false) }}
                >
                  <Calendar size={14} className="glass-filter-icon" />
                  <span className="glass-filter-text">
                    {filtroFechaHasta
                      ? filtroFechaHasta.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
                      : 'Hasta'}
                  </span>
                  {filtroFechaHasta && (
                    <X size={12} className="glass-filter-clear" onClick={(e) => { e.stopPropagation(); setFiltroFechaHasta(null); setSelectedBarIndex(null); setChartAnimKey(k => k + 1) }} />
                  )}
                </button>
                {showBSHasta && (
                  <>
                    <div className="glass-dropdown-backdrop" onClick={() => setShowBSHasta(false)} />
                    <div className="glass-calendar-dropdown">
                      <DatePicker
                        selected={filtroFechaHasta}
                        onChange={(date) => { setFiltroFechaHasta(date); setShowBSHasta(false); setSelectedBarIndex(null); setChartAnimKey(k => k + 1) }}
                        locale="es"
                        inline
                        minDate={filtroFechaDesde || undefined}
                        calendarClassName="glass-calendar"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <span className={`balance-detail-panel-amount ${balanceSheetPill === 'balance' ? (stableBalance >= 0 ? 'positivo' : 'negativo') : balanceSheetPill === 'ingresos' ? 'positivo' : 'negativo'}`}>
            <NumberTicker value={balanceSheetPill === 'balance' ? stableBalance : balanceSheetPill === 'ingresos' ? stableIngresos : -stableEgresos} masked={!showMoney} />
          </span>

          {/* Pill + View switch row */}
          <div className="balance-panel-controls-row">
            <div className="balance-panel-pills">
              {['balance', 'ingresos', 'egresos'].map(pill => (
                <button
                  key={pill}
                  className={`balance-panel-pill ${balanceSheetPill === pill ? 'active' : ''}`}
                  onClick={() => { setBalanceSheetPill(pill); setSelectedBarIndex(null); setChartAnimKey(k => k + 1) }}
                >
                  {pill.charAt(0).toUpperCase() + pill.slice(1)}
                </button>
              ))}
            </div>
            <div className="balance-panel-pills">
              <button
                className={`balance-panel-pill ${balanceSheetView === 'metodo' ? 'active' : ''}`}
                onClick={() => { setBalanceSheetView('metodo'); setSelectedBarIndex(null); setChartAnimKey(k => k + 1) }}
              >
                Métodos de pago
              </button>
              <button
                className={`balance-panel-pill ${balanceSheetView === 'categoria' ? 'active' : ''}`}
                onClick={() => { setBalanceSheetView('categoria'); setSelectedBarIndex(null); setChartAnimKey(k => k + 1) }}
              >
                Categorías
              </button>
            </div>
          </div>

          {/* BarChart */}
          {(() => {
            const sourceData = balanceSheetView === 'metodo' ? balancePorMetodo : balancePorCategoria
            const chartData = sourceData.map(m => {
              const raw = balanceSheetPill === 'ingresos' ? m.ingresos
                : balanceSheetPill === 'egresos' ? m.egresos
                : m.balance
              return { nombre: balanceSheetView === 'metodo' ? m.metodo : m.categoria, valor: Math.abs(raw), negativo: raw < 0 }
            })
            const barColor = balanceSheetPill === 'ingresos' ? 'var(--accent-green)'
              : balanceSheetPill === 'egresos' ? 'var(--accent-red)'
              : 'var(--accent-blue)'

            const CustomXTick = ({ x, y, payload }) => {
              const words = payload.value.split(' ')
              return (
                <text x={x} y={y + 12} textAnchor="middle" fontSize={11} fill="var(--text-secondary)">
                  {words.length > 1 ? words.map((w, i) => (
                    <tspan key={i} x={x} dy={i === 0 ? 0 : 14}>{w}</tspan>
                  )) : <tspan>{payload.value}</tspan>}
                </text>
              )
            }

            return chartData.length > 0 ? (
              <div className="home-balance-sheet-chart animate" key={chartAnimKey}>
                <div className="chart-scroll-wrapper">
                  <BarChart data={chartData} width={isMobile ? Math.max(chartData.length * 90, 400) : Math.max(chartData.length * 140, 800)} height={isMobile ? 300 : 420} margin={{ top: 30, right: 0, left: 0, bottom: 20 }} barCategoryGap={20}>
                    <XAxis dataKey="nombre" tick={<CustomXTick />} axisLine={false} tickLine={false} interval={0} />
                    <YAxis hide />
                    <Bar dataKey="valor" radius={[16, 16, 16, 16]} barSize={isMobile ? 72 : 100} minPointSize={32} isAnimationActive={false} onClick={(_, index) => setSelectedBarIndex(selectedBarIndex === index ? null : index)}>
                      {chartData.map((entry, index) => {
                        const isSelected = selectedBarIndex === index
                        const baseColor = entry.negativo ? 'var(--accent-red)' : barColor
                        return (
                          <Cell
                            key={index}
                            fill={baseColor}
                            style={{ cursor: 'pointer', opacity: selectedBarIndex !== null && !isSelected ? 0.4 : 1, filter: isSelected ? 'brightness(1.3)' : 'none', transition: 'opacity 0.3s ease, filter 0.3s ease' }}
                          />
                        )
                      })}
                      <LabelList
                        position="top"
                        offset={11}
                        content={({ x, y, width, height, index: idx }) => {
                          const total = chartData.reduce((s, d) => s + d.valor, 0)
                          const val = chartData[idx]?.valor || 0
                          const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0
                          const isSelected = selectedBarIndex === idx
                          return (
                            <>
                              <text x={x + width / 2} y={y - 11} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--text-primary)">
                                {formatMoney(val)}
                              </text>
                              {isSelected && (
                                <text x={x + width / 2} y={y + height / 2 + 6} textAnchor="middle" fontSize={16} fontWeight={700} fill="#fff">
                                  {pct}%
                                </text>
                              )}
                            </>
                          )
                        }}
                      />
                    </Bar>
                  </BarChart>
                </div>
              </div>
            ) : <div className="chart-empty">Sin datos para mostrar</div>
          })()}

        </div>
      )}

      {/* Search + Period Row (mobile: wheel + filter icon; desktop: inline search replaces wheel) */}
      <div className="home-search-period-row">
        {showSearchBar && (
          <div className="home-search-inline-desktop">
            <Search size={16} />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { setShowSearchBar(false); setSearchQuery('') } }}
            />
            <button onClick={() => { if (searchQuery) { setSearchQuery('') } else { setShowSearchBar(false) } }}><X size={16} /></button>
          </div>
        )}
        {!showSearchBar && (
          <button
            className="home-search-icon-btn"
            onClick={() => { setShowSearchBar(true); setTimeout(() => searchInputRef.current?.focus(), 100) }}
          >
            <Search size={18} />
          </button>
        )}
        {!isMobile && (
          <div className="home-period-flat">
            {periodWheelItems.map(item => (
              <button
                key={item.key}
                className={`home-period-flat-item ${getActiveQuickPill() === item.key ? 'active' : ''}`}
                onClick={() => handleQuickDatePill(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
        {!isMobile && (
          <button
            className={`home-filtros-icon-btn ${showFilterCards ? 'active' : ''}`}
            onClick={() => setShowFilterCards(prev => !prev)}
            style={{ position: 'relative' }}
          >
            <SlidersHorizontal size={18} />
            <span className="home-filtros-label-desktop">Más filtros</span>
            {activeFilterCount > 0 && <span className="home-filter-badge">{activeFilterCount}</span>}
          </button>
        )}
      </div>
      {/* Mobile search pill (floating overlay) */}
      {showSearchBar && (
        <SearchPillMobile
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchInputRef={searchInputRef}
          onClose={() => { setShowSearchBar(false); if (!searchQuery) setSearchQuery('') }}
        />
      )}

      {/* Desktop search + filtros (hidden on mobile) */}
      <div className="home-search-desktop-row">
        <div className="home-inline-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')}><X size={14} /></button>
          )}
        </div>
        <button
          className={`home-filtros-btn ${showFilterCards ? 'active' : ''}`}
          onClick={() => setShowFilterCards(prev => !prev)}
          style={{ position: 'relative' }}
        >
          <SlidersHorizontal size={16} />
          <span>Filtros</span>
          {activeFilterCount > 0 && <span className="home-filter-badge">{activeFilterCount}</span>}
        </button>
      </div>

      {showFilterCards && (
        <div className="home-filter-cards">
          {FILTER_CARDS[tab].map((cardKey, index) => {
            const expanded = expandedFilterCard === cardKey
            return (
              <div
                key={cardKey}
                className={`home-filter-card ${expanded ? 'expanded' : ''}`}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <button
                  className="home-filter-card-header"
                  onClick={() => setExpandedFilterCard(prev => prev === cardKey ? null : cardKey)}
                >
                  {FILTER_CARD_ICONS[cardKey] && (() => { const CardIcon = FILTER_CARD_ICONS[cardKey]; return <CardIcon size={14} className="home-filter-card-icon" /> })()}
                  <span className="home-filter-card-title">{FILTER_CARD_LABELS[cardKey]}</span>
                  {getCardActiveCount(cardKey) > 0 && (
                    <span className="home-filter-card-badge">{getCardActiveCount(cardKey)}</span>
                  )}
                  <ChevronDown size={14} className={`home-filter-card-chevron ${expanded ? 'rotated' : ''}`} />
                </button>
                <div className="home-filter-card-body">
                  {renderFilterCardContent(cardKey)}
                  {getCardActiveCount(cardKey) > 0 && (
                    <button className="home-filter-clear-card" onClick={() => clearCardFilter(cardKey)}>
                      Limpiar {FILTER_CARD_LABELS[cardKey].toLowerCase()}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
          {activeFilterCount > 0 && (
            <div className="home-filter-actions">
              <button className="home-filter-clear" onClick={limpiarFiltros}>
                Limpiar filtros
              </button>
              <button className="home-filter-apply" onClick={() => setShowFilterCards(false)}>
                Aplicar filtros
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab Pills: Servicios / Productos / Movimientos */}
      {!activeBalancePanel && (<>
      <div className="home-tab-row">
        <div className="home-tab-pills">
          <button
            className={`home-tab-pill ${tab === 'servicios' ? 'active' : ''}`}
            onClick={() => setTab('servicios')}
          >
            <span className="home-tab-pill-icon"><Droplets size={22} /></span>
            <span className="home-tab-pill-label">Servicios</span>
          </button>
          <button
            className={`home-tab-pill ${tab === 'productos' ? 'active' : ''}`}
            onClick={() => setTab('productos')}
          >
            <span className="home-tab-pill-icon"><ShoppingBag size={22} /></span>
            <span className="home-tab-pill-label">{isMobile ? 'Productos' : 'Prod/Memb'}</span>
          </button>
          <button
            className={`home-tab-pill ${tab === 'movimientos' ? 'active' : ''}`}
            onClick={() => setTab('movimientos')}
          >
            <span className="home-tab-pill-icon"><ArrowLeftRight size={22} /></span>
            <span className="home-tab-pill-label">Movimientos</span>
          </button>
          {rol !== 'viewer' && (
            <button className={`home-tab-pill ${tab === 'clientes' ? 'active' : ''}`} onClick={() => setTab('clientes')}>
              <span className="home-tab-pill-icon"><Users size={22} /></span>
              <span className="home-tab-pill-label">Clientes</span>
            </button>
          )}
          {isMobile && rol === 'admin' && (
            <button className={`home-tab-pill ${tab === 'trabajadores' ? 'active' : ''}`} onClick={() => setTab('trabajadores')}>
              <span className="home-tab-pill-icon"><Wallet size={22} /></span>
              <span className="home-tab-pill-label">Trabajadores</span>
            </button>
          )}
        </div>
        {['servicios', 'productos', 'movimientos'].includes(tab) && (<>
        <span className={`home-tab-total-inline${totalTab < 0 ? ' negative' : ''}`}>
          {showMoney ? (<>{formatMoney(totalTab)}<span className="home-tab-total-cobrado"> / {formatMoney(cobradoTab)}</span></>) : <>{displayMoney(totalTab)}<span className="home-tab-total-cobrado"> / {displayMoney(cobradoTab)}</span></>}
        </span>
        <div className="home-tab-actions">
          <div className="quick-filter-wrapper">
            <div
              className={`quick-filter-trigger ${filtroEstado.length > 0 || filtroPago || filtroLavador.length > 0 ? 'has-filters' : ''}`}
              onClick={() => setShowQuickFilter(prev => !prev)}
              role="button"
              tabIndex={0}
            >
              <div className="quick-filter-circle">{(tab === 'servicios' ? allServicios : tab === 'productos' ? allProductos : allMovimientos).length}</div>
              <span className="quick-filter-text">{filtroEstado.length === 0 && !filtroPago ? 'Servicios' : filtroEstado.length === 1 ? ESTADO_LABELS[filtroEstado[0]] : filtroEstado.length > 1 ? `${filtroEstado.length} estados` : filtroPago === 'pagado' ? 'Pagado' : 'No pagado'} ({(tab === 'servicios' ? allServicios : tab === 'productos' ? allProductos : allMovimientos).length})</span>
            </div>
            {showQuickFilter && createPortal(
              <>
                <div className={`quick-filter-backdrop ${quickFilterClosing ? 'closing' : ''}`} onClick={closeQuickFilter} />
                <div className={`quick-filter-popup ${quickFilterClosing ? 'closing' : ''}`}>
                  <div className="quick-filter-section">
                    <span className="quick-filter-label">Estado</span>
                    <div className="quick-filter-chips">
                      {[
                        { key: 'EN ESPERA', emoji: '🕐', label: 'Espera' },
                        { key: 'EN LAVADO', emoji: '🫧', label: 'En proceso' },
                        { key: 'TERMINADO', emoji: '✅', label: 'Terminado' },
                        { key: 'ENTREGADO', emoji: '🚗', label: 'Entregado' },
                      ].map(item => (
                        <button
                          key={item.key}
                          className={`quick-filter-chip ${ESTADO_CLASSES[item.key]} ${filtroEstado.includes(item.key) ? 'active' : ''}`}
                          onClick={() => {
                            setFiltroEstado(prev => prev.includes(item.key) ? [] : [item.key])
                            setFiltroPago('')
                            closeQuickFilter()
                          }}
                        >
                          {item.emoji} {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="quick-filter-divider" />
                  <div className="quick-filter-section">
                    <span className="quick-filter-label">Pago</span>
                    <div className="quick-filter-chips">
                      {[
                        { key: 'pagado', emoji: '💰', label: 'Pagado' },
                        { key: 'sin-pagar', emoji: '🚫', label: 'No pagado' },
                      ].map(p => (
                        <button
                          key={p.key}
                          className={`quick-filter-chip quick-filter-pago ${filtroPago === p.key ? 'active' : ''}`}
                          onClick={() => {
                            setFiltroPago(prev => prev === p.key ? '' : p.key)
                            setFiltroEstado([])
                            closeQuickFilter()
                          }}
                        >
                          {p.emoji} {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {tab === 'servicios' && lavadores.length > 0 && (
                    <>
                      <div className="quick-filter-divider" />
                      <div className="quick-filter-section">
                        <span className="quick-filter-label">Trabajador</span>
                        <div className="quick-filter-chips">
                          {lavadores.map(l => (
                            <button
                              key={l.id}
                              className={`quick-filter-chip quick-filter-lavador ${filtroLavador.includes(String(l.id)) ? 'active' : ''}`}
                              onClick={() => {
                                setFiltroLavador(prev => {
                                  const id = String(l.id)
                                  return prev.includes(id) ? prev.filter(k => k !== id) : [...prev, id]
                                })
                              }}
                            >
                              {l.nombre}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                  {(filtroEstado.length > 0 || filtroPago || filtroLavador.length > 0) && (
                    <button className="quick-filter-clear" onClick={() => { setFiltroEstado([]); setFiltroPago(''); setFiltroLavador([]); closeQuickFilter() }}>
                      Limpiar filtros
                    </button>
                  )}
                </div>
              </>,
              document.body
            )}
          </div>
          <div className="home-desktop-add-wrapper">
            <button
              className={`home-desktop-add-circle ${showFabMenu ? 'open' : ''}`}
              onClick={() => setShowFabMenu(!showFabMenu)}
            >
              <Plus size={22} />
            </button>
            {showFabMenu && (
              <>
                <div className="desktop-fab-overlay" onClick={() => setShowFabMenu(false)} />
                <div className="desktop-fab-dropdown">
                  <button onClick={() => { setShowFabMenu(false); openMovimientoModal('INGRESO') }}>
                    <TrendingUp size={18} /> Registrar Ing/Egr
                  </button>
                  <button onClick={() => { setShowFabMenu(false); setShowServicioModal(true) }}>
                    <Droplets size={18} /> Nuevo Servicio
                  </button>
                  <button onClick={() => { setShowFabMenu(false); setShowNuevoClienteModal(true) }}>
                    <UserPlus size={18} /> Nuevo Cliente
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
          </div>
        </div>
        </>)}
      </div>

      {/* Embedded mobile tabs */}
      {tab === 'clientes' && (
        <Suspense fallback={<div className="loading-screen">Cargando...</div>}>
          <div className="embedded-tab-content">
            <Clientes externalSearch={searchQuery} />
          </div>
        </Suspense>
      )}
      {tab === 'trabajadores' && isMobile && (
        <Suspense fallback={<div className="loading-screen">Cargando...</div>}>
          <div className="embedded-tab-content">
            <PagoTrabajadores externalSearch={searchQuery} externalDesde={fechaDesde} externalHasta={fechaHasta} />
          </div>
        </Suspense>
      )}

      {/* Recent Cards */}
      {['servicios', 'productos', 'movimientos'].includes(tab) && (
      <div className="home-recent-list">
        {tab === 'servicios' && (
          recentServicios.length > 0 ? (
            <div className="lavadas-cards">
              {(() => {
                const estadoOrder = ['EN ESPERA', 'EN LAVADO', 'TERMINADO', 'ENTREGADO']
                const estadoGroupColors = {
                  'EN ESPERA': 'var(--accent-yellow)',
                  'EN LAVADO': 'var(--accent-green)',
                  'TERMINADO': 'oklch(0.7 0.05 259)',
                  'ENTREGADO': 'oklch(0.5 0.18 160)',
                }
                const grouped = {}
                recentServicios.forEach(item => {
                  const est = item.estado || 'EN ESPERA'
                  if (!grouped[est]) grouped[est] = []
                  grouped[est].push(item)
                })
                // Flat sibling list so React preserves ServiceCard DOM when cards move between estado groups
                const elements = []
                estadoOrder.forEach(est => {
                  if (!grouped[est]?.length) return
                  elements.push(
                    <div key={`header-${est}`} className="estado-category-header">
                      <span className="estado-category-title" style={{ color: estadoGroupColors[est] }}>
                        {ESTADO_LABELS[est] || est}
                      </span>
                      <span className="estado-category-count" style={{ color: estadoGroupColors[est] }}>
                        {grouped[est].length}
                      </span>
                      <div className="estado-category-line" style={{ background: estadoGroupColors[est] }} />
                    </div>
                  )
                  grouped[est].forEach(item => {
                    elements.push(
                      <SwipeableCard
                        key={item.id}
                        id={item.id}
                        isMobile={isMobile}
                        onDelete={() => requestEliminarLavada(item.id)}
                        onSelect={() => { if (!modoSeleccion) setModoSeleccion(true); toggleSelectItem(item.id) }}
                        onWhatsApp={() => setSwipeWaLavada(item)}
                        selectionMode={modoSeleccion}
                        isExpanded={expandedCards[item.id]}
                        openSwipeId={openSwipeId}
                        onSwipeOpen={setOpenSwipeId}
                      >
                        <ServiceCard
                          lavada={item}
                          onEstadoChange={handleEstadoChange}
                          onTipoLavadoChange={handleTipoLavadoChangeInline}
                          onAdicionalChange={handleAdicionalChange}
                          onLavadorChange={handleLavadorChange}
                          onPagosChange={handlePagosChange}
                          onNotasChange={handleNotasChange}
                          onValorChange={handleServiceValorChange}
                          onEliminar={requestEliminarLavada}
                          onWhatsApp={handleWhatsApp}
                          plantillasMensaje={plantillasMensaje}
                          isExpanded={expandedCards[item.id]}
                          isCollapsing={collapsingCards[item.id]}
                          isUpdating={updatingCards.has(item.id)}
                          editingPago={editingPago}
                          validationErrors={validationErrors[item.id]}
                          onToggleExpand={() => {
                            if (expandedCards[item.id]) {
                              smoothCollapse(item.id)
                            } else {
                              setShowFabMenu(false)
                              collapseAllExcept(item.id)
                            }
                          }}
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
                          onValidationToast={(msg) => toast.error(msg)}
                          activePopoverId={activePopoverId}
                          onPopoverOpen={setActivePopoverId}
                          clienteCategoria={(() => { const c = clientes.find(c => c.id == item.cliente_id); return c ? getClienteCategoria(c) : null })()}
                          onPlacaClick={(lavada) => {
                            const cliente = clientes.find(c => c.id == lavada.cliente_id)
                            if (cliente) setClienteInfoModal(cliente)
                          }}
                        />
                      </SwipeableCard>
                    )
                  })
                })
                return elements
              })()}
            </div>
          ) : (
            <p className="home-recent-empty">No hay servicios en este periodo</p>
          )
        )}
        {tab === 'servicios' && visibleCount.servicios > 20 && (
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
        {tab === 'servicios' && visibleCount.servicios <= 20 && allServicios.length > recentServicios.length && (
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
                              placeholder={getCurrencySymbol() + '0'}
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
                            <DatePicker
                              selected={editProductData.fecha ? new Date(editProductData.fecha + 'T00:00:00') : null}
                              onChange={(date) => setEditProductData(prev => ({ ...prev, fecha: date ? fechaLocalStr(date) : '' }))}
                              dateFormat="dd/MM/yyyy"
                              locale="es"
                              placeholderText="Seleccionar fecha"
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
                            <button className="btn-danger" onClick={() => setPendingDeleteMovimientoId(item.id)}>
                              <Trash2 size={16} /> Eliminar
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
        {tab === 'productos' && visibleCount.productos > 20 && (
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
        {tab === 'productos' && visibleCount.productos <= 20 && allProductos.length > recentProductos.length && (
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
                              placeholder={getCurrencySymbol() + '0'}
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
                            <DatePicker
                              selected={editProductData.fecha ? new Date(editProductData.fecha + 'T00:00:00') : null}
                              onChange={(date) => setEditProductData(prev => ({ ...prev, fecha: date ? fechaLocalStr(date) : '' }))}
                              dateFormat="dd/MM/yyyy"
                              locale="es"
                              placeholderText="Seleccionar fecha"
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
                            <button className="btn-danger" onClick={() => setPendingDeleteMovimientoId(item.id)}>
                              <Trash2 size={16} /> Eliminar
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
        {tab === 'movimientos' && visibleCount.movimientos > 20 && (
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
        {tab === 'movimientos' && visibleCount.movimientos <= 20 && allMovimientos.length > recentMovimientos.length && (
          <button className="home-show-more" onClick={() => handleShowMore('movimientos')}>
            Mostrar más
          </button>
        )}
      </div>
      )}
      </>)}

      {/* Bulk Action Bar */}
      {modoSeleccion && selectedItems.size > 0 && (
        <div className="bulk-action-bar">
          <span>{selectedItems.size} seleccionado{selectedItems.size > 1 ? 's' : ''}</span>
          <div className="bulk-action-buttons">
            <button className="btn-secondary" onClick={toggleSelectAll}>
              {selectedItems.size === currentList.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
            </button>
            <button className="btn-secondary" onClick={() => { setSelectedItems(new Set()); setModoSeleccion(false) }}>
              Cancelar
            </button>
            <button className="btn-danger" onClick={() => setShowDeleteModal(true)}>
              Eliminar
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modals */}
      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleBulkDelete}
        message={`Vas a eliminar ${selectedItems.size} elemento${selectedItems.size > 1 ? 's' : ''}. Esta acción no se puede deshacer. Ingresa tu contraseña para confirmar.`}
      />

      <ConfirmDeleteModal
        isOpen={!!pendingDeleteLavadaId}
        onClose={() => setPendingDeleteLavadaId(null)}
        onConfirm={executeEliminarLavada}
        message="Se eliminará este servicio permanentemente. Ingresa tu contraseña para confirmar."
      />

      {swipeWaLavada && (
        <>
          <div className="pago-popover-overlay" onClick={() => setSwipeWaLavada(null)} />
          <div className="swipe-wa-menu">
            {plantillasMensaje.length > 0 ? plantillasMensaje.map(p => (
              <button key={p.id} className="swipe-wa-menu-item" onClick={() => { handleWhatsApp(swipeWaLavada, { plantillaId: p.id }); setSwipeWaLavada(null) }}>
                {p.nombre}
              </button>
            )) : (
              <span className="swipe-wa-menu-empty">No hay plantillas</span>
            )}
            <button className="swipe-wa-menu-item" onClick={() => { handleWhatsApp(swipeWaLavada, {}); setSwipeWaLavada(null) }}>
              Ir al contacto
            </button>
          </div>
        </>
      )}

      <ConfirmDeleteModal
        isOpen={!!pendingDeleteMovimientoId}
        onClose={() => setPendingDeleteMovimientoId(null)}
        onConfirm={executeEliminarMovimiento}
        message="Se eliminará este movimiento permanentemente. Ingresa tu contraseña para confirmar."
      />

      {/* Cliente Info Modal */}
      {clienteInfoModal && (
        <>
          <div className="pago-popover-overlay" onClick={() => setClienteInfoModal(null)} />
          <div className="pago-popover" onClick={(e) => e.stopPropagation()}>
            <div className="pago-popover-header">
              <span className="pago-popover-title">Cliente</span>
              <button className="pago-popover-close" onClick={() => setClienteInfoModal(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="cliente-info-grid">
              {clienteInfoModal.nombre && <><span className="cliente-info-label">Nombre</span><span className="cliente-info-value">{clienteInfoModal.nombre}</span></>}
              {clienteInfoModal.telefono && <><span className="cliente-info-label">Teléfono</span><span className="cliente-info-value">{clienteInfoModal.telefono}</span></>}
              {clienteInfoModal.cedula && <><span className="cliente-info-label">Cédula</span><span className="cliente-info-value">{clienteInfoModal.cedula}</span></>}
              {clienteInfoModal.correo && <><span className="cliente-info-label">Correo</span><span className="cliente-info-value">{clienteInfoModal.correo}</span></>}
              {clienteInfoModal.placa && <><span className="cliente-info-label">Placa</span><span className="cliente-info-value">{clienteInfoModal.placa}</span></>}
              {clienteInfoModal.moto && <><span className="cliente-info-label">Vehículo</span><span className="cliente-info-value">{clienteInfoModal.moto}</span></>}
              {clienteInfoModal.membresia && <><span className="cliente-info-label">Categoría</span><span className="cliente-info-value">{typeof clienteInfoModal.membresia === 'object' ? clienteInfoModal.membresia.nombre : clienteInfoModal.membresia}</span></>}
            </div>
            {clienteInfoModal.telefono && (
              <div className="cliente-info-whatsapp">
                <span className="cliente-info-plantillas-label" style={{ margin: '1rem 1rem 1.5rem 1rem' }}>Enviar mensaje</span>
                <div className="cliente-info-plantillas" style={{ margin: '1rem 0' }}>
                  <button
                    className="btn-plantilla-chip"
                    onClick={() => {
                      const telefono = clienteInfoModal.telefono.replace(/\D/g, '')
                      window.open(`https://api.whatsapp.com/send?phone=${phoneCode}${telefono}`, '_blank')
                    }}
                  >
                    Mensaje nuevo
                  </button>
                  {plantillasMensaje.map(p => (
                    <button
                      key={p.id}
                      className="btn-plantilla-chip"
                      onClick={() => {
                        const telefono = clienteInfoModal.telefono.replace(/\D/g, '')
                        const variables = {
                          nombre: clienteInfoModal.nombre || '',
                          telefono: clienteInfoModal.telefono || '',
                          negocio: negocioNombre || '',
                          membresia: typeof clienteInfoModal.membresia === 'object' ? clienteInfoModal.membresia?.nombre || 'Sin membresía' : clienteInfoModal.membresia || 'Sin membresía',
                          placa: clienteInfoModal.placa || '',
                        }
                        const texto = p.texto.replace(/\{(\w+)\}/g, (match, key) => variables[key] ?? match)
                        window.open(`https://api.whatsapp.com/send?phone=${phoneCode}${telefono}&text=${encodeURIComponent(texto)}`, '_blank')
                        supabase.from('mensajes_enviados').insert([{
                          cliente_id: clienteInfoModal.id,
                          plantilla_id: p.id,
                          plantilla_nombre: p.nombre,
                          mensaje_texto: texto,
                          enviado_por: userEmail || null,
                          origen: 'info_cliente',
                          negocio_id: negocioId,
                        }]).then(({ error }) => {
                          if (error?.message?.includes('PLAN_LIMIT_REACHED')) {
                            toast.error('Límite de 10 mensajes/mes alcanzado. Actualiza a PRO.')
                          }
                        })
                      }}
                    >
                      {p.nombre}
                    </button>
                  ))}
                  <button
                    className="btn-plantilla-add"
                    onClick={() => { setClienteInfoModal(null); navigate('/cuenta?tab=config&subtab=mensajes') }}
                  >
                    + Agregar plantilla
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal Nuevo Cliente */}
      {showNuevoClienteModal && (
        <div className="modal-overlay" onClick={() => { setShowNuevoClienteModal(false); resetNuevoClienteData() }}>
          <div className="modal modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-sheet-handle"><div className="modal-sheet-handle-bar" /></div>
            <div className="modal-sheet-header">
              <button type="button" className="btn-sheet-close" onClick={() => { setShowNuevoClienteModal(false); resetNuevoClienteData() }}><X size={20} /></button>
              <h2>Nuevo Cliente</h2>
              <button
                type="button"
                className="btn-sheet-action"
                onClick={handleNuevoCliente}
                disabled={creandoCliente || !nuevoClienteData.nombre || !nuevoClienteData.placa}
              >
                {creandoCliente ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleNuevoCliente(e); }}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Nombre completo</label>
                  <input type="text" value={nuevoClienteData.nombre} onChange={e => setNuevoClienteData(prev => ({ ...prev, nombre: e.target.value }))} required autoFocus />
                </div>
                <div className="form-group">
                  <label>Cédula</label>
                  <input type="text" value={nuevoClienteData.cedula} onChange={e => setNuevoClienteData(prev => ({ ...prev, cedula: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Teléfono</label>
                  <input type="text" value={nuevoClienteData.telefono} onChange={e => setNuevoClienteData(prev => ({ ...prev, telefono: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Correo</label>
                  <input type="email" value={nuevoClienteData.correo} onChange={e => setNuevoClienteData(prev => ({ ...prev, correo: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Placa</label>
                  <input type="text" value={nuevoClienteData.placa} onChange={e => setNuevoClienteData(prev => ({ ...prev, placa: e.target.value.toUpperCase() }))} required />
                </div>
                <div className="form-group">
                  <label>Vehículo</label>
                  <input type="text" value={nuevoClienteData.moto} onChange={e => setNuevoClienteData(prev => ({ ...prev, moto: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Tipo de Cliente</label>
                  <select value={nuevoClienteData.membresia_id} onChange={e => handleNuevoClienteMembresiaChange(e.target.value)}>
                    <option value="">Seleccionar</option>
                    {tiposMembresia.map(m => (
                      <option key={m.id} value={m.id}>{m.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Fecha inicio</label>
                    <DatePicker
                      selected={nuevoClienteData.fecha_inicio_membresia}
                      onChange={date => setNuevoClienteData(prev => ({ ...prev, fecha_inicio_membresia: date }))}
                      dateFormat="dd/MM/yyyy"
                      locale="es"
                      isClearable
                      placeholderText="Seleccionar fecha"
                    />
                  </div>
                  <div className="form-group">
                    <label>Fecha fin</label>
                    <DatePicker
                      selected={nuevoClienteData.fecha_fin_membresia}
                      onChange={date => setNuevoClienteData(prev => ({ ...prev, fecha_fin_membresia: date }))}
                      dateFormat="dd/MM/yyyy"
                      locale="es"
                      isClearable
                      placeholderText="Seleccionar fecha"
                      minDate={nuevoClienteData.fecha_inicio_membresia}
                    />
                  </div>
                </div>
              </div>
            </form>
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


      {/* FAB pill for mobile (left side) — "+" and search */}
      {!modoSeleccion && tab !== 'trabajadores' && (() => {
        const slot = document.getElementById('fab-slot-left')
        return slot ? createPortal(
          <div className="fab-pill-container">
            <button
              className={`fab-pill-btn fab-pill-plus ${showFabMenu ? 'open' : ''}`}
              onClick={() => setShowFabMenu(prev => !prev)}
              title="Nuevo"
            >
              <Plus size={22} />
            </button>
            <button
              className="fab-pill-btn fab-pill-search"
              onClick={() => {
                setShowSearchBar(true)
                setTimeout(() => searchInputRef.current?.focus(), 100)
              }}
              title="Buscar"
            >
              <Search size={20} />
            </button>
          </div>,
          slot
        ) : null
      })()}
      {showFabMenu && (
        <>
          <div className="mobile-fab-overlay" onClick={() => setShowFabMenu(false)} />
          <div className="mobile-fab-menu">
            <button onClick={() => { setShowFabMenu(false); setShowServicioModal(true) }}>
              <Droplets size={18} /> Nuevo Servicio
            </button>
            <button onClick={() => { setShowFabMenu(false); setShowVentaModal(true) }}>
              <ShoppingBag size={18} /> Nueva Venta
            </button>
            <button onClick={() => { setShowFabMenu(false); openMovimientoModal('INGRESO') }}>
              <TrendingUp size={18} /> Registrar Ing/Egr
            </button>
            <button onClick={() => { setShowFabMenu(false); setShowNuevoClienteModal(true) }}>
              <UserPlus size={18} /> Nuevo Cliente
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
              <Upload size={18} /> Importar
            </button>
          </div>
        </>
      )}

      {/* Modal Nuevo Movimiento (bottom-sheet) */}
      {showMovimientoModal && (
        <div className="modal-overlay" onClick={handleCloseMovimiento}>
          <div
            className="modal modal-sheet"
            ref={movimientoSheetRef}
            onClick={e => e.stopPropagation()}
            style={movimientoDragY > 0 ? { transform: `translateY(${movimientoDragY}px)`, transition: 'none' } : {}}
          >
            <div
              className="modal-sheet-handle"
              onTouchStart={onMovimientoSheetTouchStart}
              onTouchMove={onMovimientoSheetTouchMove}
              onTouchEnd={onMovimientoSheetTouchEnd}
            >
              <div className="modal-sheet-handle-bar" />
            </div>

            <div className="modal-sheet-header">
              <button className="btn-sheet-close" onClick={handleCloseMovimiento}>
                <X size={20} />
              </button>
              <h2>{movimientoForm.tipo === 'INGRESO' ? 'Registrar Ingreso' : 'Registrar Egreso'}</h2>
              <button
                className="btn-sheet-action"
                onClick={handleMovimientoSubmit}
                disabled={movimientoSubmitting || !movimientoForm.valor || !movimientoForm.categoria || !movimientoForm.metodo_pago_id}
              >
                {movimientoSubmitting ? 'Guardando...' : 'Registrar'}
              </button>
            </div>

            <div className="modal-sheet-body">
              {/* Tipo toggle */}
              <div className="movimiento-tipo-toggle">
                <button
                  className={`movimiento-tipo-btn ${movimientoForm.tipo === 'INGRESO' ? 'active ingreso' : ''}`}
                  onClick={() => setMovimientoForm(prev => ({ ...prev, tipo: 'INGRESO', categoria: '' }))}
                >
                  <TrendingUp size={16} /> Ingreso
                </button>
                <button
                  className={`movimiento-tipo-btn ${movimientoForm.tipo === 'EGRESO' ? 'active egreso' : ''}`}
                  onClick={() => setMovimientoForm(prev => ({ ...prev, tipo: 'EGRESO', categoria: '' }))}
                >
                  <TrendingDown size={16} /> Egreso
                </button>
              </div>

              {/* Valor */}
              <div className="form-group">
                <label>Valor</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={movimientoForm.valor ? `$ ${movimientoForm.valor}` : ''}
                  onChange={(e) => handleMovimientoValorChange(e.target.value)}
                  placeholder={getCurrencySymbol() + ' 0'}
                  autoFocus
                />
              </div>

              {/* Categoría */}
              <div className="form-group">
                <label>Categoría</label>
                <select
                  value={movimientoForm.categoria}
                  onChange={(e) => setMovimientoForm(prev => ({ ...prev, categoria: e.target.value }))}
                  required
                >
                  <option value="">Seleccionar categoría</option>
                  {categoriasMovimiento[movimientoForm.tipo].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Método de pago */}
              <div className="form-group">
                <label>Método de pago</label>
                <select
                  value={movimientoForm.metodo_pago_id}
                  onChange={(e) => setMovimientoForm(prev => ({ ...prev, metodo_pago_id: e.target.value }))}
                  required
                >
                  <option value="">Seleccionar método</option>
                  {metodosPago.map(m => (
                    <option key={m.id} value={m.id}>{m.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Descripción */}
              <div className="form-group">
                <label>Descripción</label>
                <input
                  type="text"
                  value={movimientoForm.descripcion}
                  onChange={(e) => setMovimientoForm(prev => ({ ...prev, descripcion: e.target.value }))}
                  placeholder="Ej: Pago de agua, compra de shampoo..."
                />
              </div>

              {/* Placa o persona */}
              <div className="form-group">
                <label>Placa o persona (opcional)</label>
                <input
                  type="text"
                  value={movimientoForm.placa_o_persona}
                  onChange={(e) => setMovimientoForm(prev => ({ ...prev, placa_o_persona: e.target.value }))}
                  placeholder="Ej: ABC123 o Juan Pérez"
                />
              </div>

              {/* Fecha */}
              <div className="form-group">
                <label>Fecha</label>
                <DatePicker
                  selected={movimientoForm.fecha ? new Date(movimientoForm.fecha + 'T00:00:00') : null}
                  onChange={(date) => setMovimientoForm(prev => ({ ...prev, fecha: date ? fechaLocalStr(date) : '' }))}
                  dateFormat="dd/MM/yyyy"
                  locale="es"
                  placeholderText="Seleccionar fecha"
                />
              </div>
            </div>

          </div>
        </div>
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
                            <span className="cliente-search-tag">{getClienteCategoria(c)}</span>
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
                {ventaForm.cliente_id && (() => {
                  const cliente = clientes.find(c => c.id == ventaForm.cliente_id)
                  if (!cliente) return null
                  const cat = getClienteCategoria(cliente)
                  const tieneMembresia = (() => {
                    if (!cliente.membresia_id) return false
                    const nombre = (cliente.membresia?.nombre || '').toLowerCase().trim()
                    return nombre !== 'cliente' && nombre !== 'cliente frecuente' && nombre !== 'sin membresia' && nombre !== 'sin membresía'
                  })()
                  if (!tieneMembresia) return <span className="cliente-categoria-info">{cat}</span>
                  const hoy = new Date()
                  hoy.setHours(0, 0, 0, 0)
                  const finRaw = cliente.fecha_fin_membresia ? new Date(cliente.fecha_fin_membresia) : null
                  const fin = finRaw && !isNaN(finRaw) ? finRaw : null
                  if (fin) fin.setHours(0, 0, 0, 0)
                  const activa = fin && fin >= hoy
                  const fechaStr = fin ? fin.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : null
                  return (
                    <span className={`cliente-categoria-info ${activa ? 'mem-activa' : 'mem-vencida'}`}>
                      {cat} · {activa ? 'Activa' : 'Vencida'}{fechaStr && ` · Vence: ${fechaStr}`}
                    </span>
                  )
                })()}
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
                            setVentaForm(prev => ({ ...prev, producto_id: prodId, valor: formatPriceLocale(precioTotal) }))
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
                        const newValor = prod ? formatPriceLocale(Number(prod.precio) * cantFinal) : ventaForm.valor
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
                        setVentaForm(prev => ({ ...prev, membresia_id: membId, valor: precio ? formatPriceLocale(precio) : '' }))
                      }}
                    >
                      <option value="">Seleccionar membresía</option>
                      {tiposMembresia
                        .filter(m => {
                          const n = m.nombre.toLowerCase().trim()
                          return n !== 'cliente' && n !== 'cliente frecuente' && !n.includes('sin ')
                        })
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
                      <span style={{ color: '#575200', fontSize: '0.8rem', marginTop: '0.35rem', display: 'block' }}>
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
                  placeholder={getCurrencySymbol() + '0'}
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
                            const formatted = limpio ? formatPriceLocale(Number(limpio)) : ''
                            const newPagos = [...ventaForm.pagos]
                            newPagos[idx] = { ...newPagos[idx], valor: formatted }
                            setVentaForm(prev => ({ ...prev, pagos: newPagos }))
                          }}
                          placeholder={getCurrencySymbol() + '0'}
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
                      const newPagos = [...ventaForm.pagos, { metodo_pago_id: '', valor: restante ? formatPriceLocale(restante) : '' }]
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

      {showUpgradeModal && <UpgradeModal onClose={() => { setShowUpgradeModal(false); setUpgradePeriod(null) }} initialPeriod={upgradePeriod} />}

      {/* Active search chip — fixed at bottom on mobile */}
      {searchQuery && (
        <div className="home-search-chip">
          <Search size={14} />
          <span>Buscando: {searchQuery}</span>
          <button onClick={() => setSearchQuery('')}><X size={14} /></button>
        </div>
      )}

      {/* Fullscreen Search */}
      {showFullSearch && (() => {
        const q = fullSearchQuery.trim().toLowerCase()
        const results = []

        if (q.length >= 1) {
          // Servicios (lavadas)
          lavadas.filter(l =>
            (l.placa || '').toLowerCase().includes(q) ||
            (l.cliente?.nombre || '').toLowerCase().includes(q)
          ).slice(0, 5).forEach(l => results.push({
            type: 'servicios',
            label: `${l.cliente?.nombre || 'Sin nombre'} — ${l.placa}`,
            sub: `${l.estado} · ${formatMoney(l.valor || 0)}`,
            searchValue: l.placa,
          }))

          // Productos
          transacciones.filter(t =>
            (t.categoria === 'PRODUCTO' || t.categoria === 'MEMBRESIA') &&
            ((t.descripcion || '').toLowerCase().includes(q) || (t.placa_o_persona || '').toLowerCase().includes(q))
          ).slice(0, 5).forEach(t => results.push({
            type: 'productos',
            label: t.descripcion || 'Sin descripcion',
            sub: `${t.tipo} · ${formatMoney(t.valor || 0)}`,
            searchValue: t.descripcion || t.placa_o_persona,
          }))

          // Movimientos
          transacciones.filter(t =>
            t.categoria !== 'PRODUCTO' && t.categoria !== 'MEMBRESIA' &&
            ((t.descripcion || '').toLowerCase().includes(q) || (t.placa_o_persona || '').toLowerCase().includes(q) || (t.categoria || '').toLowerCase().includes(q))
          ).slice(0, 5).forEach(t => results.push({
            type: 'movimientos',
            label: t.descripcion || t.categoria || 'Movimiento',
            sub: `${t.tipo} · ${formatMoney(t.valor || 0)}`,
            searchValue: t.descripcion || t.placa_o_persona,
          }))

          // Clientes
          clientes.filter(c =>
            (c.nombre || '').toLowerCase().includes(q) ||
            (c.placa || '').toLowerCase().includes(q) ||
            (c.telefono || '').toLowerCase().includes(q)
          ).slice(0, 5).forEach(c => results.push({
            type: 'clientes',
            label: `${c.nombre || 'Sin nombre'} — ${c.placa || ''}`,
            sub: c.telefono || 'Sin telefono',
            searchValue: c.nombre || c.placa,
          }))

          // Trabajadores (lavadores)
          lavadores.filter(l =>
            (l.nombre || '').toLowerCase().includes(q)
          ).slice(0, 5).forEach(l => results.push({
            type: 'trabajadores',
            label: l.nombre,
            sub: l.activo !== false ? 'Activo' : 'Inactivo',
            searchValue: l.nombre,
          }))
        }

        const typeLabels = { servicios: 'Servicios', productos: 'Productos', movimientos: 'Movimientos', clientes: 'Clientes', trabajadores: 'Trabajadores' }
        const typeIcons = { servicios: Droplets, productos: ShoppingBag, movimientos: ArrowLeftRight, clientes: User, trabajadores: Wrench }
        const grouped = {}
        results.forEach(r => {
          if (!grouped[r.type]) grouped[r.type] = []
          grouped[r.type].push(r)
        })

        return (
          <div className="fullsearch-overlay">
            <div className="fullsearch-header">
              <button className="fullsearch-back" onClick={() => setShowFullSearch(false)}>
                <ArrowLeft size={22} />
              </button>
              <input
                ref={fullSearchInputRef}
                type="text"
                className="fullsearch-input"
                placeholder="Buscar servicios, productos, clientes..."
                value={fullSearchQuery}
                onChange={(e) => setFullSearchQuery(e.target.value)}
                autoFocus
              />
              {fullSearchQuery && (
                <button className="fullsearch-clear" onClick={() => { setFullSearchQuery(''); fullSearchInputRef.current?.focus() }}>
                  <X size={18} />
                </button>
              )}
            </div>
            <div className="fullsearch-results">
              {q.length === 0 && (
                <div className="fullsearch-empty">Escribe para buscar</div>
              )}
              {q.length >= 1 && results.length === 0 && (
                <div className="fullsearch-empty">Sin resultados para "{fullSearchQuery}"</div>
              )}
              {Object.entries(grouped).map(([type, items]) => {
                const Icon = typeIcons[type] || Search
                return (
                <div key={type} className="fullsearch-group">
                  <div className="fullsearch-group-title">{typeLabels[type]}</div>
                  {items.map((item, i) => (
                    <button
                      key={i}
                      className="fullsearch-item"
                      onClick={() => {
                        setShowFullSearch(false)
                        setSearchQuery(item.searchValue)
                        setTab(item.type)
                        setPeriodo('a')
                      }}
                    >
                      <span className={`fullsearch-item-icon fullsearch-icon--${type}`}><Icon size={18} /></span>
                      <span className="fullsearch-item-text">
                        <div className="fullsearch-item-label">{item.label}</div>
                        <div className="fullsearch-item-sub">{item.sub}</div>
                      </span>
                    </button>
                  ))}
                </div>
              )})}
            </div>
          </div>
        )
      })()}

    </div>
  )
}
