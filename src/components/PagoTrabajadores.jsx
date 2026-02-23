import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { useData } from './DataContext'
import { useTenant } from './TenantContext'
import { useToast } from './Toast'
import { Plus, X, Trash2, Pencil, DollarSign, Users, Hash, Minus, ChevronRight, Search, SlidersHorizontal } from 'lucide-react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { registerLocale } from 'react-datepicker'
import es from 'date-fns/locale/es'
import { formatMoney } from '../utils/money'
import ConfirmDeleteModal from './common/ConfirmDeleteModal'

registerLocale('es', es)

function fechaLocalStr(date) {
  if (!date) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseDateStr(str) {
  if (!str) return null
  const [y, m, d] = str.split('T')[0].split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Generar array de Date entre dos fechas (inclusive)
function generarRangoDias(desdeStr, hastaStr) {
  const desde = parseDateStr(desdeStr)
  const hasta = parseDateStr(hastaStr)
  if (!desde || !hasta || desde > hasta) return []
  const dias = []
  const curr = new Date(desde)
  while (curr <= hasta) {
    dias.push(new Date(curr))
    curr.setDate(curr.getDate() + 1)
  }
  return dias
}

export default function PagoTrabajadores() {
  const { metodosPago, negocioId, tiposLavado } = useData()
  const { userEmail } = useTenant()
  const toast = useToast()

  const [pagos, setPagos] = useState([])
  const [lavadores, setLavadores] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [modalMinimized, setModalMinimized] = useState(false)
  const [lavadasPeriodo, setLavadasPeriodo] = useState([])
  const [calculando, setCalculando] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [pendingAnularPago, setPendingAnularPago] = useState(null)
  const [diasYaPagados, setDiasYaPagados] = useState([])
  const [lavadasExcluidas, setLavadasExcluidas] = useState(0)
  const [descuentosFocused, setDescuentosFocused] = useState(false)
  const [valorPagadoManual, setValorPagadoManual] = useState(false)
  const [selectedWorker, setSelectedWorker] = useState(null)
  const [trabajadorSearch, setTrabajadorSearch] = useState('')
  const [showTrabajadorDropdown, setShowTrabajadorDropdown] = useState(false)
  const [showNuevoTrabajador, setShowNuevoTrabajador] = useState(false)
  const [nuevoTrabajadorNombre, setNuevoTrabajadorNombre] = useState('')
  const [periodoTipo, setPeriodoTipo] = useState('')
  const trabajadorWrapperRef = useRef(null)

  // Filtros de fecha (igual que Balance)
  const hoyInit = new Date()
  hoyInit.setHours(0, 0, 0, 0)
  const [filtroDesde, setFiltroDesde] = useState(new Date(hoyInit.getFullYear(), hoyInit.getMonth(), 1))
  const [filtroHasta, setFiltroHasta] = useState(new Date(hoyInit.getFullYear(), hoyInit.getMonth() + 1, 0))
  const [filtroRapido, setFiltroRapido] = useState('mes')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const searchInputRef = useRef(null)
  const filtroRapidoKeys = ['hoy', 'semana', 'mes', 'año']
  const filtroRapidoIdx = filtroRapidoKeys.indexOf(filtroRapido)

  const [formData, setFormData] = useState({
    lavador_id: '',
    fecha: new Date().toISOString().split('T')[0],
    fecha_desde: '',
    fecha_hasta: '',
    lavadas_cantidad: 0,
    total: 0,
    descuentos: 0,
    descuentos_detalle: [],
    total_pagar: 0,
    valor_pagado: 0,
    adicionales_cantidad: 0,
    detalle: null,
    metodo_pago_id: '',
    abonos_detalle: []
  })

  useEffect(() => {
    fetchData()
  }, [filtroDesde, filtroHasta])

  // Close trabajador dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (trabajadorWrapperRef.current && !trabajadorWrapperRef.current.contains(e.target)) {
        setShowTrabajadorDropdown(false)
        setShowNuevoTrabajador(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectTrabajador = (lavador) => {
    handleChange('lavador_id', lavador.id)
    setTrabajadorSearch(`${lavador.nombre}`)
    setShowTrabajadorDropdown(false)
  }

  const handleClearTrabajador = () => {
    handleChange('lavador_id', '')
    setTrabajadorSearch('')
    setShowTrabajadorDropdown(false)
  }

  const handleCrearTrabajador = async () => {
    const nombre = nuevoTrabajadorNombre.trim()
    if (!nombre) return
    const { data, error } = await supabase
      .from('lavadores')
      .insert({ nombre, negocio_id: negocioId, activo: true })
      .select()
      .single()
    if (error) {
      toast.error('Error al crear trabajador: ' + error.message)
      return
    }
    setLavadores(prev => [...prev, data])
    handleChange('lavador_id', data.id)
    setTrabajadorSearch(data.nombre)
    setShowNuevoTrabajador(false)
    setNuevoTrabajadorNombre('')
    setShowTrabajadorDropdown(false)
    toast.success(`Trabajador "${nombre}" creado`)
  }

  const fetchData = async () => {
    let query = supabase
      .from('pago_trabajadores')
      .select(`
        *,
        lavador:lavadores(nombre)
      `)
      .order('fecha', { ascending: false })

    if (filtroDesde) {
      query = query.gte('fecha', fechaLocalStr(filtroDesde))
    }
    if (filtroHasta) {
      const hasta = new Date(filtroHasta)
      hasta.setDate(hasta.getDate() + 1)
      query = query.lt('fecha', fechaLocalStr(hasta))
    }

    const { data: pagosData } = await query

    const { data: lavadoresData } = await supabase
      .from('lavadores')
      .select('*')
      .eq('activo', true)

    setPagos(pagosData || [])
    setLavadores(lavadoresData || [])
  }

  const aplicarFiltroRapido = (tipo) => {
    setFiltroRapido(tipo)
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    switch (tipo) {
      case 'hoy':
        setFiltroDesde(hoy)
        setFiltroHasta(hoy)
        break
      case 'semana': {
        const inicioSemana = new Date(hoy)
        const diaS = hoy.getDay()
        inicioSemana.setDate(hoy.getDate() - (diaS === 0 ? 6 : diaS - 1))
        const finSemana = new Date(inicioSemana)
        finSemana.setDate(inicioSemana.getDate() + 6)
        setFiltroDesde(inicioSemana)
        setFiltroHasta(finSemana)
        break
      }
      case 'mes': {
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
        const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
        setFiltroDesde(inicioMes)
        setFiltroHasta(finMes)
        break
      }
      case 'año': {
        const inicioAño = new Date(hoy.getFullYear(), 0, 1)
        const finAño = new Date(hoy.getFullYear(), 11, 31)
        setFiltroDesde(inicioAño)
        setFiltroHasta(finAño)
        break
      }
      case 'todas':
        setFiltroDesde(null)
        setFiltroHasta(null)
        break
      default:
        break
    }
  }

  const getSelectedLavador = () => {
    return lavadores.find(l => l.id == formData.lavador_id)
  }

  // Fetch pagos existentes del trabajador para saber días ya pagados
  const fetchDiasYaPagados = async (lavadorId) => {
    if (!lavadorId) {
      setDiasYaPagados([])
      return []
    }
    const { data } = await supabase
      .from('pago_trabajadores')
      .select('id, fecha_desde, fecha_hasta')
      .eq('lavador_id', lavadorId)
      .or('anulado.is.null,anulado.eq.false')

    const pagosExistentes = (data || []).filter(p => {
      // Si estamos editando, excluir el pago que estamos editando
      if (editandoId && p.id === editandoId) return false
      return p.fecha_desde && p.fecha_hasta
    })

    const dias = []
    pagosExistentes.forEach(p => {
      const rango = generarRangoDias(p.fecha_desde, p.fecha_hasta)
      dias.push(...rango)
    })

    setDiasYaPagados(dias)
    return dias
  }

  // Cuando cambia el trabajador, actualizar días ya pagados
  useEffect(() => {
    if (formData.lavador_id) {
      fetchDiasYaPagados(formData.lavador_id)
    } else {
      setDiasYaPagados([])
    }
  }, [formData.lavador_id, editandoId])

  // Verificar si una fecha cae dentro de días ya pagados
  const esDiaYaPagado = (fechaStr) => {
    const fecha = parseDateStr(fechaStr?.split('T')[0])
    if (!fecha) return false
    return diasYaPagados.some(d =>
      d.getFullYear() === fecha.getFullYear() &&
      d.getMonth() === fecha.getMonth() &&
      d.getDate() === fecha.getDate()
    )
  }

  // Fetch lavadas for a worker in a date range
  const fetchLavadasTrabajador = async (lavadorId, desde, hasta) => {
    if (!lavadorId || !desde || !hasta) {
      setLavadasPeriodo([])
      return []
    }
    const { data } = await supabase
      .from('lavadas')
      .select('*, tipo_lavado:tipos_lavado(nombre, precio)')
      .eq('lavador_id', lavadorId)
      .gte('fecha', desde)
      .lte('fecha', hasta + 'T23:59:59')
      .order('fecha', { ascending: true })
    const result = data || []
    setLavadasPeriodo(result)
    return result
  }

  // Auto-calculate payment based on worker config
  // hayDiasNuevos: true if the selected range has at least one unpaid day
  const calcularPagoAutomatico = (lavador, lavadas, hayDiasNuevos = true) => {
    const tipo = lavador.tipo_pago
    let total = 0
    let numLavadas = lavadas.length
    let numAdicionales = lavadas.reduce((sum, l) => sum + (l.adicionales?.length || 0), 0)
    let detalleInfo = { tipo_pago: tipo, num_lavadas: numLavadas, num_adicionales: numAdicionales }

    if (tipo === 'porcentaje') {
      const sumaValor = lavadas.reduce((sum, l) => sum + Number(l.valor || 0), 0)
      total = sumaValor * (Number(lavador.pago_porcentaje || 0) / 100)
      detalleInfo.suma_valor_lavadas = sumaValor
      detalleInfo.porcentaje = lavador.pago_porcentaje
    } else if (tipo === 'sueldo_fijo') {
      const sueldo = hayDiasNuevos ? Number(lavador.pago_sueldo_base || 0) : 0
      const porLavada = numLavadas * Number(lavador.pago_por_lavada || 0)
      const porAdicional = numAdicionales * Number(lavador.pago_por_adicional || 0)
      total = sueldo + porLavada + porAdicional
      detalleInfo.sueldo_base = hayDiasNuevos ? lavador.pago_sueldo_base : 0
      detalleInfo.pago_por_lavada = lavador.pago_por_lavada
      detalleInfo.pago_por_adicional = lavador.pago_por_adicional
    } else if (tipo === 'porcentaje_lavada') {
      const tipoBase = tiposLavado.find(t => t.es_base)
      const precioBase = Number(tipoBase?.precio || 0)
      const sumaPorcentajeLavada = numLavadas * (precioBase * (Number(lavador.pago_porcentaje_lavada || 0) / 100))
      let sumaAdicionales = 0
      if (lavador.pago_adicionales_detalle) {
        lavadas.forEach(l => {
          (l.adicionales || []).forEach(a => {
            sumaAdicionales += Number(lavador.pago_adicionales_detalle[a.id] || 0)
          })
        })
      } else {
        sumaAdicionales = numAdicionales * Number(lavador.pago_adicional_fijo || 0)
      }
      total = sumaPorcentajeLavada + sumaAdicionales
      detalleInfo.porcentaje_lavada = lavador.pago_porcentaje_lavada
      detalleInfo.pago_adicional_fijo = lavador.pago_adicional_fijo
      detalleInfo.pago_adicionales_detalle = lavador.pago_adicionales_detalle
      detalleInfo.tipo_base_nombre = tipoBase?.nombre || null
      detalleInfo.tipo_base_precio = precioBase
    }

    return { total: Math.round(total), detalle: detalleInfo, adicionales_cantidad: numAdicionales, lavadas_cantidad: numLavadas }
  }

  // Effect: auto-calculate when worker or dates change
  useEffect(() => {
    const doCalc = async () => {
      const lavador = getSelectedLavador()
      if (!lavador || !lavador.tipo_pago || !formData.fecha_desde || !formData.fecha_hasta) return

      setCalculando(true)
      const todasLavadas = await fetchLavadasTrabajador(lavador.id, formData.fecha_desde, formData.fecha_hasta)

      // Filtrar lavadas de días ya pagados
      const lavadasFiltradas = todasLavadas.filter(l => !esDiaYaPagado(l.fecha))
      const excluidas = todasLavadas.length - lavadasFiltradas.length
      setLavadasExcluidas(excluidas)

      // Verificar si hay al menos un día no pagado en el rango
      const rangoDias = generarRangoDias(formData.fecha_desde, formData.fecha_hasta)
      const hayDiasNuevos = rangoDias.some(d =>
        !diasYaPagados.some(yp =>
          yp.getFullYear() === d.getFullYear() &&
          yp.getMonth() === d.getMonth() &&
          yp.getDate() === d.getDate()
        )
      )

      const result = calcularPagoAutomatico(lavador, lavadasFiltradas, hayDiasNuevos)
      const totalPagar = result.total - Number(formData.descuentos)
      setFormData(prev => ({
        ...prev,
        total: result.total,
        total_pagar: totalPagar,
        lavadas_cantidad: result.lavadas_cantidad,
        adicionales_cantidad: result.adicionales_cantidad,
        detalle: result.detalle
      }))
      setCalculando(false)
    }
    doCalc()
  }, [formData.lavador_id, formData.fecha_desde, formData.fecha_hasta, diasYaPagados])

  // Recalc total_pagar when descuentos change
  useEffect(() => {
    setFormData(prev => ({ ...prev, total_pagar: prev.total - Number(prev.descuentos) }))
  }, [formData.descuentos])

  // Auto-sync valor_pagado: if no abonos and user hasn't manually set, default to total_pagar
  useEffect(() => {
    if (!valorPagadoManual && (!formData.abonos_detalle || formData.abonos_detalle.length === 0)) {
      setFormData(prev => ({ ...prev, valor_pagado: prev.total_pagar }))
    }
  }, [formData.total_pagar, valorPagadoManual])

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const aplicarPeriodoPago = async (tipo) => {
    setPeriodoTipo(tipo)
    if (tipo === 'fechas') return

    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const hoyStr = fechaLocalStr(hoy)

    switch (tipo) {
      case 'hoy':
        handleChange('fecha_desde', hoyStr)
        handleChange('fecha_hasta', hoyStr)
        break
      case 'semana': {
        const dia = hoy.getDay()
        const lunes = new Date(hoy)
        lunes.setDate(hoy.getDate() - (dia === 0 ? 6 : dia - 1))
        handleChange('fecha_desde', fechaLocalStr(lunes))
        handleChange('fecha_hasta', hoyStr)
        break
      }
      case 'mes': {
        const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
        handleChange('fecha_desde', fechaLocalStr(primero))
        handleChange('fecha_hasta', hoyStr)
        break
      }
      case 'todo': {
        const lavadorId = formData.lavador_id
        if (!lavadorId) break
        const { data } = await supabase
          .from('lavadas')
          .select('fecha')
          .eq('lavador_id', lavadorId)
          .order('fecha', { ascending: true })
          .limit(1)
        const primeraFecha = data?.[0]?.fecha?.split('T')[0]
        if (primeraFecha) {
          handleChange('fecha_desde', primeraFecha)
          handleChange('fecha_hasta', hoyStr)
        }
        break
      }
      default:
        break
    }
  }

  const resetForm = () => {
    setFormData({
      lavador_id: '',
      fecha: new Date().toISOString().split('T')[0],
      fecha_desde: '',
      fecha_hasta: '',
      lavadas_cantidad: 0,
      total: 0,
      descuentos: 0,
      descuentos_detalle: [],
      total_pagar: 0,
      valor_pagado: 0,
      adicionales_cantidad: 0,
      detalle: null,
      metodo_pago_id: '',
      abonos_detalle: []
    })
    setLavadasPeriodo([])
    setLavadasExcluidas(0)
    setValorPagadoManual(false)
    setPeriodoTipo('')
    setTrabajadorSearch('')
    setShowNuevoTrabajador(false)
    setNuevoTrabajadorNombre('')
  }

  // Abrir modal en modo edición
  const handleEditar = (pago) => {
    setEditandoId(pago.id)
    const valorPagado = pago.valor_pagado != null ? Number(pago.valor_pagado) : Number(pago.total_pagar || 0)
    const totalPagar = Number(pago.total_pagar || 0)

    // Backward compat: si no tiene abonos_detalle pero tiene valor_pagado, convertir
    let abonos = pago.abonos_detalle || []
    if ((!abonos || abonos.length === 0) && valorPagado > 0) {
      abonos = [{
        monto: valorPagado,
        metodo_pago_id: pago.metodo_pago_id || '',
        metodo_pago_nombre: metodosPago.find(m => m.id === pago.metodo_pago_id)?.nombre || '',
        fecha: pago.fecha?.split('T')[0] || '',
        hora: ''
      }]
    }

    setFormData({
      lavador_id: pago.lavador_id || '',
      fecha: pago.fecha?.split('T')[0] || new Date().toISOString().split('T')[0],
      fecha_desde: pago.fecha_desde?.split('T')[0] || '',
      fecha_hasta: pago.fecha_hasta?.split('T')[0] || '',
      lavadas_cantidad: pago.lavadas_cantidad || 0,
      kit_cantidad: pago.kit_cantidad || 0,
      cera_cantidad: pago.cera_cantidad || 0,
      basico: pago.basico || 0,
      total: pago.total || 0,
      descuentos: pago.descuentos || 0,
      descuentos_detalle: pago.descuentos_detalle || [],
      total_pagar: totalPagar,
      valor_pagado: valorPagado,
      adicionales_cantidad: pago.adicionales_cantidad || 0,
      detalle: pago.detalle || null,
      metodo_pago_id: pago.metodo_pago_id || '',
      abonos_detalle: abonos
    })
    setValorPagadoManual(true)
    setTrabajadorSearch(pago.lavador?.nombre || '')

    // Detect matching pill
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const hoyStr = fechaLocalStr(hoy)
    const desde = pago.fecha_desde?.split('T')[0] || ''
    const hasta = pago.fecha_hasta?.split('T')[0] || ''

    const dia = hoy.getDay()
    const lunes = new Date(hoy)
    lunes.setDate(hoy.getDate() - (dia === 0 ? 6 : dia - 1))
    const lunesStr = fechaLocalStr(lunes)
    const primeroMes = fechaLocalStr(new Date(hoy.getFullYear(), hoy.getMonth(), 1))

    if (desde === hoyStr && hasta === hoyStr) {
      setPeriodoTipo('hoy')
    } else if (desde === lunesStr && hasta === hoyStr) {
      setPeriodoTipo('semana')
    } else if (desde === primeroMes && hasta === hoyStr) {
      setPeriodoTipo('mes')
    } else if (desde && hasta) {
      setPeriodoTipo('fechas')
    } else {
      setPeriodoTipo('')
    }

    setModalMinimized(false)
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.lavador_id) {
      toast.error('Debes seleccionar un trabajador.')
      return
    }

    const abonosValidos = (formData.abonos_detalle || []).filter(a => a.monto > 0)
    if (abonosValidos.length === 0) {
      toast.error('Debes agregar al menos un abono con monto mayor a cero.')
      return
    }

    const abonoSinMetodo = abonosValidos.find(a => !a.metodo_pago_id)
    if (abonoSinMetodo) {
      toast.error('Cada abono debe tener un método de pago.')
      return
    }

    const lavador = getSelectedLavador()
    const periodo = formData.fecha_desde && formData.fecha_hasta
      ? `${formData.fecha_desde} a ${formData.fecha_hasta}`
      : formData.fecha

    // Backward compat: metodo_pago_id = primer abono
    const metodoPagoPrincipal = abonosValidos[0]?.metodo_pago_id || formData.metodo_pago_id

    // Build transaction rows — one per abono
    const transacciones = abonosValidos.map(a => ({
      tipo: 'EGRESO',
      categoria: 'PAGO TRABAJADOR',
      valor: a.monto,
      metodo_pago_id: a.metodo_pago_id,
      placa_o_persona: lavador?.nombre || '',
      descripcion: `Pago trabajador (abono) - ${periodo}`,
      fecha: formData.fecha + 'T12:00:00-05:00',
      negocio_id: negocioId
    }))

    if (editandoId) {
      const pagoAnterior = pagos.find(p => p.id === editandoId)
      const periodoAnterior = pagoAnterior?.fecha_desde && pagoAnterior?.fecha_hasta
        ? `${pagoAnterior.fecha_desde} a ${pagoAnterior.fecha_hasta}`
        : pagoAnterior?.fecha?.split('T')[0]
      const nombreAnterior = pagoAnterior?.lavador?.nombre || ''

      // Validar que no se cruce con otro pago existente (excluyendo el que se edita)
      if (formData.fecha_desde && formData.fecha_hasta) {
        const { data: existentes } = await supabase
          .from('pago_trabajadores')
          .select('id, fecha_desde, fecha_hasta')
          .eq('lavador_id', formData.lavador_id)
          .neq('id', editandoId)
          .or(`anulado.is.null,anulado.eq.false`)

        const duplicado = (existentes || []).some(p => {
          if (!p.fecha_desde || !p.fecha_hasta) return false
          return p.fecha_desde <= formData.fecha_hasta && p.fecha_hasta >= formData.fecha_desde
        })

        if (duplicado) {
          toast.error('Ya existe un pago para este trabajador en ese período. No se puede pagar dos veces el mismo rango.')
          return
        }
      }

      const { error: pagoError } = await supabase
        .from('pago_trabajadores')
        .update({
          lavador_id: formData.lavador_id,
          fecha: formData.fecha,
          fecha_desde: formData.fecha_desde || null,
          fecha_hasta: formData.fecha_hasta || null,
          lavadas_cantidad: formData.lavadas_cantidad,
          total: formData.total,
          descuentos: formData.descuentos,
          descuentos_detalle: formData.descuentos_detalle || [],
          total_pagar: formData.total_pagar,
          valor_pagado: formData.valor_pagado,
          adicionales_cantidad: formData.adicionales_cantidad,
          detalle: formData.detalle,
          metodo_pago_id: metodoPagoPrincipal,
          abonos_detalle: formData.abonos_detalle
        })
        .eq('id', editandoId)

      if (pagoError) {
        toast.error('Error al actualizar el pago: ' + pagoError.message)
        return
      }

      // Delete old transactions (match both old and new description format)
      const descripcionAnterior = `Pago trabajador - ${periodoAnterior}`
      const descripcionAbonoAnterior = `Pago trabajador (abono) - ${periodoAnterior}`
      await supabase
        .from('transacciones')
        .delete()
        .eq('categoria', 'PAGO TRABAJADOR')
        .ilike('placa_o_persona', nombreAnterior)
        .ilike('descripcion', `%${descripcionAnterior}%`)
      await supabase
        .from('transacciones')
        .delete()
        .eq('categoria', 'PAGO TRABAJADOR')
        .ilike('placa_o_persona', nombreAnterior)
        .ilike('descripcion', `%${descripcionAbonoAnterior}%`)

      // Insert new transactions (one per abono)
      await supabase.from('transacciones').insert(transacciones)

    } else {
      if (formData.fecha_desde && formData.fecha_hasta) {
        const { data: existentes } = await supabase
          .from('pago_trabajadores')
          .select('id, fecha_desde, fecha_hasta')
          .eq('lavador_id', formData.lavador_id)
          .or(`anulado.is.null,anulado.eq.false`)

        const duplicado = (existentes || []).some(p => {
          if (!p.fecha_desde || !p.fecha_hasta) return false
          return p.fecha_desde <= formData.fecha_hasta && p.fecha_hasta >= formData.fecha_desde
        })

        if (duplicado) {
          toast.error('Ya existe un pago para este trabajador en ese período. No se puede pagar dos veces el mismo rango.')
          return
        }
      }

      const { descuentos_detalle, abonos_detalle, ...formDataRest } = formData
      const { error: pagoError } = await supabase.from('pago_trabajadores').insert([{
        ...formDataRest,
        descuentos_detalle: descuentos_detalle || [],
        abonos_detalle: abonos_detalle || [],
        metodo_pago_id: metodoPagoPrincipal,
        negocio_id: negocioId
      }])

      if (pagoError) {
        toast.error('Error al guardar el pago: ' + pagoError.message)
        return
      }

      // Insert transactions (one per abono)
      await supabase.from('transacciones').insert(transacciones)
    }

    setShowModal(false)
    setModalMinimized(false)
    setEditandoId(null)
    resetForm()
    fetchData()
  }

  const requestAnularPago = (pago) => {
    setPendingAnularPago(pago)
  }

  const executeAnularPago = async () => {
    const pago = pendingAnularPago
    if (!pago) return

    await supabase
      .from('pago_trabajadores')
      .update({ anulado: true })
      .eq('id', pago.id)

    const periodo = pago.fecha_desde && pago.fecha_hasta
      ? `${pago.fecha_desde} a ${pago.fecha_hasta}`
      : pago.fecha?.split('T')[0]

    const nombreLavador = pago.lavador?.nombre || ''

    // Delete old format transactions
    const descripcionBuscada = `Pago trabajador - ${periodo}`
    await supabase
      .from('transacciones')
      .delete()
      .eq('categoria', 'PAGO TRABAJADOR')
      .ilike('placa_o_persona', nombreLavador)
      .ilike('descripcion', `%${descripcionBuscada}%`)

    // Delete new abono format transactions
    const descripcionAbono = `Pago trabajador (abono) - ${periodo}`
    await supabase
      .from('transacciones')
      .delete()
      .eq('categoria', 'PAGO TRABAJADOR')
      .ilike('placa_o_persona', nombreLavador)
      .ilike('descripcion', `%${descripcionAbono}%`)

    setPendingAnularPago(null)
    fetchData()
  }

  const formatFechaLocal = (fechaStr) => {
    if (!fechaStr) return '-'
    const f = fechaStr.split('T')[0]
    const [y, m, d] = f.split('-')
    return `${d}/${m}/${y}`
  }


  const lavadoresConPago = lavadores.filter(l => l.tipo_pago)
  const lavadoresParaSelector = lavadoresConPago.some(l => l.id == formData.lavador_id)
    ? lavadoresConPago
    : [...lavadoresConPago, ...lavadores.filter(l => l.id == formData.lavador_id)]

  const pagosActivos = pagos.filter(p => !p.anulado)
  const totalPagadoMes = pagosActivos.reduce((sum, p) => sum + Number(p.valor_pagado != null && Number(p.valor_pagado) !== 0 ? p.valor_pagado : p.total_pagar), 0)
  const pagosRealizados = pagosActivos.length
  const trabajadoresUnicos = new Set(pagosActivos.map(p => p.lavador_id)).size

  // Derive worker cards from filtered pagos
  const workerCards = useMemo(() => {
    const porTrabajador = {}
    pagosActivos.forEach(p => {
      const lid = p.lavador_id
      if (!porTrabajador[lid]) {
        porTrabajador[lid] = {
          lavador_id: lid,
          nombre: p.lavador?.nombre || 'Sin nombre',
          pagos: [],
          total_pagado: 0,
          total_a_pagar: 0,
          total_ganado: 0,
          total_descuentos: 0,
          saldo: 0
        }
      }
      porTrabajador[lid].pagos.push(p)
      const valorPagado = p.valor_pagado != null && Number(p.valor_pagado) !== 0 ? Number(p.valor_pagado) : Number(p.total_pagar || 0)
      porTrabajador[lid].total_pagado += valorPagado
      porTrabajador[lid].total_a_pagar += Number(p.total_pagar || 0)
      porTrabajador[lid].total_ganado += Number(p.total || 0)
      porTrabajador[lid].total_descuentos += Number(p.descuentos || 0)
    })

    Object.values(porTrabajador).forEach(w => {
      w.saldo = w.total_pagado - w.total_a_pagar
      w.por_pagar = Math.max(0, w.total_a_pagar - w.total_pagado)
    })

    return Object.values(porTrabajador).sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [pagos])

  const filteredWorkerCards = useMemo(() => {
    if (!searchQuery.trim()) return workerCards
    const q = searchQuery.toLowerCase().trim()
    return workerCards.filter(w => w.nombre.toLowerCase().includes(q))
  }, [workerCards, searchQuery])

  const filteredPagos = useMemo(() => {
    if (!searchQuery.trim()) return pagos
    const q = searchQuery.toLowerCase().trim()
    return pagos.filter(p => (p.lavador?.nombre || '').toLowerCase().includes(q))
  }, [pagos, searchQuery])

  // Fetch ALL pagos for a worker (no date filter) and open detail modal
  const handleWorkerClick = async (workerCard) => {
    const { data: allPagos } = await supabase
      .from('pago_trabajadores')
      .select(`
        *,
        lavador:lavadores(nombre, tipo_pago, telefono)
      `)
      .eq('lavador_id', workerCard.lavador_id)
      .order('fecha', { ascending: true })

    const pagosData = allPagos || []
    const activos = pagosData.filter(p => !p.anulado)
    const anulados = pagosData.filter(p => p.anulado)

    let total_pagado = 0
    let total_a_pagar = 0
    let total_descuentos = 0

    activos.forEach(p => {
      const valorPagado = p.valor_pagado != null && Number(p.valor_pagado) !== 0 ? Number(p.valor_pagado) : Number(p.total_pagar || 0)
      total_pagado += valorPagado
      total_a_pagar += Number(p.total_pagar || 0)
      total_descuentos += Number(p.descuentos || 0)
    })

    setSelectedWorker({
      lavador_id: workerCard.lavador_id,
      nombre: workerCard.nombre,
      tipo_pago: pagosData[0]?.lavador?.tipo_pago || '',
      telefono: pagosData[0]?.lavador?.telefono || '',
      pagos: activos,
      pagos_anulados: anulados,
      total_pagado,
      total_a_pagar,
      total_descuentos,
      saldo: total_pagado - total_a_pagar
    })
  }

  const tipoPagoLabel = (tipo) => {
    if (tipo === 'porcentaje') return 'Porcentaje'
    if (tipo === 'sueldo_fijo') return 'Sueldo fijo'
    if (tipo === 'porcentaje_lavada') return '% de servicio + adic.'
    return '-'
  }

  // Highlight config para DatePicker: días ya pagados en rojo
  const highlightPagados = diasYaPagados.length > 0
    ? [{ 'react-datepicker__day--pagado': diasYaPagados }]
    : []

  const handleAddDescuento = () => {
    const nuevos = [...(formData.descuentos_detalle || []), { concepto: '', valor: 0 }]
    const suma = nuevos.reduce((s, d) => s + Number(d.valor || 0), 0)
    setFormData(prev => ({ ...prev, descuentos_detalle: nuevos, descuentos: suma }))
  }

  const handleRemoveDescuento = (idx) => {
    const nuevos = (formData.descuentos_detalle || []).filter((_, i) => i !== idx)
    const suma = nuevos.reduce((s, d) => s + Number(d.valor || 0), 0)
    setFormData(prev => ({ ...prev, descuentos_detalle: nuevos, descuentos: suma }))
  }

  const handleDescuentoChange = (idx, field, value) => {
    const nuevos = (formData.descuentos_detalle || []).map((d, i) => i === idx ? { ...d, [field]: value } : d)
    const suma = nuevos.reduce((s, d) => s + Number(d.valor || 0), 0)
    setFormData(prev => ({ ...prev, descuentos_detalle: nuevos, descuentos: suma }))
  }

  const handleAddAbono = () => {
    const now = new Date()
    const fecha = fechaLocalStr(now)
    const hora = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const nuevos = [...(formData.abonos_detalle || []), { monto: 0, metodo_pago_id: '', metodo_pago_nombre: '', fecha, hora }]
    setFormData(prev => ({ ...prev, abonos_detalle: nuevos }))
  }

  const handleRemoveAbono = (idx) => {
    const nuevos = (formData.abonos_detalle || []).filter((_, i) => i !== idx)
    const sumaAbonos = nuevos.reduce((s, a) => s + Number(a.monto || 0), 0)
    setFormData(prev => ({
      ...prev,
      abonos_detalle: nuevos,
      valor_pagado: sumaAbonos,
      metodo_pago_id: nuevos[0]?.metodo_pago_id || ''
    }))
  }

  const handleAbonoChange = (idx, field, value) => {
    const nuevos = (formData.abonos_detalle || []).map((a, i) => {
      if (i !== idx) return a
      const updated = { ...a, [field]: value }
      // If metodo_pago_id changed, also update nombre
      if (field === 'metodo_pago_id') {
        updated.metodo_pago_nombre = metodosPago.find(m => m.id === value)?.nombre || ''
      }
      return updated
    })
    const sumaAbonos = nuevos.reduce((s, a) => s + Number(a.monto || 0), 0)
    setFormData(prev => ({
      ...prev,
      abonos_detalle: nuevos,
      valor_pagado: sumaAbonos,
      metodo_pago_id: nuevos[0]?.metodo_pago_id || ''
    }))
  }

  const saldo = formData.total_pagar - formData.valor_pagado

  const renderDescuentosSection = () => {
    const detalle = formData.descuentos_detalle || []
    return (
      <div className="descuentos-section">
        <div className="descuentos-header">
          <div>
            <span>Descuentos</span>
            <span className="section-subtitle">Deducciones antes del pago (multas, daños)</span>
          </div>
          <button type="button" className="btn-add-descuento" onClick={handleAddDescuento}>
            <Plus size={14} /> Descuento
          </button>
        </div>
        {detalle.map((d, idx) => (
          <div key={idx} className="descuento-row">
            <input
              type="text"
              value={d.concepto}
              onChange={(e) => handleDescuentoChange(idx, 'concepto', e.target.value)}
              placeholder="Ej: Adelanto, multa..."
              className="descuento-concepto"
            />
            <input
              type="text"
              inputMode="numeric"
              value={d.valor === 0 ? '' : Number(d.valor).toLocaleString('es-CO')}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^\d]/g, '')
                handleDescuentoChange(idx, 'valor', raw === '' ? 0 : Number(raw))
              }}
              placeholder="$0"
              className="descuento-valor"
            />
            <button type="button" className="descuento-remove" onClick={() => handleRemoveDescuento(idx)}>
              <X size={14} />
            </button>
          </div>
        ))}
        {detalle.length === 0 && (
          <span className="descuentos-empty">Sin deducciones</span>
        )}
        <div className="pago-linea-total descuentos-total-line">
          <span>Total descuentos</span>
          <strong className="descuentos-total-valor">{formatMoney(formData.descuentos)}</strong>
        </div>
      </div>
    )
  }

  const renderAbonosSection = () => {
    const abonos = formData.abonos_detalle || []
    const totalAbonado = abonos.reduce((s, a) => s + Number(a.monto || 0), 0)
    return (
      <div className="abonos-section">
        <div className="abonos-header">
          <div>
            <span>Abonos</span>
            <span className="section-subtitle">Dinero entregado al trabajador</span>
          </div>
          <button type="button" className="btn-add-abono" onClick={handleAddAbono}>
            <Plus size={14} /> Abono
          </button>
        </div>
        {abonos.map((a, idx) => (
          <div key={idx} className="abono-row">
            <select
              className="abono-metodo-select"
              value={a.metodo_pago_id}
              onChange={(e) => handleAbonoChange(idx, 'metodo_pago_id', e.target.value)}
            >
              <option value="">Método</option>
              {metodosPago.map(m => (
                <option key={m.id} value={m.id}>{m.nombre}</option>
              ))}
            </select>
            <input
              type="text"
              inputMode="numeric"
              className="abono-valor"
              value={a.monto === 0 ? '' : Number(a.monto).toLocaleString('es-CO')}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^\d]/g, '')
                handleAbonoChange(idx, 'monto', raw === '' ? 0 : Number(raw))
              }}
              placeholder="$0"
            />
            <button type="button" className="abono-remove" onClick={() => handleRemoveAbono(idx)}>
              <X size={14} />
            </button>
          </div>
        ))}
        {abonos.length === 0 && (
          <span className="abonos-empty">Agrega un abono para registrar cuánto se le pagó</span>
        )}
        <div className="pago-linea-total abonos-total-line">
          <span>Total abonado</span>
          <strong className="abonos-total-valor">{formatMoney(totalAbonado)}</strong>
        </div>
      </div>
    )
  }

  const renderAutoForm = () => {
    const lavador = getSelectedLavador()
    return (
      <>
        <div className="pago-periodo-section pago-form-fullwidth">
          <div className="pago-periodo-label">Período a pagar</div>
          <div className="cfd-rapido">
            {[
              { key: 'hoy', label: 'Hoy' },
              { key: 'semana', label: 'Semana' },
              { key: 'mes', label: 'Mes' },
              { key: 'todo', label: 'Todo' },
              { key: 'fechas', label: 'Fechas' }
            ].map(p => (
              <button
                key={p.key}
                type="button"
                className={`filter-btn${periodoTipo === p.key ? ' active' : ''}`}
                disabled={!formData.lavador_id}
                onClick={() => aplicarPeriodoPago(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
          {periodoTipo === 'fechas' && (
            <DatePicker
              selectsRange
              startDate={parseDateStr(formData.fecha_desde)}
              endDate={parseDateStr(formData.fecha_hasta)}
              onChange={([start, end]) => {
                handleChange('fecha_desde', start ? fechaLocalStr(start) : '')
                handleChange('fecha_hasta', end ? fechaLocalStr(end) : '')
              }}
              inline
              locale="es"
              highlightDates={highlightPagados}
            />
          )}
          {formData.fecha_desde && formData.fecha_hasta && (
            <div className="pago-periodo-resumen">
              {formatFechaLocal(formData.fecha_desde)} → {formatFechaLocal(formData.fecha_hasta)}
            </div>
          )}
        </div>

        {calculando && <p className="pago-calculando">Calculando...</p>}

        {!calculando && formData.fecha_desde && formData.fecha_hasta && (
          <div className="pago-resumen pago-form-fullwidth">
            <p className="pago-resumen-titulo">Resumen ({tipoPagoLabel(lavador?.tipo_pago)})</p>
            <p className="pago-resumen-linea">Servicios en período: <strong>{formData.lavadas_cantidad}</strong></p>
            <p className="pago-resumen-linea">Adicionales: <strong>{formData.adicionales_cantidad}</strong></p>
            {lavadasExcluidas > 0 && (
              <p className="pago-resumen-excluidos">
                {lavadasExcluidas} servicio{lavadasExcluidas > 1 ? 's' : ''} excluido{lavadasExcluidas > 1 ? 's' : ''} (días ya pagados)
              </p>
            )}
            {lavador?.tipo_pago === 'porcentaje' && (
              <p className="pago-resumen-linea">Valor total servicios: <strong>{formatMoney(formData.detalle?.suma_valor_lavadas || 0)}</strong> x {lavador.pago_porcentaje || 0}%</p>
            )}
            {lavador?.tipo_pago === 'sueldo_fijo' && (
              <>
                <p className="pago-resumen-linea">Sueldo base: <strong>{formatMoney(lavador.pago_sueldo_base || 0)}</strong></p>
                <p className="pago-resumen-linea">+ {formData.lavadas_cantidad} servicios x {formatMoney(lavador.pago_por_lavada || 0)}</p>
                <p className="pago-resumen-linea">+ {formData.adicionales_cantidad} adicionales x {formatMoney(lavador.pago_por_adicional || 0)}</p>
              </>
            )}
            {lavador?.tipo_pago === 'porcentaje_lavada' && (() => {
              const tipoBase = tiposLavado.find(t => t.es_base)
              const precioBase = Number(tipoBase?.precio || 0)
              return (
                <>
                  <p className="pago-resumen-linea">
                    {formData.lavadas_cantidad} servicios x {formatMoney(precioBase)}{tipoBase ? ` (${tipoBase.nombre})` : ''} x {lavador.pago_porcentaje_lavada || 0}%
                  </p>
                  <p className="pago-resumen-linea">+ {formData.adicionales_cantidad} adicionales x {formatMoney(lavador.pago_adicional_fijo || 0)}</p>
                  {!tipoBase && (
                    <p className="pago-resumen-excluidos">Sin lavada base configurada — el cálculo usa $0</p>
                  )}
                </>
              )
            })()}
            <div className="pago-linea-total pago-resumen-subtotal">
              <span>Subtotal</span>
              <strong>{formatMoney(formData.total)}</strong>
            </div>
          </div>
        )}

        <div className="pago-form-fullwidth">
          {renderDescuentosSection()}
          <div className="pago-linea-total pago-linea-final">
            <span>Total a Pagar</span>
            <strong>{formatMoney(formData.total_pagar)}</strong>
          </div>
          {renderAbonosSection()}
          {formData.valor_pagado !== formData.total_pagar && formData.valor_pagado > 0 && (
            <div className="pago-linea-total pago-linea-saldo">
              <span>{saldo > 0 ? 'Pendiente' : 'Pagado de más'}</span>
              <strong className={saldo > 0 ? 'saldo-pendiente' : 'saldo-favor'}>
                {formatMoney(Math.abs(saldo))}
              </strong>
            </div>
          )}
        </div>
      </>
    )
  }

  const renderWorkerDetailModal = () => {
    if (!selectedWorker) return null
    const w = selectedWorker
    const allPagos = [...w.pagos].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))

    // Calcular saldo acumulado de más antiguo a más nuevo
    let saldoAcum = 0
    const pagosConSaldo = allPagos.map(p => {
      const valorPagado = p.valor_pagado != null && Number(p.valor_pagado) !== 0 ? Number(p.valor_pagado) : Number(p.total_pagar || 0)
      const totalPagar = Number(p.total_pagar || 0)
      saldoAcum += valorPagado - totalPagar
      return { ...p, saldo_acumulado: saldoAcum }
    })

    return (
      <div className="modal-overlay" onClick={() => setSelectedWorker(null)}>
        <div className="historial-detail-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div>
              <h2>{w.nombre}</h2>
              <div className="historial-detail-subtitle">
                {w.tipo_pago && <span>{tipoPagoLabel(w.tipo_pago)}</span>}
                {w.telefono && <span> · {w.telefono}</span>}
              </div>
            </div>
            <button className="btn-close" onClick={() => setSelectedWorker(null)}>
              <X size={24} />
            </button>
          </div>

          <div className="historial-detail-stats">
            <div className="historial-detail-stat">
              <span className="historial-stat-label">Total Ganado</span>
              <span className="historial-stat-value">{formatMoney(w.total_a_pagar + w.total_descuentos)}</span>
            </div>
            <div className="historial-detail-stat">
              <span className="historial-stat-label">Total Pagado</span>
              <span className="historial-stat-value">{formatMoney(w.total_pagado)}</span>
            </div>
            <div className="historial-detail-stat">
              <span className="historial-stat-label">Descuentos</span>
              <span className="historial-stat-value valor-negativo">{formatMoney(w.total_descuentos)}</span>
            </div>
            <div className="historial-detail-stat">
              <span className="historial-stat-label">Saldo</span>
              <span className={`historial-stat-value ${w.saldo >= 0 ? 'saldo-favor' : 'saldo-pendiente'}`}>
                {w.saldo >= 0 ? '+' : ''}{formatMoney(w.saldo)}
              </span>
            </div>
          </div>

          {/* Desktop: tabla */}
          <div className="historial-detail-tabla-desktop">
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Período</th>
                    <th>Servicios</th>
                    <th>Total</th>
                    <th>Desc.</th>
                    <th>A Pagar</th>
                    <th>Pagado</th>
                    <th>Saldo Acum.</th>
                  </tr>
                </thead>
                <tbody>
                  {pagosConSaldo.map(p => {
                    const valorPagado = p.valor_pagado != null && Number(p.valor_pagado) !== 0 ? Number(p.valor_pagado) : Number(p.total_pagar || 0)
                    const totalPagar = Number(p.total_pagar || 0)
                    return (
                      <tr key={p.id}>
                        <td>{formatFechaLocal(p.fecha)}</td>
                        <td className="pagos-periodo">
                          {p.fecha_desde && p.fecha_hasta
                            ? `${formatFechaLocal(p.fecha_desde)} - ${formatFechaLocal(p.fecha_hasta)}`
                            : '-'}
                        </td>
                        <td>{p.lavadas_cantidad || 0}</td>
                        <td>{formatMoney(p.total)}</td>
                        <td className="valor-negativo">{formatMoney(p.descuentos)}</td>
                        <td>{formatMoney(totalPagar)}</td>
                        <td className="valor-positivo">
                          <strong>{formatMoney(valorPagado)}</strong>
                          {valorPagado < totalPagar && <span className="badge-parcial">Parcial</span>}
                          {valorPagado > totalPagar && <span className="badge-excede">Excede</span>}
                          {(p.abonos_detalle || []).length > 1 && <span className="badge-abonos">{(p.abonos_detalle || []).length} abonos</span>}
                        </td>
                        <td className={p.saldo_acumulado >= 0 ? 'saldo-favor' : 'saldo-pendiente'}>
                          <strong>{p.saldo_acumulado >= 0 ? '+' : ''}{formatMoney(p.saldo_acumulado)}</strong>
                        </td>
                      </tr>
                    )
                  })}
                  {pagosConSaldo.length === 0 && (
                    <tr><td colSpan="8" className="empty">Sin pagos registrados</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile: cards */}
          <div className="historial-detail-cards-mobile">
            {pagosConSaldo.map(p => {
              const valorPagado = p.valor_pagado != null && Number(p.valor_pagado) !== 0 ? Number(p.valor_pagado) : Number(p.total_pagar || 0)
              const totalPagar = Number(p.total_pagar || 0)
              const periodo = p.fecha_desde && p.fecha_hasta
                ? `${formatFechaLocal(p.fecha_desde)} - ${formatFechaLocal(p.fecha_hasta)}`
                : formatFechaLocal(p.fecha)
              return (
                <div key={p.id} className="pago-card">
                  <div className="pago-card-top">
                    <div className="pago-card-info">
                      <span className="pago-card-nombre">{formatFechaLocal(p.fecha)}</span>
                      <span className="pago-card-periodo">{periodo}</span>
                    </div>
                    <div className="pago-card-monto">
                      <span className="pago-card-total positivo">
                        {formatMoney(valorPagado)}
                      </span>
                      {valorPagado < totalPagar && <span className="badge-parcial">Parcial</span>}
                      {valorPagado > totalPagar && <span className="badge-excede">Excede</span>}
                      {(p.abonos_detalle || []).length > 1 && <span className="badge-abonos">{(p.abonos_detalle || []).length} abonos</span>}
                    </div>
                  </div>
                  <div className="pago-card-bottom">
                    <div className="pago-card-details">
                      <span>{p.lavadas_cantidad || 0} servicios</span>
                      <span>A pagar {formatMoney(totalPagar)}</span>
                      {Number(p.descuentos) > 0 && <span className="valor-negativo">-{formatMoney(p.descuentos)}</span>}
                    </div>
                    <div className={`historial-card-saldo-acum ${p.saldo_acumulado >= 0 ? 'saldo-favor' : 'saldo-pendiente'}`}>
                      Saldo: {p.saldo_acumulado >= 0 ? '+' : ''}{formatMoney(p.saldo_acumulado)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pagos anulados */}
          {w.pagos_anulados.length > 0 && (
            <div className="historial-anulados">
              <h4>Pagos Anulados ({w.pagos_anulados.length})</h4>
              {w.pagos_anulados.map(p => (
                <div key={p.id} className="pago-card anulado">
                  <div className="pago-card-top">
                    <div className="pago-card-info">
                      <span className="pago-card-nombre">{formatFechaLocal(p.fecha)}</span>
                      <span className="pago-card-periodo">
                        {p.fecha_desde && p.fecha_hasta
                          ? `${formatFechaLocal(p.fecha_desde)} - ${formatFechaLocal(p.fecha_hasta)}`
                          : '-'}
                      </span>
                    </div>
                    <div className="pago-card-monto">
                      <span>{formatMoney(p.total_pagar)}</span>
                      <span className="estado-badge inactivo">Anulado</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="pagos-page">
      <div className="clientes-title-row">
        <h1 className="page-title">Pago Trabajadores</h1>
        <button className="btn-primary desktop-only" onClick={() => { resetForm(); setEditandoId(null); setModalMinimized(false); setShowModal(true) }}>
          <Plus size={18} /> Agregar Pago
        </button>
      </div>

      <div className="clientes-search-row">
        <div className="search-box">
          <Search size={18} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Buscar trabajador..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => setSearchQuery('')}>
              <X size={16} />
            </button>
          )}
        </div>
        <div className="clientes-filter-wrapper">
          <button
            className={`clientes-filter-btn${filtroRapido !== 'mes' ? ' active' : ''}`}
            onClick={() => setShowFilterDropdown(prev => !prev)}
          >
            <SlidersHorizontal size={18} />
          </button>
          {showFilterDropdown && (
            <>
              <div className="clientes-filter-overlay" onClick={() => setShowFilterDropdown(false)} />
              <div className="clientes-filter-dropdown">
                <div className="cfd-section">
                  <span className="cfd-label">Período</span>
                  <div className="cfd-rapido">
                    <button className={`filter-btn ${filtroRapido === 'hoy' ? 'active' : ''}`} onClick={() => aplicarFiltroRapido('hoy')}>Día</button>
                    <button className={`filter-btn ${filtroRapido === 'semana' ? 'active' : ''}`} onClick={() => aplicarFiltroRapido('semana')}>Semana</button>
                    <button className={`filter-btn ${filtroRapido === 'mes' ? 'active' : ''}`} onClick={() => aplicarFiltroRapido('mes')}>Mes</button>
                    <button className={`filter-btn ${filtroRapido === 'año' ? 'active' : ''}`} onClick={() => aplicarFiltroRapido('año')}>Año</button>
                  </div>
                </div>
                <div className="cfd-section">
                  <span className="cfd-label">Rango de fechas</span>
                  <div className="cfd-dates">
                    <DatePicker
                      selected={filtroDesde}
                      onChange={(date) => { setFiltroDesde(date); setFiltroRapido('') }}
                      selectsStart
                      startDate={filtroDesde}
                      endDate={filtroHasta}
                      placeholderText="Desde"
                      className="filter-date"
                      dateFormat="dd/MM/yyyy"
                      locale="es"
                      isClearable
                    />
                    <span className="filter-separator">→</span>
                    <DatePicker
                      selected={filtroHasta}
                      onChange={(date) => { setFiltroHasta(date); setFiltroRapido('') }}
                      selectsEnd
                      startDate={filtroDesde}
                      endDate={filtroHasta}
                      minDate={filtroDesde}
                      placeholderText="Hasta"
                      className="filter-date"
                      dateFormat="dd/MM/yyyy"
                      locale="es"
                      isClearable
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="pagos-stats">
        <div className="pago-stat-card egresos">
          <div className="pago-stat-left">
            <DollarSign size={20} />
            <span>Total Pagado</span>
          </div>
          <span className="pago-stat-valor">{formatMoney(totalPagadoMes)}</span>
        </div>
        <div className="pago-stat-card balance positivo">
          <div className="pago-stat-left">
            <Hash size={20} />
            <span>Pagos Realizados</span>
          </div>
          <span className="pago-stat-valor">{pagosRealizados}</span>
        </div>
        <div className="pago-stat-card ingresos">
          <div className="pago-stat-left">
            <Users size={20} />
            <span>Trabajadores Pagados</span>
          </div>
          <span className="pago-stat-valor">{trabajadoresUnicos}</span>
        </div>
      </div>

      {/* Worker cards grid */}
      {filteredWorkerCards.length > 0 && (
        <>
        <h2 className="section-title">Trabajadores</h2>
        <div className="historial-workers-grid">
          {filteredWorkerCards.map(w => (
            <div
              key={w.lavador_id}
              className="historial-worker-card"
              onClick={() => handleWorkerClick(w)}
            >
              <div className="historial-worker-header">
                <div className="historial-worker-name">{w.nombre}</div>
              </div>
              <div className="historial-worker-stats">
                <div className="historial-worker-stat">
                  <span className="historial-stat-label">Ganado</span>
                  <span className="historial-stat-value">{formatMoney(w.total_ganado)}</span>
                </div>
                <div className="historial-worker-stat">
                  <span className="historial-stat-label">Por pagar</span>
                  <span className="historial-stat-value">{formatMoney(w.por_pagar)}</span>
                </div>
              </div>
              <div className={`historial-worker-saldo ${w.saldo >= 0 ? 'saldo-favor' : 'saldo-pendiente'}`}>
                {w.saldo >= 0 ? 'A favor: ' : 'Pendiente: '}
                <strong>{formatMoney(Math.abs(w.saldo))}</strong>
              </div>
            </div>
          ))}
        </div>
        </>
      )}

      <h2 className="section-title">Historial</h2>

      {/* Desktop: tabla */}
      <div className="card pagos-tabla-desktop">
        <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Trabajador</th>
              <th>Período</th>
              <th>Servicios</th>
              <th>Total</th>
              <th>Descuentos</th>
              <th>A Pagar</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredPagos.map((pago) => {
              const esAnulado = !!pago.anulado
              return (
                <tr key={pago.id} className={esAnulado ? 'fila-anulada' : ''}>
                  <td>{formatFechaLocal(pago.fecha)}</td>
                  <td>{pago.lavador?.nombre}</td>
                  <td className="pagos-periodo">{pago.fecha_desde && pago.fecha_hasta
                    ? `${formatFechaLocal(pago.fecha_desde)} - ${formatFechaLocal(pago.fecha_hasta)}`
                    : '-'}</td>
                  <td>{pago.lavadas_cantidad || 0}</td>
                  <td>{formatMoney(pago.total)}</td>
                  <td className="valor-negativo">
                    {formatMoney(pago.descuentos)}
                    {(pago.descuentos_detalle || []).length > 0 && (
                      <span className="descuento-conceptos">
                        {(pago.descuentos_detalle || []).map(d => d.concepto).filter(Boolean).join(', ')}
                      </span>
                    )}
                  </td>
                  <td className={esAnulado ? '' : 'valor-positivo'}>
                    <strong>{formatMoney(pago.valor_pagado != null && Number(pago.valor_pagado) !== 0 ? pago.valor_pagado : pago.total_pagar)}</strong>
                    {!esAnulado && pago.valor_pagado != null && Number(pago.valor_pagado) !== 0 && Number(pago.valor_pagado) < Number(pago.total_pagar) && (
                      <span className="badge-parcial">Parcial</span>
                    )}
                    {!esAnulado && pago.valor_pagado != null && Number(pago.valor_pagado) > Number(pago.total_pagar) && (
                      <span className="badge-excede">Excede</span>
                    )}
                  </td>
                  <td className="acciones-cell">
                    {esAnulado ? (
                      <span className="estado-badge inactivo">Anulado</span>
                    ) : (
                      <div className="acciones">
                        <button className="btn-icon" onClick={() => handleEditar(pago)} title="Editar"><Pencil size={16} /></button>
                        <button className="btn-icon delete" onClick={() => requestAnularPago(pago)} title="Anular"><Trash2 size={16} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
            {filteredPagos.length === 0 && (
              <tr>
                <td colSpan="8" className="empty">No hay pagos registrados en este período</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Mobile: cards */}
      <div className="pagos-cards-mobile">
        {filteredPagos.length === 0 && (
          <div className="clientes-cards-empty">No hay pagos registrados en este período</div>
        )}
        {filteredPagos.map((pago) => {
          const esAnulado = !!pago.anulado
          const periodo = pago.fecha_desde && pago.fecha_hasta
            ? `${formatFechaLocal(pago.fecha_desde)} - ${formatFechaLocal(pago.fecha_hasta)}`
            : formatFechaLocal(pago.fecha)
          return (
            <div key={pago.id} className={`pago-card ${esAnulado ? 'anulado' : ''}`}>
              <div className="pago-card-top">
                <div className="pago-card-info">
                  <span className="pago-card-nombre">{pago.lavador?.nombre}</span>
                  <span className="pago-card-periodo">{periodo}</span>
                </div>
                <div className="pago-card-monto">
                  <span className={`pago-card-total ${esAnulado ? '' : 'positivo'}`}>
                    {formatMoney(pago.valor_pagado != null && Number(pago.valor_pagado) !== 0 ? pago.valor_pagado : pago.total_pagar)}
                  </span>
                  {!esAnulado && pago.valor_pagado != null && Number(pago.valor_pagado) !== 0 && Number(pago.valor_pagado) < Number(pago.total_pagar) && (
                    <span className="badge-parcial">Parcial</span>
                  )}
                  {!esAnulado && pago.valor_pagado != null && Number(pago.valor_pagado) > Number(pago.total_pagar) && (
                    <span className="badge-excede">Excede</span>
                  )}
                  {esAnulado && <span className="estado-badge inactivo">Anulado</span>}
                </div>
              </div>
              <div className="pago-card-bottom">
                <div className="pago-card-details">
                  <span>{pago.lavadas_cantidad || 0} servicios</span>
                  <span>Total {formatMoney(pago.total)}</span>
                  {pago.descuentos > 0 && <span className="valor-negativo">-{formatMoney(pago.descuentos)}</span>}
                </div>
                {!esAnulado && (
                  <div className="acciones">
                    <button className="btn-icon" onClick={() => handleEditar(pago)} title="Editar"><Pencil size={16} /></button>
                    <button className="btn-icon delete" onClick={() => requestAnularPago(pago)} title="Anular"><Trash2 size={16} /></button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <button
        className="home-fab"
        onClick={() => { resetForm(); setEditandoId(null); setModalMinimized(false); setShowModal(true) }}
      >
        <Plus size={28} />
      </button>

      {showModal && !modalMinimized && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>{editandoId ? 'Editar Pago' : 'Nuevo Pago'}</h2>
              <div className="pago-modal-header-actions">
                <button className="btn-close" onClick={() => setModalMinimized(true)} title="Minimizar">
                  <Minus size={20} />
                </button>
                <button className="btn-close" onClick={() => { setShowModal(false); setModalMinimized(false); setEditandoId(null); resetForm() }} title="Descartar">
                  <X size={24} />
                </button>
              </div>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group cliente-search-group">
                  <label>Trabajador</label>
                  <div className="cliente-search-wrapper" ref={trabajadorWrapperRef}>
                    <input
                      type="text"
                      value={trabajadorSearch}
                      onChange={(e) => {
                        setTrabajadorSearch(e.target.value)
                        setShowTrabajadorDropdown(true)
                        if (!e.target.value) {
                          handleChange('lavador_id', '')
                        }
                      }}
                      onFocus={() => { if (!formData.lavador_id) setShowTrabajadorDropdown(true) }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setShowTrabajadorDropdown(false)
                          e.target.blur()
                        }
                      }}
                      placeholder="Buscar trabajador..."
                      autoComplete="off"
                    />
                    {formData.lavador_id && (
                      <button type="button" className="cliente-search-clear" onClick={handleClearTrabajador}>
                        <X size={14} />
                      </button>
                    )}
                    {showTrabajadorDropdown && !formData.lavador_id && !showNuevoTrabajador && (
                      <div className="cliente-search-dropdown">
                        {(() => {
                          const q = trabajadorSearch.toLowerCase().trim()
                          const filtered = lavadoresParaSelector.filter(l =>
                            !q || l.nombre?.toLowerCase().includes(q)
                          )
                          return (
                            <>
                              {filtered.slice(0, 8).map(l => (
                                <div
                                  key={l.id}
                                  className="cliente-search-option"
                                  onMouseDown={() => handleSelectTrabajador(l)}
                                >
                                  <span className="cliente-search-nombre">{l.nombre}</span>
                                  {l.tipo_pago && <span className="cliente-search-tag">{tipoPagoLabel(l.tipo_pago)}</span>}
                                </div>
                              ))}
                              {filtered.length === 0 && (
                                <div className="cliente-search-empty">No se encontraron trabajadores</div>
                              )}
                              <div className="cliente-search-add">
                                <button
                                  type="button"
                                  className="btn-nuevo-cliente-inline"
                                  onMouseDown={() => {
                                    setNuevoTrabajadorNombre(trabajadorSearch.trim())
                                    setShowNuevoTrabajador(true)
                                    setShowTrabajadorDropdown(false)
                                  }}
                                >
                                  <Plus size={14} /> Agregar trabajador
                                </button>
                              </div>
                            </>
                          )
                        })()}
                      </div>
                    )}
                    {showNuevoTrabajador && (
                      <div className="nuevo-cliente-inline">
                        <div className="nuevo-cliente-inline-header">
                          <span>Nuevo trabajador</span>
                          <button type="button" onClick={() => setShowNuevoTrabajador(false)}><X size={14} /></button>
                        </div>
                        <input
                          type="text"
                          placeholder="Nombre"
                          value={nuevoTrabajadorNombre}
                          onChange={(e) => setNuevoTrabajadorNombre(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCrearTrabajador() } }}
                        />
                        {nuevoTrabajadorNombre.trim() && lavadores.some(l => l.nombre?.trim().toLowerCase() === nuevoTrabajadorNombre.trim().toLowerCase()) && (
                          <span className="cliente-ya-existe-warning">Trabajador ya existe</span>
                        )}
                        <button
                          type="button"
                          className="btn-nuevo-cliente-inline"
                          onClick={handleCrearTrabajador}
                          disabled={!nuevoTrabajadorNombre.trim()}
                        >
                          <Plus size={14} /> Crear trabajador
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {renderAutoForm()}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setModalMinimized(true)}>
                  Minimizar
                </button>
                <button type="button" className="btn-secondary btn-descartar" onClick={() => { setShowModal(false); setModalMinimized(false); setEditandoId(null); resetForm() }}>
                  Descartar
                </button>
                <button type="submit" className="btn-primary">
                  {editandoId ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal && modalMinimized && (
        <button
          className="floating-resume-btn"
          onClick={() => setModalMinimized(false)}
        >
          <DollarSign size={18} />
          Continuar pago...
        </button>
      )}

      {selectedWorker && renderWorkerDetailModal()}

      <ConfirmDeleteModal
        isOpen={!!pendingAnularPago}
        onClose={() => setPendingAnularPago(null)}
        onConfirm={executeAnularPago}
        message={`Se anulará el pago de ${pendingAnularPago?.lavador?.nombre || 'este trabajador'}. Ingresa tu contraseña para confirmar.`}
      />
    </div>
  )
}
