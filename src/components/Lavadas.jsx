import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { useData } from './DataContext'
import { Plus, Search, X, MessageCircle, Calendar, Trash2, ChevronDown, SlidersHorizontal, CheckCircle2 } from 'lucide-react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { registerLocale } from 'react-datepicker'
import es from 'date-fns/locale/es'

registerLocale('es', es)

export default function Lavadas() {
  const { lavadas, clientes, tiposLavado, lavadores, metodosPago, serviciosAdicionales, loading, updateLavadaLocal, addLavadaLocal, deleteLavadaLocal, negocioId } = useData()

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
    } catch {}
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
  const [expandedCards, setExpandedCards] = useState({})
  const [showFilters, setShowFilters] = useState(false)
  const [now, setNow] = useState(new Date())
  const [editingPago, setEditingPago] = useState(null)
  const [validationErrors, setValidationErrors] = useState({})
  const [collapsingCards, setCollapsingCards] = useState({})

  const smoothCollapse = (lavadaId) => {
    setCollapsingCards(prev => ({ ...prev, [lavadaId]: true }))
    setTimeout(() => {
      setExpandedCards(prev => ({ ...prev, [lavadaId]: false }))
      setCollapsingCards(prev => { const n = { ...prev }; delete n[lavadaId]; return n })
    }, 350)
  }

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

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const formatSeg = (totalSeg) => {
    const seg = Math.max(0, Math.floor(totalSeg))
    const h = Math.floor(seg / 3600)
    const m = Math.floor((seg % 3600) / 60)
    const s = seg % 60
    if (h > 0) return `${h}h ${m}m ${s}s`
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
  }

  const getTiempoEspera = (lavada) => {
    if (lavada.duracion_espera != null) return formatSeg(lavada.duracion_espera)
    if (lavada.estado === 'EN ESPERA' && lavada.tiempo_espera_inicio) return formatSeg((now - new Date(lavada.tiempo_espera_inicio)) / 1000)
    return '0s'
  }

  const getTiempoLavado = (lavada) => {
    if (lavada.duracion_lavado != null) return formatSeg(lavada.duracion_lavado)
    if (lavada.estado === 'EN LAVADO' && lavada.tiempo_lavado_inicio) return formatSeg((now - new Date(lavada.tiempo_lavado_inicio)) / 1000)
    return '0s'
  }

  const getTiempoTerminado = (lavada) => {
    if (lavada.duracion_terminado != null) return formatSeg(lavada.duracion_terminado)
    if (lavada.estado === 'TERMINADO' && lavada.tiempo_terminado_inicio) return formatSeg((now - new Date(lavada.tiempo_terminado_inicio)) / 1000)
    return '0s'
  }

  const getTimerActivo = (lavada) => {
    if (lavada.estado === 'EN ESPERA') return getTiempoEspera(lavada)
    if (lavada.estado === 'EN LAVADO') return getTiempoLavado(lavada)
    if (lavada.estado === 'TERMINADO') return getTiempoTerminado(lavada)
    return null
  }

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

  const calcularValor = (tipoId, adicionales) => {
    const tipo = tiposLavado.find(t => t.id == tipoId)
    let total = tipo?.precio || 0
    const incluidos = tipo?.adicionales_incluidos || []
    if (adicionales && adicionales.length > 0) {
      total += adicionales
        .filter(a => !incluidos.includes(a.id))
        .reduce((sum, a) => sum + (a.precio || 0), 0)
    }
    return total
  }

  const autoAddIncluidos = (tipo, adicionalesActuales) => {
    const incluidos = tipo?.adicionales_incluidos || []
    const nuevos = [...adicionalesActuales]
    incluidos.forEach(id => {
      if (!nuevos.some(a => a.id === id)) {
        const s = serviciosAdicionales.find(s => s.id === id)
        if (s) nuevos.push({ id: s.id, nombre: s.nombre, precio: s.precio })
      }
    })
    return nuevos
  }

  const handleClienteChange = (clienteId) => {
    const cliente = clientes.find(c => c.id == clienteId)
    if (cliente) {
      const tipo = detectarTipoLavado(cliente)
      const tipoId = tipo?.id || ''
      const adicionales = autoAddIncluidos(tipo, formData.adicionales)
      const valor = calcularValor(tipoId, adicionales)

      setFormData(prev => ({
        ...prev,
        cliente_id: clienteId,
        placa: cliente.placa || '',
        tipo_lavado_id: tipoId,
        adicionales,
        valor
      }))
    } else {
      setFormData(prev => ({ ...prev, cliente_id: clienteId, placa: '', tipo_lavado_id: '', valor: 0 }))
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
        nuevosAdicionales = [...prev.adicionales, { id: servicio.id, nombre: servicio.nombre, precio: servicio.precio }]
      } else {
        nuevosAdicionales = prev.adicionales.filter(a => a.id !== servicio.id)
      }
      const valor = calcularValor(prev.tipo_lavado_id, nuevosAdicionales)
      return { ...prev, adicionales: nuevosAdicionales, valor }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

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

  const handleEstadoChange = async (lavadaId, nuevoEstado) => {
    const lavada = lavadas.find(l => l.id === lavadaId)
    if (lavada.estado === nuevoEstado) return
    const estadoAnterior = lavada.estado
    const ahora = new Date()
    const ahoraISO = ahora.toISOString()
    let updates = { estado: nuevoEstado }

    // Si vuelve a ESPERA: reset total
    if (nuevoEstado === 'EN ESPERA') {
      updates.tiempo_espera_inicio = ahoraISO
      updates.duracion_espera = null
      updates.tiempo_lavado_inicio = null
      updates.duracion_lavado = null
      updates.tiempo_terminado_inicio = null
      updates.duracion_terminado = null
    } else {
      // Cerrar duración del estado anterior
      if (estadoAnterior === 'EN ESPERA' && lavada.tiempo_espera_inicio) {
        updates.duracion_espera = Math.round((ahora - new Date(lavada.tiempo_espera_inicio)) / 1000)
      }
      if (estadoAnterior === 'EN LAVADO' && lavada.tiempo_lavado_inicio) {
        updates.duracion_lavado = Math.round((ahora - new Date(lavada.tiempo_lavado_inicio)) / 1000)
      }
      if (estadoAnterior === 'TERMINADO' && lavada.tiempo_terminado_inicio) {
        updates.duracion_terminado = Math.round((ahora - new Date(lavada.tiempo_terminado_inicio)) / 1000)
      }

      // Abrir timestamp del nuevo estado
      if (nuevoEstado === 'EN LAVADO') {
        updates.tiempo_lavado_inicio = ahoraISO
        updates.duracion_lavado = null
      }
      if (nuevoEstado === 'TERMINADO') {
        updates.tiempo_terminado_inicio = ahoraISO
        updates.duracion_terminado = null
      }
    }

    updateLavadaLocal(lavadaId, updates)

    await supabase
      .from('lavadas')
      .update(updates)
      .eq('id', lavadaId)
  }

  const handleLavadorChange = async (lavadaId, lavadorId) => {
    const lavador = lavadores.find(l => l.id == lavadorId)
    updateLavadaLocal(lavadaId, { lavador_id: lavadorId, lavador })

    await supabase
      .from('lavadas')
      .update({ lavador_id: lavadorId || null })
      .eq('id', lavadaId)
  }

  const handleTipoLavadoChangeInline = async (lavadaId, tipoId) => {
    const tipo = tiposLavado.find(t => t.id == tipoId)
    const lavada = lavadas.find(l => l.id === lavadaId)
    const nuevosAdicionales = autoAddIncluidos(tipo, lavada.adicionales || [])

    const nuevoValor = calcularValor(tipoId, nuevosAdicionales)

    updateLavadaLocal(lavadaId, {
      tipo_lavado_id: tipoId,
      tipo_lavado: tipo,
      adicionales: nuevosAdicionales,
      valor: nuevoValor
    })

    await supabase
      .from('lavadas')
      .update({ tipo_lavado_id: tipoId, adicionales: nuevosAdicionales, valor: nuevoValor })
      .eq('id', lavadaId)
  }

  const handlePagosChange = async (lavadaId, nuevosPagos) => {
    const metodoCompatible = nuevosPagos.length > 0 ? nuevosPagos[0].metodo_pago_id : null
    updateLavadaLocal(lavadaId, { pagos: nuevosPagos, metodo_pago_id: metodoCompatible })

    await supabase
      .from('lavadas')
      .update({ pagos: nuevosPagos, metodo_pago_id: metodoCompatible })
      .eq('id', lavadaId)
  }

  const handleAdicionalChange = async (lavadaId, servicio, checked) => {
    const lavada = lavadas.find(l => l.id === lavadaId)
    const adicionalesActuales = lavada.adicionales || []

    let nuevosAdicionales
    if (checked) {
      nuevosAdicionales = [...adicionalesActuales, { id: servicio.id, nombre: servicio.nombre, precio: servicio.precio }]
    } else {
      nuevosAdicionales = adicionalesActuales.filter(a => a.id !== servicio.id)
    }

    const nuevoValor = calcularValor(lavada.tipo_lavado_id, nuevosAdicionales)

    updateLavadaLocal(lavadaId, {
      adicionales: nuevosAdicionales,
      valor: nuevoValor
    })

    await supabase
      .from('lavadas')
      .update({ adicionales: nuevosAdicionales, valor: nuevoValor })
      .eq('id', lavadaId)
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

  const handleEliminarLavada = async (lavadaId) => {
    if (confirm('¿Estás seguro de eliminar esta lavada?')) {
      await supabase
        .from('lavadas')
        .delete()
        .eq('id', lavadaId)

      deleteLavadaLocal(lavadaId)
    }
  }

  const enviarWhatsApp = (lavada) => {
  const cliente = clientes.find(c => c.id == lavada.cliente_id)
  if (!cliente?.telefono) {
    alert('El cliente no tiene número de teléfono registrado')
    return
  }

  const telefono = cliente.telefono.replace(/\D/g, '')
  const mensaje = `Hola ${cliente.nombre}, tu moto de placa *${lavada.placa}* ya está lista. ¡Puedes venir a recogerla! 🏍️`
  const url = `https://api.whatsapp.com/send?phone=57${telefono}&text=${encodeURIComponent(mensaje)}`

  window.open(url, '_blank')
}

  const formatMoney = (value) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value)
  }

  const getEstadoClass = (estado) => {
  const clases = {
    'EN ESPERA': 'estado-espera',
    'EN LAVADO': 'estado-lavado',
    'TERMINADO': 'estado-terminado',
    'ENTREGADO': 'estado-entregado'
  }
  return clases[estado] || ''
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

  const totalFiltrado = lavadasFiltradas.reduce((sum, l) => sum + (l.valor || 0), 0)
  const cantidadFiltrada = lavadasFiltradas.length

  if (loading) {
    return <div className="loading">Cargando...</div>
  }

  return (
    <div className="lavadas-page">
      <div className="page-header">
        <h1 className="page-title">Lavadas <span className="total-hoy">({cantidadFiltrada} - {formatMoney(totalFiltrado)})</span></h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={20} />
          Nueva Lavada
        </button>
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
          <select
            value={filtroLavador}
            onChange={(e) => setFiltroLavador(e.target.value)}
            className="filter-select"
          >
            <option value="">Lavador</option>
            {lavadores.map(l => (
              <option key={l.id} value={l.id}>{l.nombre}</option>
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

      <div className="lavadas-cards">
        {lavadasFiltradas.length === 0 && (
          <div className="empty-card">No hay lavadas registradas</div>
        )}
        {lavadasFiltradas.map((lavada) => {
          const pagos = lavada.pagos || []
          const isExpanded = expandedCards[lavada.id]
          const estadoLabels = { 'EN ESPERA': 'Espera', 'EN LAVADO': 'Lavando', 'TERMINADO': 'Terminado', 'ENTREGADO': 'Entregado' }
          const vErrs = validationErrors[lavada.id] || {}
          const isCollapsing = collapsingCards[lavada.id]
          const showBody = isExpanded || isCollapsing
          return (
            <div key={lavada.id} className={`lavada-card ${getEstadoClass(lavada.estado)}-border ${isExpanded && !isCollapsing ? 'expanded' : ''}`}>
              <div
                className="lavada-card-header"
                onClick={() => setExpandedCards(prev => ({ ...prev, [lavada.id]: !prev[lavada.id] }))}
              >
                <div className="lavada-card-cliente">
                  <span className="lavada-card-nombre">{lavada.cliente?.nombre || 'No encontrado'}</span>
                  <span className="lavada-card-placa">{lavada.placa}</span>
                </div>
                <div className="lavada-card-summary">
                  <span className={`estado-badge-mini ${getEstadoClass(lavada.estado)}`}>{estadoLabels[lavada.estado] || lavada.estado}</span>
                  {getTimerActivo(lavada) && (
                    <span className={`lavada-card-timer ${getEstadoClass(lavada.estado)}`}>{getTimerActivo(lavada)}</span>
                  )}
                  <span className="lavada-card-valor-mini">{formatMoney(lavada.valor)}</span>
                  <ChevronDown size={16} className={`lavada-card-chevron ${isExpanded ? 'rotated' : ''}`} />
                </div>
              </div>

              {showBody && (
                <div className={`lavada-card-body ${isCollapsing ? 'collapsing' : ''}`}>
                  <div className="estado-flow">
                    <button
                      className={`estado-step-btn estado-espera-bg ${lavada.estado === 'EN ESPERA' ? 'active' : ''}`}
                      onClick={(e) => { e.stopPropagation(); handleEstadoChange(lavada.id, 'EN ESPERA') }}
                    >
                      <span className="estado-step-label">Espera</span>
                      <span className="estado-step-time">{getTiempoEspera(lavada)}</span>
                    </button>
                    <button
                      className={`estado-step-btn estado-lavado-bg ${lavada.estado === 'EN LAVADO' ? 'active' : ''}`}
                      onClick={(e) => { e.stopPropagation(); handleEstadoChange(lavada.id, 'EN LAVADO') }}
                    >
                      <span className="estado-step-label">Lavado</span>
                      <span className="estado-step-time">{getTiempoLavado(lavada)}</span>
                    </button>
                    <button
                      className={`estado-step-btn estado-terminado-bg ${lavada.estado === 'TERMINADO' ? 'active' : ''}`}
                      onClick={(e) => { e.stopPropagation(); handleEstadoChange(lavada.id, 'TERMINADO') }}
                    >
                      <span className="estado-step-label">Terminado</span>
                      <span className="estado-step-time">{getTiempoTerminado(lavada)}</span>
                    </button>
                    <button
                      className={`estado-step-btn estado-entregado-bg ${lavada.estado === 'ENTREGADO' ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        const p = lavada.pagos || []
                        const suma = p.reduce((s, pg) => s + (Number(pg.valor) || 0), 0)
                        const totalVal = lavada.valor || 0
                        const allMetodos = p.length === 0 || p.every(pg => pg.metodo_pago_id)
                        const pagosValid = totalVal === 0 ? (p.length === 0 || suma === totalVal) : (p.length > 0 && suma === totalVal)
                        const errs = {}
                        if (!lavada.tipo_lavado_id) errs.tipo = true
                        if (!lavada.lavador_id) errs.lavador = true
                        if (!pagosValid || !allMetodos) errs.pagos = true
                        if (Object.keys(errs).length > 0) {
                          setValidationErrors(prev => ({ ...prev, [lavada.id]: errs }))
                          setTimeout(() => setValidationErrors(prev => { const n = { ...prev }; delete n[lavada.id]; return n }), 2000)
                          return
                        }
                        handleEstadoChange(lavada.id, 'ENTREGADO')
                        smoothCollapse(lavada.id)
                      }}
                    >
                      <span className="estado-step-label">Entregado</span>
                    </button>
                  </div>

                  <div className="lavada-card-tipo-adic">
                    <div className="lavada-card-field">
                      <label>Tipo</label>
                      <select
                        value={lavada.tipo_lavado_id || ''}
                        onChange={(e) => handleTipoLavadoChangeInline(lavada.id, e.target.value)}
                        className={`tipo-lavado-select ${vErrs.tipo ? 'field-error' : ''}`}
                      >
                        <option value="">Seleccionar</option>
                        {tiposLavado.map(t => (
                          <option key={t.id} value={t.id}>{t.nombre}</option>
                        ))}
                      </select>
                    </div>

                    {serviciosAdicionales.length > 0 && (
                      <div className="lavada-card-adicionales">
                        <label>Adicionales</label>
                        <div className="lavada-card-checks">
                          {serviciosAdicionales.map(s => {
                            const adicionalesLavada = lavada.adicionales || []
                            const checked = adicionalesLavada.some(a => a.id === s.id)
                            return (
                              <label key={s.id} className="adicional-check">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => handleAdicionalChange(lavada.id, s, e.target.checked)}
                                />
                                <span>{s.nombre}</span>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="lavada-card-row">
                    <div className="lavada-card-field full">
                      <label>Lavador</label>
                      <select
                        value={lavada.lavador_id || ''}
                        onChange={(e) => handleLavadorChange(lavada.id, e.target.value)}
                        className={`lavador-select ${vErrs.lavador ? 'field-error' : ''}`}
                      >
                        <option value="">Sin asignar</option>
                        {lavadores.map(l => (
                          <option key={l.id} value={l.id}>{l.nombre}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {(() => {
                    const sumaPagos = pagos.reduce((s, p) => s + (Number(p.valor) || 0), 0)
                    const total = lavada.valor || 0
                    const diff = sumaPagos - total
                    const pagosOk = total === 0 ? (pagos.length === 0 || sumaPagos === total) : (pagos.length > 0 && sumaPagos === total)
                    const allMetodosSet = pagos.length === 0 || pagos.every(p => p.metodo_pago_id)
                    const tipoOk = !!lavada.tipo_lavado_id
                    const lavadorOk = !!lavada.lavador_id
                    const canComplete = pagosOk && allMetodosSet && tipoOk && lavadorOk
                    const isEditingThisLavada = editingPago?.lavadaId === lavada.id
                    const yaEntregado = lavada.estado === 'ENTREGADO'

                    let completarTooltip = ''
                    if (!tipoOk) completarTooltip = 'Falta tipo de lavado'
                    else if (!lavadorOk) completarTooltip = 'Falta asignar lavador'
                    else if (pagos.length === 0) completarTooltip = 'Agrega al menos un pago'
                    else if (!allMetodosSet) completarTooltip = 'Todos los pagos necesitan método'
                    else if (!pagosOk) completarTooltip = diff > 0 ? `Pagos exceden ${formatMoney(diff)}` : `Faltan ${formatMoney(Math.abs(diff))}`

                    return (
                      <div className="lavada-card-footer">
                        <div className={`lavada-card-valor ${pagos.length > 0 ? (pagosOk ? 'pago-ok' : 'pago-error') : ''}`}>
                          {formatMoney(total)}
                        </div>
                        <div className={`lavada-card-pagos-pills ${vErrs.pagos ? 'field-error' : ''}`}>
                          {pagos.length === 0 && lavada.metodo_pago?.nombre && (
                            <span className="pago-pill legacy">{lavada.metodo_pago.nombre}</span>
                          )}
                          {pagos.map((p, idx) => {
                            const isEditing = isEditingThisLavada && editingPago.idx === idx
                            const metodoNombre = p.nombre || metodosPago.find(m => m.id == p.metodo_pago_id)?.nombre

                            if (isEditing || !p.metodo_pago_id) {
                              return (
                                <div key={idx} className="pago-pill editing">
                                  <select
                                    value={p.metodo_pago_id || ''}
                                    onChange={(e) => {
                                      const metodo = metodosPago.find(m => m.id == e.target.value)
                                      const nuevosPagos = pagos.map((pg, i) =>
                                        i === idx ? { ...pg, metodo_pago_id: e.target.value, nombre: metodo?.nombre || '' } : pg
                                      )
                                      handlePagosChange(lavada.id, nuevosPagos)
                                      if (e.target.value && p.valor > 0) setEditingPago(null)
                                    }}
                                    className="pago-pill-select"
                                    autoFocus
                                  >
                                    <option value="">Método</option>
                                    {metodosPago.map(m => (
                                      <option key={m.id} value={m.id}>{m.nombre}</option>
                                    ))}
                                  </select>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={p.valor === 0 ? '' : Number(p.valor).toLocaleString('es-CO')}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/\D/g, '')
                                      const nuevosPagos = pagos.map((pg, i) =>
                                        i === idx ? { ...pg, valor: val === '' ? 0 : Number(val) } : pg
                                      )
                                      handlePagosChange(lavada.id, nuevosPagos)
                                    }}
                                    onKeyDown={(e) => { if (e.key === 'Enter' && p.metodo_pago_id) setEditingPago(null) }}
                                    className="pago-pill-input"
                                    placeholder="$0"
                                  />
                                  <button
                                    className="pago-pill-x"
                                    onClick={() => {
                                      const nuevosPagos = pagos.filter((_, i) => i !== idx)
                                      handlePagosChange(lavada.id, nuevosPagos)
                                      setEditingPago(null)
                                    }}
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              )
                            }

                            return (
                              <div
                                key={idx}
                                className="pago-pill"
                                onClick={() => setEditingPago({ lavadaId: lavada.id, idx })}
                              >
                                <span className="pago-pill-metodo">{metodoNombre}</span>
                                <span className="pago-pill-valor">{formatMoney(p.valor)}</span>
                                <button
                                  className="pago-pill-x"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    const nuevosPagos = pagos.filter((_, i) => i !== idx)
                                    handlePagosChange(lavada.id, nuevosPagos)
                                  }}
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            )
                          })}
                          <button
                            className="pago-pill-add"
                            onClick={() => {
                              const restante = total - sumaPagos
                              const nuevosPagos = [...pagos, { metodo_pago_id: '', nombre: '', valor: restante > 0 ? restante : 0 }]
                              handlePagosChange(lavada.id, nuevosPagos)
                              setEditingPago({ lavadaId: lavada.id, idx: pagos.length })
                            }}
                          >
                            <Plus size={14} />
                          </button>
                          {pagos.length > 0 && !pagosOk && (
                            <span className="pago-diff-msg">
                              {diff > 0
                                ? `Excede ${formatMoney(diff)}`
                                : `Falta ${formatMoney(Math.abs(diff))}`}
                            </span>
                          )}
                        </div>
                        <div className="lavada-card-actions">
                          <button
                            className="btn-whatsapp"
                            onClick={() => enviarWhatsApp(lavada)}
                            title="Enviar WhatsApp"
                            disabled={!pagosOk}
                          >
                            <MessageCircle size={18} />
                          </button>
                          <button
                            className="btn-eliminar-card"
                            onClick={() => handleEliminarLavada(lavada.id)}
                            title="Eliminar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <button
                          className={`btn-completar-servicio ${yaEntregado ? 'completado' : ''} ${!canComplete && !yaEntregado ? 'error' : ''}`}
                          title={yaEntregado ? 'Servicio entregado' : (canComplete ? 'Marcar como completado' : completarTooltip)}
                          onClick={() => {
                            if (yaEntregado) return
                            if (!canComplete) {
                              const errs = {}
                              if (!tipoOk) errs.tipo = true
                              if (!lavadorOk) errs.lavador = true
                              if (!pagosOk || !allMetodosSet) errs.pagos = true
                              setValidationErrors(prev => ({ ...prev, [lavada.id]: errs }))
                              setTimeout(() => setValidationErrors(prev => { const n = { ...prev }; delete n[lavada.id]; return n }), 2000)
                              return
                            }
                            handleEstadoChange(lavada.id, 'ENTREGADO')
                            smoothCollapse(lavada.id)
                          }}
                        >
                          <CheckCircle2 size={16} />
                          {yaEntregado ? 'Completado' : 'Completar'}
                        </button>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Nueva Lavada</h2>
              <button className="btn-close" onClick={() => setShowModal(false)}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Placa</label>
                  <input
                    type="text"
                    value={formData.placa}
                    onChange={(e) => handlePlacaSearch(e.target.value.toUpperCase())}
                    placeholder="ABC123"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Cliente</label>
                  <select
                    value={formData.cliente_id}
                    onChange={(e) => handleClienteChange(e.target.value)}
                  >
                    <option value="">Seleccionar cliente</option>
                    {clientes.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.nombre} - {c.placa} {!clienteTieneMembresia(c) ? '(Sin membresia)' : ''}
                      </option>
                    ))}
                  </select>
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
                  Guardar Lavada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
