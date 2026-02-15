import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { useData } from './DataContext'
import { useTenant } from './TenantContext'
import { useServiceHandlers } from '../hooks/useServiceHandlers'
import ServiceCard from './ServiceCard'
import { formatMoney } from '../utils/money'
import { Plus, Search, X, Trash2, SlidersHorizontal, Upload, Download, CheckSquare, RefreshCw } from 'lucide-react'
import Select from 'react-select'
import * as XLSX from 'xlsx'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { registerLocale } from 'react-datepicker'
import es from 'date-fns/locale/es'

registerLocale('es', es)

export default function Lavadas() {
  const { lavadas: allLavadas, clientes, tiposLavado, lavadores, metodosPago, serviciosAdicionales, tiposMembresia, loading, updateLavadaLocal, addLavadaLocal, deleteLavadaLocal, addClienteLocal, refreshLavadas, refreshClientes, negocioId, loadAllLavadas, lavadasAllLoaded } = useData()
  const { userProfile, userEmail } = useTenant()

  // Trabajador role: only see their own services
  const lavadas = (() => {
    const rol = (userProfile?.rol || 'admin').toLowerCase()
    if (rol === 'trabajador' && userProfile?.lavador_id) {
      return allLavadas.filter(l => l.lavador_id === userProfile.lavador_id)
    }
    return allLavadas
  })()

  const loadSavedFilters = () => {
    try {
      const saved = localStorage.getItem('monaco_lavadas_filters')
      if (saved) {
        const f = JSON.parse(saved)
        return {
          estado: f.estado || '',
          lavador: f.lavador || '',
          desde: f.desde ? new Date(f.desde) : null,
          hasta: f.hasta ? new Date(f.hasta) : null,
          rapido: f.rapido || '',
        }
      }
    } catch { }
    // Default: filtro de mes actual
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    return { estado: '', lavador: '', desde: inicioMes, hasta: hoy, rapido: 'mes' }
  }

  const filtrosIniciales = useRef(loadSavedFilters()).current

  const [showModal, setShowModal] = useState(false)
  const [searchPlaca, setSearchPlaca] = useState('')
  const [filtroEstado, setFiltroEstado] = useState(filtrosIniciales.estado)
  const [filtroLavador, setFiltroLavador] = useState(filtrosIniciales.lavador)
  const [fechaDesde, setFechaDesde] = useState(filtrosIniciales.desde)
  const [fechaHasta, setFechaHasta] = useState(filtrosIniciales.hasta)
  const [filtroRapido, setFiltroRapido] = useState(filtrosIniciales.rapido)
  const [showFilters, setShowFilters] = useState(false)

  // Import CSV states
  const [showImportModal, setShowImportModal] = useState(false)
  const [importData, setImportData] = useState([])
  const [importErrors, setImportErrors] = useState([])
  const [importNuevos, setImportNuevos] = useState([])
  const [importStep, setImportStep] = useState('upload')
  const [importProgress, setImportProgress] = useState(0)
  const [importResult, setImportResult] = useState(null)
  const fileInputRef = useRef(null)

  // Bulk delete states
  const [modoSeleccion, setModoSeleccion] = useState(false)
  const [selectedLavadas, setSelectedLavadas] = useState(new Set())
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

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
    calcularValor,
    autoAddIncluidos,
    handleEstadoChange,
    handleLavadorChange,
    handleTipoLavadoChangeInline,
    handlePagosChange,
    handleAdicionalChange,
    handleEliminarLavada,
    enviarWhatsApp,
  } = useServiceHandlers()

  // Guardar filtros en localStorage cuando cambien
  useEffect(() => {
    localStorage.setItem('monaco_lavadas_filters', JSON.stringify({
      estado: filtroEstado,
      lavador: filtroLavador,
      desde: fechaDesde ? fechaDesde.toISOString() : null,
      hasta: fechaHasta ? fechaHasta.toISOString() : null,
      rapido: filtroRapido,
    }))
  }, [filtroEstado, filtroLavador, fechaDesde, fechaHasta, filtroRapido])


  const [clienteSearch, setClienteSearch] = useState('')
  const [showClienteDropdown, setShowClienteDropdown] = useState(false)
  const [showNuevoCliente, setShowNuevoCliente] = useState(false)
  const [nuevoClienteData, setNuevoClienteData] = useState({ nombre: '', placa: '', telefono: '' })
  const [creandoCliente, setCreandoCliente] = useState(false)

  const [formData, setFormData] = useState({
    cliente_id: '',
    placa: '',
    tipo_lavado_id: '',
    lavador_id: '',
    metodo_pago_id: '',
    valor: 0,
    adicionales: [],
    pagos: [],
    estado: 'EN ESPERA',
    notas: ''
  })

  const clienteTieneMembresia = (cliente) => {
    if (!cliente.membresia_id) return false
    const nombreMembresia = cliente.membresia?.nombre?.toLowerCase() || ''
    return !nombreMembresia.includes('sin ')
  }

  const detectarTipoLavado = (cliente) => {
    if (clienteTieneMembresia(cliente)) {
      return tiposLavado.find(t => {
        const n = t.nombre.toLowerCase()
        return (n.includes('membresia') || n.includes('membresía')) && !n.includes('sin ')
      })
    }
    return tiposLavado.find(t => {
      const n = t.nombre.toLowerCase()
      return n.includes('sin membresia') || n.includes('sin membresía')
    })
  }


  const handleClienteChange = (clienteId) => {
    const cliente = clientes.find(c => c.id == clienteId)
    if (cliente) {
      const tipo = detectarTipoLavado(cliente)
      const tipoId = tipo?.id || ''
      const adicionales = autoAddIncluidos(tipo, formData.adicionales)
      const valor = calcularValor(tipoId, adicionales)

      setClienteSearch(`${cliente.nombre} - ${cliente.placa}`)
      setShowClienteDropdown(false)
      setFormData(prev => ({
        ...prev,
        cliente_id: clienteId,
        placa: cliente.placa || '',
        tipo_lavado_id: tipoId,
        adicionales,
        valor
      }))
    } else {
      setClienteSearch('')
      setFormData(prev => ({ ...prev, cliente_id: clienteId, placa: '', tipo_lavado_id: '', valor: 0 }))
    }
  }

  const handleCrearCliente = async () => {
    if (!nuevoClienteData.nombre || !nuevoClienteData.placa) return
    setCreandoCliente(true)
    const sinMembresia = tiposMembresia.find(m => m.nombre.toLowerCase().includes('sin '))
    const hoy = new Date()
    const fechaStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
    const { data, error } = await supabase
      .from('clientes')
      .insert([{
        nombre: nuevoClienteData.nombre,
        placa: nuevoClienteData.placa.toUpperCase(),
        telefono: nuevoClienteData.telefono || null,
        membresia_id: sinMembresia?.id || null,
        fecha_inicio_membresia: fechaStr,
        fecha_fin_membresia: fechaStr,
        estado: 'Activo',
        negocio_id: negocioId
      }])
      .select('*, membresia:tipos_membresia(nombre)')
      .single()
    setCreandoCliente(false)
    if (error) {
      // Conflict: placa already exists — find and select existing client
      const existente = clientes.find(c => c.placa?.toLowerCase() === nuevoClienteData.placa.toLowerCase())
      if (existente) {
        setShowNuevoCliente(false)
        setNuevoClienteData({ nombre: '', placa: '', telefono: '' })
        handleClienteChange(existente.id)
        return
      }
      alert('Error al crear cliente: ' + (error.message || 'Error desconocido'))
      return
    }
    if (data) {
      addClienteLocal(data)
      setShowNuevoCliente(false)
      setNuevoClienteData({ nombre: '', placa: '', telefono: '' })
      setClienteSearch(`${data.nombre} - ${data.placa}`)
      setShowClienteDropdown(false)
      const sinMembresiaType = tiposLavado.find(t => t.nombre?.toLowerCase().includes('sin memb'))
      setFormData(prev => ({
        ...prev,
        cliente_id: data.id,
        placa: data.placa || '',
        tipo_lavado_id: sinMembresiaType?.id || '',
        valor: sinMembresiaType?.precio || 0
      }))
    }
  }

  const handlePlacaSearch = (placa) => {
    setFormData({ ...formData, placa })
    const cliente = clientes.find(c => c.placa.toLowerCase() === placa.toLowerCase())
    if (cliente) {
      handleClienteChange(cliente.id)
    }
  }

  const handleTipoLavadoChange = (tipoId) => {
    const tipo = tiposLavado.find(t => t.id == tipoId)
    const adicionales = autoAddIncluidos(tipo, formData.adicionales)
    const valor = calcularValor(tipoId, adicionales)
    setFormData(prev => ({
      ...prev,
      tipo_lavado_id: tipoId,
      adicionales,
      valor
    }))
  }

  const handleFormAdicionalChange = (servicio, checked) => {
    setFormData(prev => {
      let nuevosAdicionales
      if (checked) {
        nuevosAdicionales = [...prev.adicionales, { id: servicio.id, nombre: servicio.nombre, precio: Number(servicio.precio) }]
      } else {
        nuevosAdicionales = prev.adicionales.filter(a => a.id !== servicio.id)
      }
      const valor = calcularValor(prev.tipo_lavado_id, nuevosAdicionales)
      return { ...prev, adicionales: nuevosAdicionales, valor }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.cliente_id) {
      alert('Selecciona un cliente antes de guardar')
      return
    }

    const { adicionales, pagos, ...rest } = formData
    const cleanData = Object.fromEntries(
      Object.entries(rest).map(([key, value]) => [key, value === '' ? null : value])
    )

    const ahora = new Date().toISOString()
    const dataToSend = {
      ...cleanData,
      adicionales: adicionales,
      pagos: [],
      metodo_pago_id: null,
      fecha: ahora,
      tiempo_espera_inicio: ahora,
      negocio_id: negocioId
    }

    const { data, error } = await supabase
      .from('lavadas')
      .insert([dataToSend])
      .select('*, cliente:clientes(nombre), tipo_lavado:tipos_lavado(nombre), lavador:lavadores(nombre), metodo_pago:metodos_pago(nombre)')
      .single()

    if (!error && data) {
      addLavadaLocal(data)
      setShowModal(false)
      setClienteSearch('')
      setFormData({
        cliente_id: '',
        placa: '',
        tipo_lavado_id: '',
        lavador_id: '',
        metodo_pago_id: '',
        valor: 0,
        adicionales: [],
        pagos: [],
        estado: 'EN ESPERA',
        notas: ''
      })
    }
  }


  const aplicarFiltroRapido = (tipo) => {
    setFiltroRapido(tipo)
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    if ((tipo === 'año' || tipo === 'todas') && !lavadasAllLoaded) {
      loadAllLavadas()
    }

    switch (tipo) {
      case 'hoy':
        setFechaDesde(new Date(hoy))
        setFechaHasta(new Date(hoy))
        break
      case 'semana':
        const inicioSemana = new Date(hoy)
        const dia = hoy.getDay()
        inicioSemana.setDate(hoy.getDate() - (dia === 0 ? 6 : dia - 1))
        setFechaDesde(inicioSemana)
        setFechaHasta(hoy)
        break
      case 'mes':
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
        setFechaDesde(inicioMes)
        setFechaHasta(hoy)
        break
      case 'año':
        const inicioAño = new Date(hoy.getFullYear(), 0, 1)
        setFechaDesde(inicioAño)
        setFechaHasta(hoy)
        break
      case 'todas':
        setFechaDesde(null)
        setFechaHasta(null)
        break
      default:
        break
    }
  }


  const toggleSelectLavada = (id) => {
    setSelectedLavadas(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedLavadas.size === lavadasFiltradas.length) {
      setSelectedLavadas(new Set())
    } else {
      setSelectedLavadas(new Set(lavadasFiltradas.map(l => l.id)))
    }
  }

  const handleBulkDelete = async () => {
    setDeleting(true)

    const ids = [...selectedLavadas]
    let eliminados = 0

    for (const id of ids) {
      const lavada = lavadas.find(l => l.id === id)
      const { error } = await supabase.from('lavadas').delete().eq('id', id)
      if (!error) {
        deleteLavadaLocal(id)
        eliminados++
      }
    }

    setDeleting(false)
    setShowDeleteModal(false)
    setSelectedLavadas(new Set())
    setModoSeleccion(false)
    if (eliminados > 0) alert(`Se eliminaron ${eliminados} servicios`)
  }


  const descargarPlantilla = () => {
    const bom = '\uFEFF'
    const headers = 'placa,tipo_lavado,cera_y_restaurador,kit_completo,valor,fecha,metodo_pago'
    const tipos = tiposLavado.map(t => t.nombre)
    const metodos = metodosPago.map(m => m.nombre)
    const ejemplo = `ABC123,${tipos[0] || 'SIN MEMBRESIA'},TRUE,FALSE,25000,15-01-2026,${metodos[0] || 'EFECTIVO'}`
    const separador = '\n\n# INSTRUCCIONES (borra estas líneas antes de importar)'
    const instrucciones = [
      '# Columnas obligatorias: placa - tipo_lavado - fecha',
      '# Columnas opcionales: valor - cera_y_restaurador - kit_completo - metodo_pago',
      '# placa: debe existir un cliente registrado con esa placa',
      `# tipo_lavado: ${tipos.join(' | ') || '(ninguno configurado)'}`,
      '# cera_y_restaurador: TRUE o FALSE',
      '# kit_completo: TRUE o FALSE',
      '# valor: número sin puntos ni comas (ej: 25000)',
      '# fecha: formato DD-MM-AAAA o DD/MM/AAAA (ej: 15-01-2026)',
      `# metodo_pago: ${metodos.join(' | ') || '(ninguno configurado)'}`,
      '# Estado se asigna automáticamente como ENTREGADO'
    ]
    const csv = bom + [headers, ejemplo, separador, ...instrucciones].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plantilla_lavadas.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleFileUpload = (e) => {
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

      rows.forEach((row, idx) => {
        const fila = idx + 2

        // Normalizar nombres de columnas (case-insensitive)
        const normalizedRow = {}
        Object.keys(row).forEach(key => {
          normalizedRow[key.toLowerCase().trim().replace(/\s+/g, '_')] = row[key]
        })

        const placa = (normalizedRow.placa || '').toString().trim().toUpperCase()
        const tipoNombre = (normalizedRow.tipo_lavado || normalizedRow.tipo_de_lavado || '').toString().trim()
        const ceraRaw = (normalizedRow.cera_y_restaurador || '').toString().trim().toUpperCase()
        const kitRaw = (normalizedRow.kit_completo || '').toString().trim().toUpperCase()
        const valorRaw = (normalizedRow.valor || normalizedRow.valor_de_la_lavada || '').toString().trim()
        const fechaRaw = (normalizedRow.fecha || '').toString().trim()
        const metodoPagoNombre = (normalizedRow.metodo_pago || normalizedRow.metodo_de_pago || '').toString().trim()
        const estadoRaw = (normalizedRow.estado || '').toString().trim().toUpperCase()

        // Validaciones obligatorias
        const camposVacios = []
        if (!placa) camposVacios.push('placa')
        if (!tipoNombre) camposVacios.push('tipo_lavado')
        if (!fechaRaw) camposVacios.push('fecha')

        if (camposVacios.length > 0) {
          errors.push({
            fila,
            problema: `La columna "${camposVacios.join('", "')}" está vacía`,
            solucion: `Llena ${camposVacios.length > 1 ? 'las columnas' : 'la columna'} ${camposVacios.join(', ')} en la fila ${fila}`
          })
          return
        }

        // Buscar cliente por placa (si no existe, se creará automáticamente)
        const cliente = clientes.find(c => c.placa?.toUpperCase() === placa)
        if (!cliente) {
          errors.push({
            fila,
            problema: `Placa "${placa}" no tiene cliente registrado → se creará como "nn" con SIN MEMBRESIA`,
            solucion: 'Puedes editar el cliente después para agregar nombre y datos',
            tipo: 'warning'
          })
        }

        // Buscar tipo de lavado
        const tipo = tiposLavado.find(t => t.nombre.toLowerCase() === tipoNombre.toLowerCase())
        if (!tipo) {
          errors.push({
            fila,
            problema: `Tipo de lavado "${tipoNombre}" no existe`,
            solucion: `Usa uno de: ${tiposLavado.map(t => t.nombre).join(', ')}`
          })
          return
        }

        // Adicionales
        const adicionales = []
        if (ceraRaw === 'TRUE' || ceraRaw === 'SI' || ceraRaw === 'SÍ' || ceraRaw === '1') {
          const servCera = serviciosAdicionales.find(s => s.nombre.toLowerCase().includes('cera'))
          if (servCera) adicionales.push({ id: servCera.id, nombre: servCera.nombre, precio: Number(servCera.precio) })
        }
        if (kitRaw === 'TRUE' || kitRaw === 'SI' || kitRaw === 'SÍ' || kitRaw === '1') {
          const servKit = serviciosAdicionales.find(s => s.nombre.toLowerCase().includes('kit'))
          if (servKit) adicionales.push({ id: servKit.id, nombre: servKit.nombre, precio: Number(servKit.precio) })
        }

        // Valor (opcional, default 0)
        const valor = valorRaw ? Number(valorRaw.replace(/[^\d]/g, '')) : 0

        // Fecha — todas las fechas se guardan como medianoche hora Colombia (UTC-5)
        let fechaISO = null
        let yyyy, mm, dd

        // Si es un objeto Date (de cellDates: true en XLSX)
        const fechaObj = normalizedRow.fecha instanceof Date ? normalizedRow.fecha : (fechaRaw instanceof Date ? fechaRaw : null)
        if (fechaObj && !isNaN(fechaObj.getTime())) {
          yyyy = fechaObj.getUTCFullYear()
          mm = fechaObj.getUTCMonth() + 1
          dd = fechaObj.getUTCDate()
          fechaISO = `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}T05:00:00.000Z`
        }

        if (!fechaISO && typeof fechaRaw === 'string') {
          // DD-MM-YYYY o DD/MM/YYYY
          const matchDMY = fechaRaw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
          if (matchDMY) {
            dd = parseInt(matchDMY[1], 10)
            mm = parseInt(matchDMY[2], 10)
            yyyy = parseInt(matchDMY[3], 10)
            fechaISO = `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}T05:00:00.000Z`
          }
        }

        if (!fechaISO && typeof fechaRaw === 'string') {
          // YYYY-MM-DD
          const matchISO2 = fechaRaw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
          if (matchISO2) {
            fechaISO = `${matchISO2[1]}-${matchISO2[2]}-${matchISO2[3]}T05:00:00.000Z`
          }
        }

        if (!fechaISO) {
          errors.push({
            fila,
            problema: `Fecha "${fechaRaw}" no tiene formato válido`,
            solucion: 'Usa el formato DD-MM-AAAA o DD/MM/AAAA (ej: 15-01-2026)'
          })
          return
        }

        // Método de pago
        let metodoPagoId = null
        let metodoPagoNombreFinal = ''
        if (metodoPagoNombre) {
          const metodo = metodosPago.find(m => m.nombre.toLowerCase() === metodoPagoNombre.toLowerCase())
          if (metodo) {
            metodoPagoId = metodo.id
            metodoPagoNombreFinal = metodo.nombre
          } else {
            errors.push({
              fila,
              problema: `Método de pago "${metodoPagoNombre}" no existe → se importará sin método de pago`,
              solucion: `Usa uno de: ${metodosPago.map(m => m.nombre).join(', ')}`,
              tipo: 'warning'
            })
          }
        }

        // Estado
        const estadosValidos = ['EN ESPERA', 'EN LAVADO', 'TERMINADO', 'ENTREGADO']
        let estado = 'ENTREGADO'
        if (estadoRaw && estadosValidos.includes(estadoRaw)) {
          estado = estadoRaw
        }

        nuevos.push({
          cliente_id: cliente?.id || null,
          cliente_nombre: cliente?.nombre || 'nn',
          placa,
          tipo_lavado_id: tipo.id,
          tipo_lavado_nombre: tipo.nombre,
          adicionales,
          valor,
          fecha: fechaISO,
          metodo_pago_id: metodoPagoId,
          metodo_pago_nombre: metodoPagoNombreFinal,
          estado
        })
      })

      setImportData(rows)
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
    let clientesCreados = 0
    let errores = 0
    const failedRows = []
    const total = importNuevos.length
    let procesados = 0

    const sinMembresia = tiposMembresia.find(m => m.nombre.toLowerCase().includes('sin '))
    const hoy = new Date()
    const fechaHoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
    // Cache de clientes creados durante la importación (placa → id)
    const clientesNuevosCache = {}

    for (const row of importNuevos) {
      let clienteId = row.cliente_id

      // Si no tiene cliente, crearlo automáticamente
      if (!clienteId) {
        // Verificar si ya lo creamos en esta misma importación
        if (clientesNuevosCache[row.placa]) {
          clienteId = clientesNuevosCache[row.placa]
        } else {
          const { data: nuevoCliente, error: errCliente } = await supabase
            .from('clientes')
            .insert([{
              nombre: 'nn',
              placa: row.placa,
              telefono: null,
              membresia_id: sinMembresia?.id || null,
              fecha_inicio_membresia: fechaHoyStr,
              fecha_fin_membresia: fechaHoyStr,
              estado: 'Activo',
              negocio_id: negocioId
            }])
            .select('id')
            .single()

          if (errCliente) {
            errores++
            failedRows.push({ placa: row.placa, nombre: row.cliente_nombre, error: `No se pudo crear cliente: ${errCliente.message}` })
            procesados++
            setImportProgress(Math.round((procesados / total) * 100))
            continue
          }
          clienteId = nuevoCliente.id
          clientesNuevosCache[row.placa] = clienteId
          clientesCreados++
        }
      }

      const pagos = row.metodo_pago_id
        ? [{ metodo_pago_id: row.metodo_pago_id, nombre: row.metodo_pago_nombre, valor: row.valor }]
        : []

      const { error } = await supabase
        .from('lavadas')
        .insert([{
          cliente_id: clienteId,
          placa: row.placa,
          tipo_lavado_id: row.tipo_lavado_id,
          lavador_id: null,
          valor: row.valor,
          adicionales: row.adicionales,
          pagos,
          metodo_pago_id: row.metodo_pago_id,
          estado: row.estado,
          fecha: row.fecha,
          negocio_id: negocioId
        }])

      if (error) {
        errores++
        failedRows.push({ placa: row.placa, nombre: row.cliente_nombre, error: error.message })
      } else {
        insertados++
      }
      procesados++
      setImportProgress(Math.round((procesados / total) * 100))
    }

    if (clientesCreados > 0) await refreshClientes()
    await refreshLavadas()
    setImportResult({ insertados, clientesCreados, errores, failedRows })
    setImportStep('done')
  }

  const resetImport = () => {
    setShowImportModal(false)
    setImportData([])
    setImportErrors([])
    setImportNuevos([])
    setImportStep('upload')
    setImportProgress(0)
    setImportResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const lavadasFiltradas = lavadas.filter(l => {
    const matchPlaca = l.placa.toLowerCase().includes(searchPlaca.toLowerCase())
    const matchEstado = !filtroEstado || l.estado === filtroEstado
    const matchLavador = !filtroLavador || l.lavador_id == filtroLavador

    const fechaLavada = new Date(l.fecha)
    fechaLavada.setHours(0, 0, 0, 0)

    let matchFechaDesde = true
    if (fechaDesde) {
      const desde = new Date(fechaDesde)
      desde.setHours(0, 0, 0, 0)
      matchFechaDesde = fechaLavada >= desde
    }

    let matchFechaHasta = true
    if (fechaHasta) {
      const hasta = new Date(fechaHasta)
      hasta.setHours(23, 59, 59, 999)
      matchFechaHasta = fechaLavada <= hasta
    }

    return matchPlaca && matchEstado && matchLavador && matchFechaDesde && matchFechaHasta
  })

  const totalFiltrado = lavadasFiltradas.reduce((sum, l) => sum + Number(l.valor || 0), 0)
  const cantidadFiltrada = lavadasFiltradas.length

  const handleRefresh = async () => {
    setRefreshing(true)
    await refreshLavadas()
    setRefreshing(false)
  }

  if (loading) {
    return <div className="loading">Cargando...</div>
  }

  return (
    <div className="lavadas-page">
      <div className="page-header">
        <h1 className="page-title">Servicios <span className="total-hoy">({cantidadFiltrada} - {formatMoney(totalFiltrado)})</span></h1>
        <div className="page-header-actions">
          <button
            className="btn-secondary btn-icon-only"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Actualizar datos"
          >
            <RefreshCw size={18} className={refreshing ? 'spin' : ''} />
          </button>
          <button
            className={`btn-secondary ${modoSeleccion ? 'btn-seleccion-activo' : ''}`}
            onClick={() => { setModoSeleccion(prev => !prev); setSelectedLavadas(new Set()) }}
          >
            <CheckSquare size={18} />
            <span className="btn-label">{modoSeleccion ? 'Cancelar' : 'Seleccionar'}</span>
          </button>
          <button className="btn-secondary" onClick={() => setShowImportModal(true)}>
            <Upload size={18} />
            <span className="btn-label">Importar</span>
          </button>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={20} />
            <span className="btn-label">Nuevo Servicio</span>
          </button>
        </div>
      </div>

      <div className="filters">
        <div className="filters-row-main">
          <div className="search-box">
            <Search size={18} />
            <input
              type="text"
              placeholder="Buscar placa..."
              value={searchPlaca}
              onChange={(e) => setSearchPlaca(e.target.value)}
            />
          </div>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="filter-select"
          >
            <option value="">Estado</option>
            <option value="EN ESPERA">En Espera</option>
            <option value="EN LAVADO">En Lavado</option>
            <option value="TERMINADO">Terminado</option>
            <option value="ENTREGADO">Entregado</option>
          </select>
          <Select
            value={filtroLavador ? { value: filtroLavador, label: lavadores.find(l => l.id == filtroLavador)?.nombre || '' } : null}
            onChange={(opt) => setFiltroLavador(opt ? opt.value : '')}
            options={lavadores.map(l => ({ value: l.id, label: l.nombre, activo: l.activo }))}
            isClearable
            placeholder="Lavador"
            formatOptionLabel={(opt) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: opt.activo !== false ? '#62B6CB' : '#666', flexShrink: 0 }} />
                {opt.label}
              </div>
            )}
            styles={{
              control: (base) => ({ ...base, background: 'var(--bg-card)', borderColor: 'var(--border-color)', minHeight: 36, minWidth: 140, fontSize: '0.85rem', boxShadow: 'none', '&:hover': { borderColor: 'var(--accent-green)' } }),
              menu: (base) => ({ ...base, background: 'var(--bg-card)', border: '1px solid var(--border-color)', zIndex: 10 }),
              option: (base, state) => ({ ...base, background: state.isFocused ? 'var(--bg-hover)' : 'transparent', color: 'var(--text-primary)', fontSize: '0.85rem' }),
              singleValue: (base) => ({ ...base, color: 'var(--text-primary)' }),
              placeholder: (base) => ({ ...base, color: 'var(--text-secondary)' }),
              input: (base) => ({ ...base, color: 'var(--text-primary)' }),
              indicatorSeparator: () => ({ display: 'none' }),
              dropdownIndicator: (base) => ({ ...base, padding: '4px', color: 'var(--text-secondary)' }),
              clearIndicator: (base) => ({ ...base, padding: '4px', color: 'var(--text-secondary)' }),
            }}
          />
          <button
            className={`filter-toggle-btn ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(prev => !prev)}
            title="Más filtros"
          >
            <SlidersHorizontal size={18} />
          </button>
          {(searchPlaca || filtroEstado || filtroLavador || fechaDesde || fechaHasta || filtroRapido !== 'todas') && (
            <button
              className="filter-clear-btn"
              onClick={() => {
                setSearchPlaca('')
                setFiltroEstado('')
                setFiltroLavador('')
                setFechaDesde(null)
                setFechaHasta(null)
                setFiltroRapido('todas')
              }}
              title="Limpiar filtros"
            >
              <X size={16} />
            </button>
          )}
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

      <div className="lavadas-cards">
        {modoSeleccion && lavadasFiltradas.length > 0 && (
          <div className="bulk-select-all" onClick={toggleSelectAll}>
            <span className="custom-check">
              <input
                type="checkbox"
                checked={lavadasFiltradas.length > 0 && selectedLavadas.size === lavadasFiltradas.length}
                readOnly
              />
              <span className="checkmark"></span>
            </span>
            <span>Seleccionar todos ({lavadasFiltradas.length})</span>
          </div>
        )}
        {lavadasFiltradas.length === 0 && (
          <div className="empty-card">No hay servicios registrados</div>
        )}
        {lavadasFiltradas.map((lavada) => (
          <ServiceCard
            key={lavada.id}
            lavada={lavada}
            onEstadoChange={handleEstadoChange}
            onTipoLavadoChange={handleTipoLavadoChangeInline}
            onAdicionalChange={handleAdicionalChange}
            onLavadorChange={handleLavadorChange}
            onPagosChange={handlePagosChange}
            onEliminar={handleEliminarLavada}
            onWhatsApp={enviarWhatsApp}
            isExpanded={expandedCards[lavada.id]}
            isCollapsing={collapsingCards[lavada.id]}
            isUpdating={updatingCards.has(lavada.id)}
            editingPago={editingPago}
            validationErrors={validationErrors[lavada.id]}
            onToggleExpand={() => setExpandedCards(prev => ({ ...prev, [lavada.id]: !prev[lavada.id] }))}
            onSetEditingPago={setEditingPago}
            onSetValidationErrors={(errs) => errs ? setValidationErrors(prev => ({ ...prev, [lavada.id]: errs })) : setValidationErrors(prev => { const n = { ...prev }; delete n[lavada.id]; return n })}
            onSmoothCollapse={smoothCollapse}
            tiposLavado={tiposLavado}
            serviciosAdicionales={serviciosAdicionales}
            lavadores={lavadores}
            metodosPago={metodosPago}
            getTimerProps={getTimerProps}
            hasActiveTimer={hasActiveTimer}
            getEstadoClass={getEstadoClass}
            selectionMode={modoSeleccion}
            isSelected={selectedLavadas.has(lavada.id)}
            onToggleSelect={toggleSelectLavada}
          />
        ))}
      </div>

      {modoSeleccion && selectedLavadas.size > 0 && (
        <div className="bulk-action-bar">
          <span>{selectedLavadas.size} seleccionado{selectedLavadas.size > 1 ? 's' : ''}</span>
          <div className="bulk-action-buttons">
            <button className="btn-secondary" onClick={toggleSelectAll}>
              {selectedLavadas.size === lavadasFiltradas.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
            </button>
            <button className="btn-secondary" onClick={() => { setSelectedLavadas(new Set()); setModoSeleccion(false) }}>
              <X size={16} /> Cancelar
            </button>
            <button className="btn-danger" onClick={() => setShowDeleteModal(true)}>
              <Trash2 size={16} /> Eliminar
            </button>
          </div>
        </div>
      )}

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
                Vas a eliminar <strong style={{ color: 'var(--accent-red, #ff4d4d)' }}>{selectedLavadas.size}</strong> servicio{selectedLavadas.size > 1 ? 's' : ''}. Esta acción no se puede deshacer.
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

      {showImportModal && (
        <div className="modal-overlay">
          <div className="modal import-modal">
            <div className="modal-header">
              <h2>Importar Servicios</h2>
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
                        handleFileUpload({ target: { files: [file] } })
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
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                    />
                  </div>
                  <div className="import-instructions">
                    <p>Columnas obligatorias: <strong>placa</strong>, <strong>tipo_lavado</strong>, <strong>fecha</strong></p>
                    <p>Opcionales: valor, cera_y_restaurador, kit_completo, metodo_pago</p>
                  </div>
                </>
              )}

              {importStep === 'preview' && (
                <>
                  <div className="import-summary">
                    <div className="import-stat stat-green">
                      <span className="import-stat-value">{importNuevos.length}</span>
                      <span className="import-stat-label">Servicios válidos</span>
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
                          <div className="import-error-solucion">Solución: {err.solucion}</div>
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
                          <div className="import-error-solucion">Tip: {err.solucion}</div>
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
                              <th>Placa</th>
                              <th>Cliente</th>
                              <th>Tipo</th>
                              <th>Valor</th>
                              <th>Fecha</th>
                              <th>Pago</th>
                            </tr>
                          </thead>
                          <tbody>
                            {importNuevos.slice(0, 10).map((row, i) => (
                              <tr key={i}>
                                <td>{row.placa}</td>
                                <td>{row.cliente_nombre}</td>
                                <td>{row.tipo_lavado_nombre}</td>
                                <td>{formatMoney(row.valor)}</td>
                                <td>{new Date(row.fecha).toLocaleDateString('es-CO')}</td>
                                <td>{row.metodo_pago_nombre || '—'}</td>
                              </tr>
                            ))}
                            {importNuevos.length > 10 && (
                              <tr><td colSpan="6" className="import-more">... y {importNuevos.length - 10} más</td></tr>
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
                      Importar {importNuevos.length} servicios
                    </button>
                  </div>
                </>
              )}

              {importStep === 'importing' && (
                <div className="import-progress-container">
                  <p>Importando servicios...</p>
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
                    {importResult.clientesCreados > 0 && (
                      <div className="import-stat stat-yellow">
                        <span className="import-stat-value">{importResult.clientesCreados}</span>
                        <span className="import-stat-label">Clientes creados</span>
                      </div>
                    )}
                    <div className="import-stat stat-red">
                      <span className="import-stat-value">{importResult.errores}</span>
                      <span className="import-stat-label">Errores</span>
                    </div>
                  </div>
                  {importResult.failedRows?.length > 0 && (
                    <div className="import-errors">
                      <h4>Servicios que no se pudieron importar</h4>
                      {importResult.failedRows.map((f, i) => (
                        <div key={i} className="import-error-item">
                          <div className="import-error-fila">{f.nombre} ({f.placa})</div>
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

      {/* FAB for mobile */}
      <button
        className="fab-nuevo-servicio"
        onClick={() => setShowModal(true)}
        title="Nuevo Servicio"
      >
        <Plus size={24} />
      </button>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Nuevo Servicio</h2>
              <button className="btn-close" onClick={() => setShowModal(false)}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group cliente-search-group">
                  <label>Cliente</label>
                  <div className="cliente-search-wrapper">
                    <input
                      type="text"
                      value={clienteSearch}
                      onChange={(e) => {
                        setClienteSearch(e.target.value)
                        setShowClienteDropdown(true)
                        if (!e.target.value) {
                          setFormData(prev => ({ ...prev, cliente_id: '', placa: '', tipo_lavado_id: '', valor: 0 }))
                        }
                      }}
                      onFocus={() => setShowClienteDropdown(true)}
                      placeholder="Buscar por nombre o placa..."
                      required={!formData.cliente_id}
                      autoComplete="off"
                    />
                    {formData.cliente_id && (
                      <button
                        type="button"
                        className="cliente-search-clear"
                        onClick={() => {
                          setClienteSearch('')
                          setShowClienteDropdown(false)
                          setFormData(prev => ({ ...prev, cliente_id: '', placa: '', tipo_lavado_id: '', valor: 0, adicionales: [] }))
                        }}
                      >
                        <X size={14} />
                      </button>
                    )}
                    {showClienteDropdown && !formData.cliente_id && (
                      <div className="cliente-search-dropdown">
                        {clientes
                          .filter(c => {
                            const q = clienteSearch.toLowerCase()
                            return !q || c.nombre?.toLowerCase().includes(q) || c.placa?.toLowerCase().includes(q)
                          })
                          .slice(0, 8)
                          .map(c => (
                            <div
                              key={c.id}
                              className="cliente-search-option"
                              onMouseDown={() => handleClienteChange(c.id)}
                            >
                              <span className="cliente-search-nombre">{c.nombre}</span>
                              <span className="cliente-search-placa">{c.placa}</span>
                              {!clienteTieneMembresia(c) && <span className="cliente-search-tag">Sin membresía</span>}
                            </div>
                          ))}
                        {clientes.filter(c => {
                          const q = clienteSearch.toLowerCase()
                          return !q || c.nombre?.toLowerCase().includes(q) || c.placa?.toLowerCase().includes(q)
                        }).length === 0 && (
                            <div className="cliente-search-empty">
                              No se encontraron clientes
                              <button
                                type="button"
                                className="btn-nuevo-cliente-inline"
                                onMouseDown={() => {
                                  setShowNuevoCliente(true)
                                  setShowClienteDropdown(false)
                                  setNuevoClienteData({ nombre: clienteSearch, placa: '', telefono: '' })
                                }}
                              >
                                <Plus size={14} /> Agregar cliente
                              </button>
                            </div>
                          )}
                      </div>
                    )}
                    {showNuevoCliente && (
                      <div className="nuevo-cliente-inline">
                        <div className="nuevo-cliente-inline-header">
                          <span>Nuevo cliente</span>
                          <button type="button" onClick={() => setShowNuevoCliente(false)}><X size={14} /></button>
                        </div>
                        <input
                          type="text"
                          placeholder="Nombre"
                          value={nuevoClienteData.nombre}
                          onChange={(e) => setNuevoClienteData(prev => ({ ...prev, nombre: e.target.value }))}
                          autoFocus
                        />
                        <input
                          type="text"
                          placeholder="Placa"
                          value={nuevoClienteData.placa}
                          onChange={(e) => setNuevoClienteData(prev => ({ ...prev, placa: e.target.value }))}
                        />
                        <input
                          type="text"
                          placeholder="Teléfono (opcional)"
                          value={nuevoClienteData.telefono}
                          onChange={(e) => setNuevoClienteData(prev => ({ ...prev, telefono: e.target.value }))}
                        />
                        <button
                          type="button"
                          className="btn-primary btn-crear-cliente"
                          onClick={handleCrearCliente}
                          disabled={creandoCliente || !nuevoClienteData.nombre || !nuevoClienteData.placa}
                        >
                          {creandoCliente ? 'Creando...' : 'Crear y seleccionar'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label>Tipo de Lavado</label>
                  <select
                    value={formData.tipo_lavado_id}
                    onChange={(e) => handleTipoLavadoChange(e.target.value)}
                  >
                    <option value="">Seleccionar tipo</option>
                    {tiposLavado.map(t => (
                      <option key={t.id} value={t.id}>{t.nombre} - {formatMoney(t.precio)}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Lavador</label>
                  <select
                    value={formData.lavador_id}
                    onChange={(e) => setFormData({ ...formData, lavador_id: e.target.value })}
                  >
                    <option value="">Seleccionar lavador</option>
                    {lavadores.map(l => (
                      <option key={l.id} value={l.id}>{l.nombre}</option>
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
                  />
                </div>

                {serviciosAdicionales.map(s => (
                  <div key={s.id} className="form-group checkbox-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={formData.adicionales.some(a => a.id === s.id)}
                        onChange={(e) => handleFormAdicionalChange(s, e.target.checked)}
                      />
                      {s.nombre} (+{formatMoney(s.precio)})
                    </label>
                  </div>
                ))}
              </div>

              <div className="form-group">
                <label>Notas</label>
                <textarea
                  value={formData.notas}
                  onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                  rows="3"
                ></textarea>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Guardar Servicio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
