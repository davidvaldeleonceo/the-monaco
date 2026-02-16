import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useData } from './DataContext'
import { useServiceHandlers } from '../hooks/useServiceHandlers'
import ServiceCard from './ServiceCard'
import { formatMoney } from '../utils/money'
import { ESTADO_LABELS, ESTADO_CLASSES } from '../config/constants'
import { Plus, Droplets, DollarSign, X, Search, SlidersHorizontal, CheckSquare, Trash2, Upload, Download } from 'lucide-react'
import * as XLSX from 'xlsx'

export default function Home() {
  const navigate = useNavigate()
  const { lavadas, metodosPago, negocioId, clientes, deleteLavadaLocal, loadAllLavadas, lavadasAllLoaded, productos, refreshConfig } = useData()

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
    producto_id: '',
  })
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

  // Import states
  const [showImportModal, setShowImportModal] = useState(false)
  const [importStep, setImportStep] = useState('upload')
  const [importErrors, setImportErrors] = useState([])
  const [importNuevos, setImportNuevos] = useState([])
  const [importProgress, setImportProgress] = useState(0)
  const [importResult, setImportResult] = useState(null)
  const [importTipo, setImportTipo] = useState('')
  const fileInputRef = useRef(null)

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

  useEffect(() => {
    if (periodo === 'a' && !lavadasAllLoaded) {
      loadAllLavadas()
    }
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
  const allServicios = lavadasFiltradas.filter(l => {
    if (filtroEstado && l.estado !== filtroEstado) return false
    if (filtroLavador && l.lavador_id != filtroLavador) return false
    return true
  })
  const allProductos = transacciones
    .filter(t => t.categoria === 'MEMBRESIA')
    .filter(t => {
      if (filtroTipo && t.tipo !== filtroTipo) return false
      if (filtroMetodoPago && t.metodo_pago_id != filtroMetodoPago) return false
      return true
    })
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
  const allMovimientos = todasEntradas
    .filter(t => !t._esLavada && t.categoria !== 'MEMBRESIA')
    .filter(t => {
      if (filtroTipo && t.tipo !== filtroTipo) return false
      if (filtroMetodoPago && t.metodo_pago_id != filtroMetodoPago) return false
      return true
    })
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
        let query = supabase.from('transacciones').select('*, metodo_pago:metodos_pago(nombre)').order('fecha', { ascending: false })
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

    // Deduct stock if a product was selected
    if (ventaForm.producto_id) {
      const producto = productos.find(p => p.id === ventaForm.producto_id)
      if (producto) {
        await supabase.from('productos').update({ cantidad: Math.max(0, producto.cantidad - 1) }).eq('id', producto.id)
        refreshConfig()
      }
    }

    setShowVentaModal(false)
    setVentaForm({ valor: '', descripcion: '', metodo_pago_id: '', categoria: 'MEMBRESIA', placa_o_persona: '', producto_id: '' })
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
    let query = supabase.from('transacciones').select('*, metodo_pago:metodos_pago(nombre)').order('fecha', { ascending: false })
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
          onClick={() => { setTab('servicios'); setFiltroEstado(''); setFiltroLavador(''); setFiltroTipo(''); setFiltroMetodoPago(''); setModoSeleccion(false); setSelectedItems(new Set()) }}
        >
          Servicios
        </button>
        <button
          className={`home-tab-pill ${tab === 'productos' ? 'active' : ''}`}
          onClick={() => { setTab('productos'); setFiltroEstado(''); setFiltroLavador(''); setFiltroTipo(''); setFiltroMetodoPago(''); setModoSeleccion(false); setSelectedItems(new Set()) }}
        >
          Productos
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
          Recientes — {{ servicios: 'Servicios', productos: 'Productos', movimientos: 'Movimientos' }[tab]}
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
              <div key={item.id}
                className={`home-recent-card ${modoSeleccion && selectedItems.has(item.id) ? 'card-selected' : ''}`}
                onClick={() => modoSeleccion ? toggleSelectItem(item.id) : navigate('/balance')}>
                {modoSeleccion && (
                  <label className="custom-check" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedItems.has(item.id)} onChange={() => toggleSelectItem(item.id)} />
                    <span className="checkmark"></span>
                  </label>
                )}
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
              <div key={item.id}
                className={`home-recent-card ${modoSeleccion && selectedItems.has(item.id) ? 'card-selected' : ''}`}
                onClick={() => modoSeleccion ? toggleSelectItem(item.id) : navigate('/balance')}>
                {modoSeleccion && (
                  <label className="custom-check" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedItems.has(item.id)} onChange={() => toggleSelectItem(item.id)} />
                    <span className="checkmark"></span>
                  </label>
                )}
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
              {productos.filter(p => p.activo && p.cantidad > 0).length > 0 && (
                <div className="form-group" style={{ padding: '0 1.5rem' }}>
                  <label>Producto</label>
                  <select
                    value={ventaForm.producto_id}
                    onChange={(e) => {
                      const prodId = e.target.value
                      if (prodId) {
                        const prod = productos.find(p => p.id === prodId)
                        if (prod) {
                          const precioFormateado = Number(prod.precio).toLocaleString('es-CO')
                          setVentaForm(prev => ({ ...prev, producto_id: prodId, valor: precioFormateado, descripcion: prod.nombre }))
                        }
                      } else {
                        setVentaForm(prev => ({ ...prev, producto_id: '', valor: '', descripcion: '' }))
                      }
                    }}
                  >
                    <option value="">Manual (sin producto)</option>
                    {productos.filter(p => p.activo && p.cantidad > 0).map(p => (
                      <option key={p.id} value={p.id}>{p.nombre} ({p.cantidad} disp.)</option>
                    ))}
                  </select>
                </div>
              )}
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
