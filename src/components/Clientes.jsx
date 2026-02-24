import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useData } from './DataContext'
import { useTenant } from './TenantContext'
import { useToast } from './Toast'
import { formatMoney } from '../utils/money'
import { LAVADAS_SELECT } from '../config/constants'
import { Plus, Search, X, Edit, Trash2, ChevronDown, SlidersHorizontal, Upload, Download, CheckSquare, Sparkles, Droplets, DollarSign, MessageCircle } from 'lucide-react'
import UpgradeModal from './UpgradeModal'
import ConfirmDeleteModal from './common/ConfirmDeleteModal'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { registerLocale } from 'react-datepicker'
import es from 'date-fns/locale/es'
import * as XLSX from 'xlsx'

registerLocale('es', es)

export default function Clientes() {
  const { clientes, tiposMembresia, tiposLavado, loading, addClienteLocal, updateClienteLocal, deleteClienteLocal, refreshClientes, refreshLavadas, negocioId, plantillasMensaje } = useData()
  const { userEmail, negocioNombre } = useTenant()
  const toast = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  const [highlightId, setHighlightId] = useState(null)

  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [search, setSearch] = useState('')
  const [filtroTipoCliente, setFiltroTipoCliente] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [fechaDesde, setFechaDesde] = useState(null)
  const [fechaHasta, setFechaHasta] = useState(null)
  const [filtroRapido, setFiltroRapido] = useState('')
  const [expandedCard, setExpandedCard] = useState(null)
  const [selectedClientes, setSelectedClientes] = useState(new Set())
  const [modoSeleccion, setModoSeleccion] = useState(false)
  const [filtroNuevos, setFiltroNuevos] = useState(false)
  const [sortBy, setSortBy] = useState('')
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const [showFabMenu, setShowFabMenu] = useState(false)
  const [clienteHistorial, setClienteHistorial] = useState({})
  const [whatsappMenu, setWhatsappMenu] = useState(null)
  const [waMenuPos, setWaMenuPos] = useState({ top: 0, right: 0 })
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [pendingDeleteClienteId, setPendingDeleteClienteId] = useState(null)
  const [pendingBulkDeleteClientes, setPendingBulkDeleteClientes] = useState(false)

  // Receive highlightId from navigation
  useEffect(() => {
    if (location.state?.highlightId) {
      setSearch('')
      setFiltroTipoCliente('')
      setFiltroEstado('')
      setFechaDesde(null)
      setFechaHasta(null)
      setFiltroRapido('')
      setFiltroNuevos(false)
      setHighlightId(location.state.highlightId)
      setExpandedCard(location.state.highlightId)
      const target = clientes.find(c => c.id === location.state.highlightId)
      if (target) fetchHistorial(target)
      window.history.replaceState({}, '')
    }
  }, [location.state])

  // Scroll to highlighted client
  useEffect(() => {
    if (!highlightId) return
    const raf = requestAnimationFrame(() => {
      document.querySelector(`[data-id="${highlightId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    const timer = setTimeout(() => setHighlightId(null), 1200)
    return () => { cancelAnimationFrame(raf); clearTimeout(timer) }
  }, [highlightId])

  // Import CSV states
  const [showImportModal, setShowImportModal] = useState(false)
  const [importData, setImportData] = useState([])
  const [importErrors, setImportErrors] = useState([])
  const [importDuplicados, setImportDuplicados] = useState([])
  const [importNuevos, setImportNuevos] = useState([])
  const [importStep, setImportStep] = useState('upload')
  const [dupAction, setDupAction] = useState('skip')
  const [importProgress, setImportProgress] = useState(0)
  const [importResult, setImportResult] = useState(null)
  const fileInputRef = useRef(null)

  const [formData, setFormData] = useState({
    nombre: '',
    cedula: '',
    telefono: '',
    correo: '',
    placa: '',
    moto: '',
    membresia_id: '',
    fecha_inicio_membresia: null,
    fecha_fin_membresia: null
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
    const nombreMem1 = (membresia?.nombre || '').toLowerCase().trim()
    const esDefault1 = !membresiaId || nombreMem1 === 'cliente' || nombreMem1 === 'cliente frecuente' || nombreMem1.includes('sin ')

    if (esDefault1) {
      setFormData(prev => ({
        ...prev,
        membresia_id: membresiaId,
        fecha_inicio_membresia: hoy,
        fecha_fin_membresia: hoy
      }))
    } else {
      const meses = membresia?.duracion_dias || 1
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
    e?.preventDefault()

    let formToSend = { ...formData }
    if (!formToSend.membresia_id) {
      const sinMembresia = tiposMembresia.find(m => m.nombre.toLowerCase().trim() === 'cliente')
        || tiposMembresia.find(m => m.nombre.toLowerCase().includes('sin '))
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
        .insert([{ ...cleanData, negocio_id: negocioId }])
        .select('*, membresia:tipos_membresia(nombre)')
        .single()

      if (error?.message?.includes('PLAN_LIMIT_REACHED')) {
        setShowUpgradeModal(true)
        return
      }
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
      fecha_fin_membresia: null
    })
  }

  const parseFecha = (str) => {
    if (!str) return null
    const dateOnly = typeof str === 'string' ? str.split('T')[0] : null
    if (!dateOnly) return null
    const d = new Date(dateOnly + 'T00:00:00')
    return isNaN(d.getTime()) ? null : d
  }

  const formatFecha = (str) => {
    if (!str) return '—'
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
    const dateOnly = typeof str === 'string' ? str.split('T')[0] : null
    if (!dateOnly) return '—'
    const d = new Date(dateOnly + 'T00:00:00')
    if (isNaN(d.getTime())) return '—'
    return `${d.getDate()} ${meses[d.getMonth()]} ${d.getFullYear()}`
  }

  const fetchHistorial = async (cliente) => {
    if (clienteHistorial[cliente.id] && !clienteHistorial[cliente.id].loading) return
    setClienteHistorial(prev => ({ ...prev, [cliente.id]: { lavadas: [], transacciones: [], mensajes: [], loading: true } }))

    const [lavRes, txRes, msgRes] = await Promise.all([
      supabase.from('lavadas').select(LAVADAS_SELECT)
        .eq('cliente_id', cliente.id)
        .order('fecha', { ascending: false }).limit(20),
      supabase.from('transacciones').select('*, metodo_pago:metodos_pago(nombre)')
        .ilike('placa_o_persona', `%${cliente.placa}%`)
        .order('fecha', { ascending: false }).limit(20),
      supabase.from('mensajes_enviados').select('*')
        .eq('cliente_id', cliente.id)
        .order('created_at', { ascending: false }).limit(20)
    ])

    setClienteHistorial(prev => ({
      ...prev,
      [cliente.id]: { lavadas: lavRes.data || [], transacciones: txRes.data || [], mensajes: msgRes.data || [], loading: false }
    }))
  }

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
      fecha_fin_membresia: parseFecha(cliente.fecha_fin_membresia)
    })
    setShowModal(true)
  }

  const requestDeleteCliente = (id) => {
    setPendingDeleteClienteId(id)
  }

  const executeDeleteCliente = async () => {
    const id = pendingDeleteClienteId
    if (!id) return
    const { error } = await supabase.from('clientes').delete().eq('id', id)
    if (error) {
      toast.error('No se pudo eliminar: ' + (error.message.includes('foreign key') ? 'El cliente tiene servicios asociados. Elimina sus servicios primero.' : error.message))
    } else {
      deleteClienteLocal(id)
      setSelectedClientes(prev => { const next = new Set(prev); next.delete(id); return next })
      setClienteHistorial(prev => { const next = { ...prev }; delete next[id]; return next })
    }
    setPendingDeleteClienteId(null)
  }

  const toggleSelectCliente = (id) => {
    setSelectedClientes(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedClientes.size === clientesOrdenados.length) {
      setSelectedClientes(new Set())
    } else {
      setSelectedClientes(new Set(clientesOrdenados.map(c => c.id)))
    }
  }

  const requestBulkDeleteClientes = () => {
    if (!selectedClientes.size) return
    setPendingBulkDeleteClientes(true)
  }

  const executeBulkDeleteClientes = async () => {
    const ids = [...selectedClientes]
    let eliminados = 0
    let fallos = 0

    for (const id of ids) {
      const { error } = await supabase.from('clientes').delete().eq('id', id)
      if (!error) {
        deleteClienteLocal(id)
        eliminados++
      } else {
        fallos++
      }
    }

    setSelectedClientes(new Set())
    setModoSeleccion(false)
    setPendingBulkDeleteClientes(false)
    setClienteHistorial(prev => {
      const next = { ...prev }
      ids.forEach(id => delete next[id])
      return next
    })

    if (fallos > 0) {
      toast.error(`Se eliminaron ${eliminados} de ${ids.length} clientes. ${fallos} no se pudieron eliminar porque tienen servicios asociados.`)
    }
  }

  const descargarPlantilla = () => {
    const tipos = tiposMembresia.map(m => m.nombre)

    const headers = ['nombre','placa','telefono','cedula','correo','moto','tipo_membresia','fecha_inicio','fecha_vencimiento','valor_lavada','fecha_lavada']
    const ejemplo = ['Juan Pérez','ABC123','3001234567','12345678','juan@email.com','Yamaha FZ 2.0', tipos[0] || 'MENSUAL','2026-02-10','2026-03-10', 15000, '2026-02-10']
    const wsClientes = XLSX.utils.aoa_to_sheet([headers, ejemplo])

    const instrucciones = [
      ['INSTRUCCIONES'],
      ['Columnas obligatorias: nombre - placa - telefono'],
      ['Columnas opcionales: cedula - correo - moto - tipo_membresia - fecha_inicio - fecha_vencimiento - valor_lavada - fecha_lavada'],
      ['Teléfono: solo números sin espacios ni guiones (ej: 3001234567)'],
      ['Placa: se convierte a mayúsculas automáticamente'],
      [`Tipos de membresía válidos: ${tipos.join(' | ') || '(ninguno configurado)'}`],
      ['Si tipo_membresia queda vacío o no coincide se asignará CLIENTE'],
      ['Fechas: formato AAAA-MM-DD (ej: 2026-02-10)'],
      ['- Si pones ambas fechas se usan tal cual'],
      ['- Si solo pones fecha_inicio se calcula fecha_vencimiento sumando la duración de la membresía'],
      ['- Si solo pones fecha_vencimiento se calcula fecha_inicio restando la duración de la membresía'],
      ['- Si no pones ninguna fecha el cliente quedará como vencido (vencimiento = hoy)'],
      [''],
      ['LAVADAS (opcional)'],
      ['valor_lavada: valor numérico de la lavada (puede ser 0). Obligatorio si pones fecha_lavada'],
      ['fecha_lavada: fecha de la lavada en formato AAAA-MM-DD. Obligatoria si pones valor_lavada'],
      ['Si ambos campos están vacíos no se crea lavada']
    ]
    const wsInstrucciones = XLSX.utils.aoa_to_sheet(instrucciones)

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, wsClientes, 'Clientes')
    XLSX.utils.book_append_sheet(wb, wsInstrucciones, 'Instrucciones')
    XLSX.writeFile(wb, 'plantilla_clientes.xlsx')
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
      const duplicados = []
      const nuevos = []

      const nombresMembresia = tiposMembresia.map(m => m.nombre).join(', ')

      const parsearFecha = (rawVal, fila, nombreCampo) => {
        if (!rawVal) return null
        // Date object from cellDates: true
        if (rawVal instanceof Date && !isNaN(rawVal.getTime())) {
          const y = rawVal.getUTCFullYear()
          const m = String(rawVal.getUTCMonth() + 1).padStart(2, '0')
          const dd = String(rawVal.getUTCDate()).padStart(2, '0')
          return `${y}-${m}-${dd}`
        }
        const fechaRaw = rawVal.toString().trim()
        // YYYY-MM-DD string
        const matchISO = fechaRaw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
        if (matchISO) {
          const d = new Date(fechaRaw + 'T00:00:00')
          if (!isNaN(d.getTime())) return fechaRaw
        }
        // DD/MM/YYYY string
        const matchDMY = fechaRaw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
        if (matchDMY) {
          const dd = matchDMY[1].padStart(2, '0')
          const mm = matchDMY[2].padStart(2, '0')
          const d = new Date(`${matchDMY[3]}-${mm}-${dd}T00:00:00`)
          if (!isNaN(d.getTime())) return `${matchDMY[3]}-${mm}-${dd}`
        }
        errors.push({
          fila,
          problema: `${nombreCampo} "${fechaRaw}" no tiene formato válido`,
          solucion: 'Usa el formato AAAA-MM-DD (ej: 2026-02-10)',
          tipo: 'warning'
        })
        return null
      }

      rows.forEach((row, idx) => {
        const fila = idx + 2
        const nombre = (row.nombre || '').toString().trim()
        const placa = (row.placa || '').toString().trim().toUpperCase()
        const telefono = (row.telefono || '').toString().trim()

        const camposVacios = []
        if (!nombre) camposVacios.push('nombre')
        if (!placa) camposVacios.push('placa')
        if (!telefono) camposVacios.push('telefono')

        if (camposVacios.length > 0) {
          errors.push({
            fila,
            problema: `La columna "${camposVacios.join('", "')}" está vacía`,
            solucion: `Abre el archivo y llena ${camposVacios.length > 1 ? 'las columnas' : 'la columna'} ${camposVacios.join(', ')} en la fila ${fila}`
          })
          return
        }

        const tipoNombre = (row.tipo_membresia || '').toString().trim()
        let membresiaId = null
        let membresiaWarning = null
        if (tipoNombre) {
          const match = tiposMembresia.find(m => m.nombre.toLowerCase() === tipoNombre.toLowerCase())
          if (match) {
            membresiaId = match.id
          } else {
            membresiaWarning = `"${tipoNombre}" no coincide con ninguna membresía`
          }
        }
        if (!membresiaId) {
          const defaultMem = tiposMembresia.find(m => m.nombre.toLowerCase().trim() === 'cliente')
            || tiposMembresia.find(m => m.nombre.toLowerCase().includes('sin '))
          membresiaId = defaultMem ? defaultMem.id : null
          if (!membresiaWarning && !tipoNombre) {
            membresiaWarning = 'No se indicó tipo de membresía'
          }
        }

        if (membresiaWarning) {
          errors.push({
            fila,
            problema: `${membresiaWarning} → se asignará "CLIENTE"`,
            solucion: `Usa uno de los nombres válidos: ${nombresMembresia}`,
            tipo: 'warning'
          })
        }

        const fechaInicio = parsearFecha(row.fecha_inicio, fila, 'fecha_inicio')
        const fechaVencimiento = parsearFecha(row.fecha_vencimiento, fila, 'fecha_vencimiento')

        // Lavada fields
        const rawValorLavada = row.valor_lavada
        const rawFechaLavada = row.fecha_lavada
        const tieneValorLavada = rawValorLavada !== '' && rawValorLavada !== null && rawValorLavada !== undefined
        const tieneFechaLavada = rawFechaLavada !== '' && rawFechaLavada !== null && rawFechaLavada !== undefined

        let lavadaValor = null
        let lavadaFecha = null

        if (tieneValorLavada || tieneFechaLavada) {
          if (!tieneValorLavada) {
            errors.push({ fila, problema: 'Falta valor_lavada (es obligatorio si pones fecha_lavada)', solucion: 'Agrega el valor de la lavada (puede ser 0)', tipo: 'warning' })
          } else if (!tieneFechaLavada) {
            errors.push({ fila, problema: 'Falta fecha_lavada (es obligatoria si pones valor_lavada)', solucion: 'Agrega la fecha de la lavada en formato AAAA-MM-DD', tipo: 'warning' })
          } else {
            const valorNum = Number(rawValorLavada)
            if (isNaN(valorNum) || valorNum < 0) {
              errors.push({ fila, problema: `valor_lavada "${rawValorLavada}" no es un número válido`, solucion: 'Usa un número positivo o 0', tipo: 'warning' })
            } else {
              const fechaLavadaParsed = parsearFecha(rawFechaLavada, fila, 'fecha_lavada')
              if (fechaLavadaParsed) {
                lavadaValor = valorNum
                lavadaFecha = `${fechaLavadaParsed}T05:00:00.000Z`
              }
            }
          }
        }

        const parsed = {
          nombre,
          placa,
          telefono,
          cedula: (row.cedula || '').toString().trim() || null,
          correo: (row.correo || '').toString().trim() || null,
          moto: (row.moto || '').toString().trim() || null,
          membresia_id: membresiaId,
          tipo_membresia_nombre: tipoNombre || 'CLIENTE',
          fecha_inicio: fechaInicio,
          fecha_vencimiento: fechaVencimiento,
          lavada_valor: lavadaValor,
          lavada_fecha: lavadaFecha
        }

        const existente = clientes.find(c => c.placa?.toUpperCase() === placa)
        if (existente) {
          duplicados.push({ ...parsed, clienteExistenteId: existente.id })
        } else if (nuevos.find(n => n.placa === placa)) {
          errors.push({
            fila,
            problema: `La placa "${placa}" está repetida dentro del archivo`,
            solucion: 'Elimina la fila duplicada del archivo, solo debe aparecer una vez cada placa'
          })
        } else {
          nuevos.push(parsed)
        }
      })

      setImportData(rows)
      setImportErrors(errors)
      setImportDuplicados(duplicados)
      setImportNuevos(nuevos)
      setImportStep('preview')
    }
    if (isCSV) {
      reader.readAsText(file, 'UTF-8')
    } else {
      reader.readAsArrayBuffer(file)
    }
  }

  const calcularFechasMembresia = (membresiaId, fechaInicioStr, fechaVencimientoStr) => {
    const membresia = tiposMembresia.find(m => m.id === membresiaId)
    const meses = membresia?.duracion_dias || 1
    const nombreMem2 = (membresia?.nombre || '').toLowerCase().trim()
    const esDefault2 = !membresiaId || nombreMem2 === 'cliente' || nombreMem2 === 'cliente frecuente' || nombreMem2.includes('sin ')

    if (esDefault2) {
      const inicio = fechaInicioStr ? new Date(fechaInicioStr + 'T00:00:00') : new Date()
      return { fecha_inicio_membresia: fechaLocalStr(inicio), fecha_fin_membresia: fechaLocalStr(inicio) }
    }

    if (fechaInicioStr && fechaVencimientoStr) {
      return { fecha_inicio_membresia: fechaInicioStr, fecha_fin_membresia: fechaVencimientoStr }
    }

    if (fechaInicioStr) {
      const inicio = new Date(fechaInicioStr + 'T00:00:00')
      const fin = new Date(inicio)
      fin.setMonth(fin.getMonth() + meses)
      return { fecha_inicio_membresia: fechaLocalStr(inicio), fecha_fin_membresia: fechaLocalStr(fin) }
    }

    if (fechaVencimientoStr) {
      const fin = new Date(fechaVencimientoStr + 'T00:00:00')
      const inicio = new Date(fin)
      inicio.setMonth(inicio.getMonth() - meses)
      return { fecha_inicio_membresia: fechaLocalStr(inicio), fecha_fin_membresia: fechaLocalStr(fin) }
    }

    // Ninguna fecha: cliente queda vencido
    const hoy = new Date()
    const inicio = new Date(hoy)
    inicio.setMonth(inicio.getMonth() - meses)
    return { fecha_inicio_membresia: fechaLocalStr(inicio), fecha_fin_membresia: fechaLocalStr(hoy) }
  }

  const ejecutarImportacion = async () => {
    setImportStep('importing')
    setImportProgress(0)

    let insertados = 0
    let actualizados = 0
    let lavadas = 0
    let errores = 0
    const failedRows = []
    const total = importNuevos.length + (dupAction === 'update' ? importDuplicados.length : 0)
    let procesados = 0

    // Helper: detect tipo_lavado_id based on membership
    const getTipoLavadoId = (membresiaId) => {
      const membresia = tiposMembresia.find(m => m.id === membresiaId)
      const nomMem = (membresia?.nombre || '').toLowerCase().trim()
      const esSinMembresia = !membresiaId || nomMem === 'cliente' || nomMem === 'cliente frecuente' || nomMem.includes('sin ')
      const tipoNombre = esSinMembresia ? 'sin membresía' : 'membresía'
      const tipo = tiposLavado.find(t => t.nombre.toLowerCase().includes(tipoNombre))
      return tipo?.id || tiposLavado[0]?.id || null
    }

    // Helper: insert lavada for a client row
    const insertarLavada = async (clienteId, row) => {
      if (row.lavada_valor == null || !row.lavada_fecha) return false
      const { error } = await supabase.from('lavadas').insert([{
        cliente_id: clienteId,
        placa: row.placa,
        tipo_lavado_id: getTipoLavadoId(row.membresia_id),
        valor: row.lavada_valor,
        fecha: row.lavada_fecha,
        estado: 'ENTREGADO',
        pagos: [],
        adicionales: [],
        negocio_id: negocioId
      }])
      return !error
    }

    // Insert new clients one by one to isolate failures
    for (const row of importNuevos) {
      const fechas = calcularFechasMembresia(row.membresia_id, row.fecha_inicio, row.fecha_vencimiento)
      const { data, error } = await supabase.from('clientes').insert([{
        nombre: row.nombre,
        placa: row.placa,
        telefono: row.telefono,
        cedula: row.cedula,
        correo: row.correo,
        moto: row.moto,
        membresia_id: row.membresia_id,
        estado: 'Activo',
        negocio_id: negocioId,
        ...fechas
      }]).select('id').single()
      if (error) {
        errores++
        failedRows.push({ placa: row.placa, nombre: row.nombre, error: error.message })
      } else {
        insertados++
        if (data?.id && await insertarLavada(data.id, row)) lavadas++
      }
      procesados++
      setImportProgress(Math.round((procesados / total) * 100))
    }

    // Update duplicates if selected
    if (dupAction === 'update' && importDuplicados.length > 0) {
      for (const dup of importDuplicados) {
        const fechas = calcularFechasMembresia(dup.membresia_id, dup.fecha_inicio, dup.fecha_vencimiento)
        const { error } = await supabase.from('clientes').update({
          nombre: dup.nombre,
          telefono: dup.telefono,
          cedula: dup.cedula,
          correo: dup.correo,
          moto: dup.moto,
          membresia_id: dup.membresia_id,
          estado: 'Activo',
          ...fechas
        }).eq('id', dup.clienteExistenteId)

        if (error) {
          errores++
          failedRows.push({ placa: dup.placa, nombre: dup.nombre, error: error.message })
        } else {
          actualizados++
          if (await insertarLavada(dup.clienteExistenteId, dup)) lavadas++
        }
        procesados++
        setImportProgress(Math.round((procesados / total) * 100))
      }
    }

    await refreshClientes()
    if (lavadas > 0) await refreshLavadas()
    setImportResult({ insertados, actualizados, lavadas, errores, failedRows })
    setImportStep('done')
  }

  const resetImport = () => {
    setShowImportModal(false)
    setImportData([])
    setImportErrors([])
    setImportDuplicados([])
    setImportNuevos([])
    setImportStep('upload')
    setDupAction('skip')
    setImportProgress(0)
    setImportResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
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

  const isClienteNuevo = (cliente) => {
    if (!cliente.created_at) return false
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const created = new Date(cliente.created_at)
    created.setHours(0, 0, 0, 0)
    return created.getTime() === hoy.getTime()
  }

  const getEstadoCliente = (cliente) => {
    if (!cliente.fecha_inicio_membresia || !cliente.fecha_fin_membresia) return 'Inactivo'
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const inicioStr = typeof cliente.fecha_inicio_membresia === 'string' ? cliente.fecha_inicio_membresia.split('T')[0] : null
    const finStr = typeof cliente.fecha_fin_membresia === 'string' ? cliente.fecha_fin_membresia.split('T')[0] : null
    if (!inicioStr || !finStr) return 'Inactivo'
    const inicio = new Date(inicioStr + 'T00:00:00')
    const fin = new Date(finStr + 'T00:00:00')
    if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) return 'Inactivo'
    return hoy >= inicio && hoy <= fin ? 'Activo' : 'Inactivo'
  }

  const getTipoClienteLabel = (cliente) => {
    const nombre = (cliente.membresia?.nombre || '').toLowerCase().trim()
    if (!nombre || nombre === 'cliente' || nombre === 'cliente frecuente' || nombre.includes('sin ')) {
      return { tiene: false, label: cliente.membresia?.nombre || 'Cliente' }
    }
    return { tiene: true, label: cliente.membresia?.nombre }
  }

  const toggleWhatsappMenu = (clienteId, e) => {
    if (e) {
      e.stopPropagation()
      const rect = e.currentTarget.getBoundingClientRect()
      setWaMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
    setWhatsappMenu(prev => prev === clienteId ? null : clienteId)
  }

  const resolverPlantillaCliente = (texto, cliente) => {
    const formatFechaVar = (str) => {
      if (!str) return '—'
      const dateOnly = typeof str === 'string' ? str.split('T')[0] : null
      if (!dateOnly) return '—'
      const d = new Date(dateOnly + 'T00:00:00')
      if (isNaN(d.getTime())) return '—'
      const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
      return `${d.getDate()} ${meses[d.getMonth()]} ${d.getFullYear()}`
    }
    const formatMoneyVar = (v) => {
      const num = Number(v) || 0
      return '$' + num.toLocaleString('es-CO')
    }
    const hist = clienteHistorial[cliente.id]
    const ultimaLavada = hist?.lavadas?.[0]
    const variables = {
      nombre: cliente.nombre || '',
      telefono: cliente.telefono || '',
      negocio: negocioNombre || '',
      membresia: getTipoClienteLabel(cliente).label,
      estado_membresia: getEstadoCliente(cliente),
      vencimiento: formatFechaVar(cliente.fecha_fin_membresia),
      placa: cliente.placa || '',
      ultimo_servicio: ultimaLavada?.tipo_lavado?.nombre || '',
      valor_ultimo: formatMoneyVar(ultimaLavada?.valor),
    }
    return texto.replace(/\{(\w+)\}/g, (match, key) => variables[key] ?? match)
  }

  const sendWhatsApp = (cliente, tipo, plantillaId) => {
    setWhatsappMenu(null)
    if (!cliente.telefono) {
      toast.info('Este cliente no tiene teléfono registrado')
      return
    }
    const telefono = cliente.telefono.replace(/\D/g, '')
    if (tipo === 'contacto') {
      window.open(`https://api.whatsapp.com/send?phone=57${telefono}`, '_blank')
      return
    }
    if (tipo === 'plantilla' && plantillaId) {
      const plantilla = (plantillasMensaje || []).find(p => p.id === plantillaId)
      if (!plantilla) {
        window.open(`https://api.whatsapp.com/send?phone=57${telefono}`, '_blank')
        return
      }
      const mensajeTexto = resolverPlantillaCliente(plantilla.texto, cliente)
      window.open(`https://api.whatsapp.com/send?phone=57${telefono}&text=${encodeURIComponent(mensajeTexto)}`, '_blank')
      // Fire-and-forget: registrar mensaje enviado
      supabase.from('mensajes_enviados').insert([{
        cliente_id: cliente.id,
        plantilla_id: plantilla.id,
        plantilla_nombre: plantilla.nombre,
        mensaje_texto: mensajeTexto,
        enviado_por: userEmail || null,
        origen: 'clientes',
        negocio_id: negocioId,
      }]).then(() => {})
      return
    }
    // Fallback: contacto directo
    window.open(`https://api.whatsapp.com/send?phone=57${telefono}`, '_blank')
  }

  const hasActiveFilters = !!(filtroTipoCliente || filtroEstado || fechaDesde || fechaHasta || filtroRapido || filtroNuevos || sortBy)
  const clearAllFilters = () => {
    setFiltroTipoCliente(''); setFiltroEstado(''); setFechaDesde(null); setFechaHasta(null)
    setFiltroRapido(''); setFiltroNuevos(false); setSortBy('')
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
      const vencStr = typeof c.fecha_fin_membresia === 'string' ? c.fecha_fin_membresia.split('T')[0] : null
      const venc = vencStr ? new Date(vencStr + 'T00:00:00') : null
      if (!venc || isNaN(venc.getTime())) {
        if (fechaDesde || fechaHasta) matchFechaDesde = false
      } else {
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
      }
    } else {
      if (fechaDesde || fechaHasta) {
        matchFechaDesde = false
      }
    }

    const matchNuevos = !filtroNuevos || isClienteNuevo(c)

    return matchSearch && matchTipo && matchEstado && matchFechaDesde && matchFechaHasta && matchNuevos
  })

  const clientesOrdenados = [...clientesFiltrados].sort((a, b) => {
    if (sortBy === 'nombre-asc') return (a.nombre || '').localeCompare(b.nombre || '')
    if (sortBy === 'nombre-desc') return (b.nombre || '').localeCompare(a.nombre || '')
    if (sortBy === 'placa-asc') return (a.placa || '').localeCompare(b.placa || '')
    if (sortBy === 'placa-desc') return (b.placa || '').localeCompare(a.placa || '')
    return 0
  })

  if (loading) {
    return <div className="loading">Cargando...</div>
  }

  return (
    <div className="clientes-page">
      <div className="clientes-title-row">
        <h1 className="page-title">Clientes <span className="total-hoy">({clientesOrdenados.length})</span></h1>
        <div className="clientes-desktop-actions">
          <button
            className={`btn-secondary ${modoSeleccion ? 'btn-seleccion-activo' : ''}`}
            onClick={() => { setModoSeleccion(prev => !prev); setSelectedClientes(new Set()) }}
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
            <span className="btn-label">Nuevo Cliente</span>
          </button>
        </div>
      </div>

      <div className="clientes-search-row">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Buscar nombre, placa, cédula..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch('')}>
              <X size={16} />
            </button>
          )}
        </div>
        <div className="clientes-filter-wrapper">
          <button
            className={`clientes-filter-btn ${hasActiveFilters ? 'active' : ''}`}
            onClick={() => setShowFilterDropdown(prev => !prev)}
          >
            <SlidersHorizontal size={18} />
          </button>
          {showFilterDropdown && (
            <>
              <div className="clientes-filter-overlay" onClick={() => setShowFilterDropdown(false)} />
              <div className="clientes-filter-dropdown">
                <div className="cfd-section">
                  <span className="cfd-label">Tipo</span>
                  <select
                    value={filtroTipoCliente}
                    onChange={(e) => setFiltroTipoCliente(e.target.value)}
                    className="cfd-select"
                  >
                    <option value="">Todos</option>
                    {tiposMembresia.map(m => (
                      <option key={m.id} value={m.id}>{m.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="cfd-section">
                  <span className="cfd-label">Estado</span>
                  <select
                    value={filtroEstado}
                    onChange={(e) => setFiltroEstado(e.target.value)}
                    className="cfd-select"
                  >
                    <option value="">Todos</option>
                    <option value="Activo">Activo</option>
                    <option value="Inactivo">Inactivo</option>
                  </select>
                </div>
                <div className="cfd-section">
                  <span className="cfd-label">Vencimiento</span>
                  <div className="cfd-rapido">
                    <button className={`filter-btn ${filtroRapido === 'hoy' ? 'active' : ''}`} onClick={() => aplicarFiltroRapido('hoy')}>Hoy</button>
                    <button className={`filter-btn ${filtroRapido === 'semana' ? 'active' : ''}`} onClick={() => aplicarFiltroRapido('semana')}>Semana</button>
                    <button className={`filter-btn ${filtroRapido === 'mes' ? 'active' : ''}`} onClick={() => aplicarFiltroRapido('mes')}>Mes</button>
                    <button className={`filter-btn ${filtroRapido === 'año' ? 'active' : ''}`} onClick={() => aplicarFiltroRapido('año')}>Año</button>
                    <button className={`filter-btn ${filtroRapido === 'todas' ? 'active' : ''}`} onClick={() => aplicarFiltroRapido('todas')}>Todas</button>
                  </div>
                  <div className="cfd-dates">
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
                <div className="cfd-section">
                  <span className="cfd-label">Ordenar</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="cfd-select"
                  >
                    <option value="">Sin orden</option>
                    <option value="nombre-asc">Nombre A → Z</option>
                    <option value="nombre-desc">Nombre Z → A</option>
                    <option value="placa-asc">Placa A → Z</option>
                    <option value="placa-desc">Placa Z → A</option>
                  </select>
                </div>
                <div className="cfd-section">
                  <button
                    className={`filter-btn cfd-nuevos-btn ${filtroNuevos ? 'active' : ''}`}
                    onClick={() => setFiltroNuevos(prev => !prev)}
                  >
                    <Sparkles size={14} /> Nuevos hoy
                  </button>
                </div>
                {hasActiveFilters && (
                  <button className="cfd-clear" onClick={() => { clearAllFilters(); setShowFilterDropdown(false) }}>
                    <X size={14} /> Limpiar filtros
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Desktop: tabla */}
      <div className="card clientes-tabla-desktop">
        <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              {modoSeleccion && (
                <th className="th-checkbox">
                  <label className="custom-check">
                    <input
                      type="checkbox"
                      checked={clientesOrdenados.length > 0 && selectedClientes.size === clientesOrdenados.length}
                      onChange={toggleSelectAll}
                    />
                    <span className="checkmark"></span>
                  </label>
                </th>
              )}
              <th>Nombre</th>
              <th>Placa</th>
              <th>Teléfono</th>
              <th>Tipo de Cliente</th>
              <th>Vencimiento</th>
              <th>WhatsApp</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clientesOrdenados.map((cliente) => (
              <tr key={cliente.id} data-id={cliente.id} className={`${selectedClientes.has(cliente.id) ? 'row-selected' : ''} ${highlightId === cliente.id ? 'card-highlight' : ''}`}>
                {modoSeleccion && (
                  <td className="td-checkbox">
                    <label className="custom-check">
                      <input
                        type="checkbox"
                        checked={selectedClientes.has(cliente.id)}
                        onChange={() => toggleSelectCliente(cliente.id)}
                      />
                      <span className="checkmark"></span>
                    </label>
                  </td>
                )}
                <td>
                  <div className="cliente-cell">
                    <span className="cliente-nombre">
                      {cliente.nombre}
                      {isClienteNuevo(cliente) && <span className="badge-nuevo">Nuevo</span>}
                    </span>
                    <span className="cliente-fecha">{cliente.moto}</span>
                  </div>
                </td>
                <td>{cliente.placa}</td>
                <td>{cliente.telefono}</td>
                <td>{cliente.membresia?.nombre || 'Sin tipo'}</td>
                <td>{formatFecha(cliente.fecha_fin_membresia)}</td>
                <td>
                  <div className="wa-menu-wrapper">
                    <button
                      className="btn-whatsapp"
                      onClick={(e) => toggleWhatsappMenu(cliente.id, e)}
                      title="Enviar WhatsApp"
                    >
                      <MessageCircle size={16} />
                    </button>
                    {whatsappMenu === cliente.id && (
                      <>
                        <div className="wa-menu-overlay" onClick={() => setWhatsappMenu(null)} />
                        <div className="wa-menu-dropdown" style={{ top: waMenuPos.top, right: waMenuPos.right }}>
                          {(plantillasMensaje || []).length > 0 ? (plantillasMensaje || []).map(p => (
                            <button key={p.id} onClick={() => sendWhatsApp(cliente, 'plantilla', p.id)}>
                              {p.nombre}
                            </button>
                          )) : (
                            <span style={{ padding: '8px 12px', color: '#999', fontSize: '0.85em', display: 'block' }}>No hay plantillas</span>
                          )}
                          <button onClick={() => sendWhatsApp(cliente, 'contacto')}>
                            Ir al contacto
                          </button>
                          <button onClick={() => { setWhatsappMenu(null); navigate('/cuenta?tab=config&subtab=mensajes') }}>
                            + Agregar plantilla
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </td>
                <td>
                  <div className="acciones">
                    <button className="btn-icon" onClick={() => handleEdit(cliente)}>
                      <Edit size={18} />
                    </button>
                    <button className="btn-icon delete" onClick={() => requestDeleteCliente(cliente.id)}>
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {clientesOrdenados.length === 0 && (
              <tr>
                <td colSpan={modoSeleccion ? 8 : 7} className="empty">No hay clientes registrados</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Mobile: cards */}
      <div className="clientes-cards-mobile">
        {clientesOrdenados.map(cliente => {
          const estado = getEstadoCliente(cliente)
          const isExpanded = expandedCard === cliente.id
          return (
            <div key={cliente.id} data-id={cliente.id} className={`cliente-card ${estado === 'Activo' ? 'estado-activo-border' : 'estado-vencido-border'} ${isExpanded ? 'expanded' : ''} ${selectedClientes.has(cliente.id) ? 'card-selected' : ''} ${highlightId === cliente.id ? 'card-highlight' : ''}`}>
              <div className="cliente-card-header" onClick={() => {
                const next = isExpanded ? null : cliente.id
                setExpandedCard(next)
                if (next) fetchHistorial(cliente)
              }}>
                <div className="cliente-card-left">
                  {modoSeleccion && (
                    <label className="custom-check" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedClientes.has(cliente.id)}
                        onChange={() => toggleSelectCliente(cliente.id)}
                      />
                      <span className="checkmark"></span>
                    </label>
                  )}
                  <span className="cliente-card-nombre">
                    {cliente.nombre}
                    {isClienteNuevo(cliente) && <span className="badge-nuevo">Nuevo</span>}
                  </span>
                  <span className="cliente-card-placa">{cliente.placa}</span>
                </div>
                <div className="cliente-card-right">
                  {(() => {
                    const { tiene, label } = getTipoClienteLabel(cliente)
                    return (
                      <span className={`tipo-cliente-text ${tiene ? 'con-membresia' : 'sin-membresia'}`}>
                        {tiene ? label : 'Sin membresía'}
                      </span>
                    )
                  })()}
                  <div className="wa-menu-wrapper">
                    <button
                      className="btn-whatsapp btn-whatsapp-mini"
                      onClick={(e) => toggleWhatsappMenu(cliente.id, e)}
                      title="Enviar WhatsApp"
                    >
                      <MessageCircle size={16} />
                    </button>
                    {whatsappMenu === cliente.id && (
                      <>
                        <div className="wa-menu-overlay" onClick={(e) => { e.stopPropagation(); setWhatsappMenu(null) }} />
                        <div className="wa-menu-dropdown" style={{ top: waMenuPos.top, right: waMenuPos.right }}>
                          {(plantillasMensaje || []).length > 0 ? (plantillasMensaje || []).map(p => (
                            <button key={p.id} onClick={(e) => { e.stopPropagation(); sendWhatsApp(cliente, 'plantilla', p.id) }}>
                              {p.nombre}
                            </button>
                          )) : (
                            <span style={{ padding: '8px 12px', color: '#999', fontSize: '0.85em', display: 'block' }}>No hay plantillas</span>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); sendWhatsApp(cliente, 'contacto') }}>
                            Ir al contacto
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setWhatsappMenu(null); navigate('/cuenta?tab=config&subtab=mensajes') }}>
                            + Agregar plantilla
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  <ChevronDown size={16} className={`cliente-card-chevron ${isExpanded ? 'rotated' : ''}`} />
                </div>
              </div>
              {isExpanded && (
                <div className="cliente-card-body">
                  <div className="cliente-card-row">
                    <span className="cliente-card-label">Moto</span>
                    <span className="cliente-card-value">{cliente.moto || '—'}</span>
                  </div>
                  <div className="cliente-card-row">
                    <span className="cliente-card-label">Teléfono</span>
                    <span className="cliente-card-value">{cliente.telefono || '—'}</span>
                  </div>
                  <div className="cliente-card-row">
                    <span className="cliente-card-label">Categoría</span>
                    <span className="cliente-card-value">{cliente.membresia?.nombre || 'Cliente'}</span>
                  </div>
                  <div className="cliente-card-row">
                    <span className="cliente-card-label">Vencimiento</span>
                    <span className="cliente-card-value">{formatFecha(cliente.fecha_fin_membresia)}</span>
                  </div>
                  {/* Historial */}
                  {(() => {
                    const hist = clienteHistorial[cliente.id]
                    if (!hist) return null
                    if (hist.loading) return <div className="cliente-historial"><span className="cliente-hist-loading">Cargando historial...</span></div>
                    const items = [
                      ...(hist.lavadas || []).map(l => ({ _type: 'lavada', fecha: l.fecha, desc: l.tipo_lavado?.nombre || 'Servicio', valor: l.valor })),
                      ...(hist.transacciones || []).map(t => ({ _type: t.tipo === 'EGRESO' ? 'egreso' : 'ingreso', fecha: t.fecha, desc: t.descripcion || t.categoria || 'Transacción', valor: t.valor })),
                      ...(hist.mensajes || []).map(m => ({ _type: 'mensaje', fecha: m.created_at, desc: m.plantilla_nombre || 'Mensaje WhatsApp', valor: null }))
                    ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
                    if (items.length === 0) return <div className="cliente-historial"><span className="cliente-hist-empty">Sin registros</span></div>
                    return (
                      <div className="cliente-historial">
                        <span className="cliente-hist-title">Historial</span>
                        {items.slice(0, 20).map((item, i) => (
                          <div key={i} className="cliente-hist-item">
                            <div className={`cliente-hist-icon ${item._type === 'lavada' ? 'icon-blue' : item._type === 'mensaje' ? 'icon-purple' : item._type === 'egreso' ? 'icon-red' : 'icon-green'}`}>
                              {item._type === 'lavada' ? <Droplets size={14} /> : item._type === 'mensaje' ? <MessageCircle size={14} /> : <DollarSign size={14} />}
                            </div>
                            <div className="cliente-hist-info">
                              <span className="cliente-hist-desc">{item.desc}</span>
                              <span className="cliente-hist-fecha">{formatFecha(item.fecha)}</span>
                            </div>
                            {item._type !== 'mensaje' && (
                              <span className={`cliente-hist-valor ${item._type === 'egreso' ? 'negativo' : ''}`}>
                                {item._type === 'egreso' ? '-' : ''}{formatMoney(item.valor)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  })()}

                  <div className="cliente-card-actions">
                    <button className="btn-secondary" onClick={() => handleEdit(cliente)}>
                      <Edit size={16} /> Editar
                    </button>
                    <button className="btn-secondary btn-danger-outline" onClick={() => requestDeleteCliente(cliente.id)}>
                      <Trash2 size={16} /> Eliminar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {clientesOrdenados.length === 0 && (
          <div className="clientes-cards-empty">No hay clientes registrados</div>
        )}
      </div>

      {modoSeleccion && selectedClientes.size > 0 && (
        <div className="bulk-action-bar">
          <span>{selectedClientes.size} seleccionado{selectedClientes.size > 1 ? 's' : ''}</span>
          <div className="bulk-action-buttons">
            <button className="btn-secondary" onClick={() => { setSelectedClientes(new Set()); setModoSeleccion(false) }}>
              <X size={16} /> Cancelar
            </button>
            <button className="btn-danger" onClick={requestBulkDeleteClientes}>
              <Trash2 size={16} /> Eliminar
            </button>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="modal-overlay">
          <div className="modal import-modal">
            <div className="modal-header">
              <h2>Importar Clientes</h2>
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
                    <p>Columnas obligatorias: <strong>nombre</strong>, <strong>placa</strong>, <strong>telefono</strong></p>
                    <p>Opcionales: cedula, correo, moto, tipo_membresia</p>
                  </div>
                </>
              )}

              {importStep === 'preview' && (
                <>
                  <div className="import-summary">
                    <div className="import-stat stat-green">
                      <span className="import-stat-value">{importNuevos.length}</span>
                      <span className="import-stat-label">Nuevos</span>
                    </div>
                    <div className="import-stat stat-yellow">
                      <span className="import-stat-value">{importDuplicados.length}</span>
                      <span className="import-stat-label">Duplicados</span>
                    </div>
                    <div className="import-stat stat-red">
                      <span className="import-stat-value">{importErrors.filter(e => e.tipo !== 'warning').length}</span>
                      <span className="import-stat-label">Errores</span>
                    </div>
                  </div>

                  {(() => {
                    const todos = [...importNuevos, ...(dupAction === 'update' ? importDuplicados : [])]
                    const conteo = {}
                    todos.forEach(r => {
                      const nombre = r.tipo_membresia_nombre || 'CLIENTE'
                      conteo[nombre] = (conteo[nombre] || 0) + 1
                    })
                    const entries = Object.entries(conteo).sort((a, b) => b[1] - a[1])
                    return entries.length > 0 && (
                      <div className="import-membresia-breakdown">
                        <h4>Desglose por membresía</h4>
                        {entries.map(([nombre, cant]) => (
                          <div key={nombre} className="import-membresia-row">
                            <span>{nombre}</span>
                            <span className="import-membresia-count">{cant}</span>
                          </div>
                        ))}
                      </div>
                    )
                  })()}

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

                  {importDuplicados.length > 0 && (
                    <div className="import-dup-options">
                      <h4>Placas duplicadas encontradas</h4>
                      <label className="import-radio">
                        <input type="radio" name="dupAction" value="skip" checked={dupAction === 'skip'} onChange={() => setDupAction('skip')} />
                        Saltar duplicados
                      </label>
                      <label className="import-radio">
                        <input type="radio" name="dupAction" value="update" checked={dupAction === 'update'} onChange={() => setDupAction('update')} />
                        Actualizar datos existentes
                      </label>
                    </div>
                  )}

                  {importNuevos.length > 0 && (
                    <div className="import-preview-wrapper">
                      <h4>Vista previa</h4>
                      <div className="import-preview-table-wrapper">
                        <table className="import-preview-table">
                          <thead>
                            <tr>
                              <th>Nombre</th>
                              <th>Placa</th>
                              <th>Teléfono</th>
                              <th>Membresía</th>
                            </tr>
                          </thead>
                          <tbody>
                            {importNuevos.slice(0, 10).map((row, i) => (
                              <tr key={i}>
                                <td>{row.nombre}</td>
                                <td>{row.placa}</td>
                                <td>{row.telefono}</td>
                                <td>{row.tipo_membresia_nombre}</td>
                              </tr>
                            ))}
                            {importNuevos.length > 10 && (
                              <tr><td colSpan="4" className="import-more">... y {importNuevos.length - 10} más</td></tr>
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
                      disabled={importNuevos.length === 0 && (dupAction === 'skip' || importDuplicados.length === 0)}
                    >
                      Importar {importNuevos.length + (dupAction === 'update' ? importDuplicados.length : 0)} clientes
                    </button>
                  </div>
                </>
              )}

              {importStep === 'importing' && (
                <div className="import-progress-container">
                  <p>Importando clientes...</p>
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
                    <div className="import-stat stat-yellow">
                      <span className="import-stat-value">{importResult.actualizados}</span>
                      <span className="import-stat-label">Actualizados</span>
                    </div>
                    {importResult.lavadas > 0 && (
                      <div className="import-stat stat-green">
                        <span className="import-stat-value">{importResult.lavadas}</span>
                        <span className="import-stat-label">Lavadas</span>
                      </div>
                    )}
                    <div className="import-stat stat-red">
                      <span className="import-stat-value">{importResult.errores}</span>
                      <span className="import-stat-label">Errores</span>
                    </div>
                  </div>
                  {importResult.failedRows?.length > 0 && (
                    <div className="import-errors">
                      <h4>Clientes que no se pudieron importar</h4>
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

      {showModal && (
        <div className="modal-overlay">
          <div className="modal modal-sheet">
            <div className="modal-sheet-handle"><div className="modal-sheet-handle-bar" /></div>
            <div className="modal-sheet-header">
              <button type="button" className="btn-sheet-close" onClick={() => { setShowModal(false); setEditando(null) }}>
                <X size={20} />
              </button>
              <h2>{editando ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
              <button type="button" className="btn-sheet-action" onClick={handleSubmit}>
                {editando ? 'Actualizar' : 'Guardar'}
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

                <div className="form-row">
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
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FAB (mobile only) */}
      {!modoSeleccion && (
        <button
          className={`clientes-fab ${showFabMenu ? 'open' : ''}`}
          onClick={() => setShowFabMenu(!showFabMenu)}
        >
          <Plus size={24} />
        </button>
      )}
      {showFabMenu && (
        <>
          <div className="clientes-fab-overlay" onClick={() => setShowFabMenu(false)} />
          <div className="clientes-fab-menu">
            <button onClick={() => { setShowFabMenu(false); setShowModal(true) }}>
              <Plus size={18} /> Nuevo Cliente
            </button>
            <button onClick={() => { setShowFabMenu(false); setShowImportModal(true) }}>
              <Upload size={18} /> Importar
            </button>
            <button onClick={() => { setShowFabMenu(false); setModoSeleccion(true); setSelectedClientes(new Set()) }}>
              <CheckSquare size={18} /> Seleccionar
            </button>
          </div>
        </>
      )}
      {showUpgradeModal && <UpgradeModal onClose={() => setShowUpgradeModal(false)} reason="Has alcanzado el límite de 30 clientes" />}

      <ConfirmDeleteModal
        isOpen={!!pendingDeleteClienteId}
        onClose={() => setPendingDeleteClienteId(null)}
        onConfirm={executeDeleteCliente}
        message="Se eliminará este cliente permanentemente. Ingresa tu contraseña para confirmar."
      />

      <ConfirmDeleteModal
        isOpen={pendingBulkDeleteClientes}
        onClose={() => setPendingBulkDeleteClientes(false)}
        onConfirm={executeBulkDeleteClientes}
        message={`Vas a eliminar ${selectedClientes.size} cliente${selectedClientes.size > 1 ? 's' : ''}. Esta acción no se puede deshacer. Ingresa tu contraseña para confirmar.`}
      />
    </div>
  )
}
