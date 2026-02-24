import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useData } from '../components/DataContext'
import { useToast } from '../components/Toast'
import { ESTADO_CLASSES } from '../config/constants'

export function useServiceHandlers() {
  const {
    lavadas, clientes, tiposLavado, lavadores, metodosPago, serviciosAdicionales,
    updateLavadaLocal, deleteLavadaLocal, plantillasMensaje, negocioId
  } = useData()
  const toast = useToast()

  const [expandedCards, setExpandedCards] = useState({})
  const [editingPago, setEditingPago] = useState(null)
  const [validationErrors, setValidationErrors] = useState({})
  const [collapsingCards, setCollapsingCards] = useState({})
  const [updatingCards, setUpdatingCards] = useState(new Set())

  const smoothCollapse = (lavadaId) => {
    setCollapsingCards(prev => ({ ...prev, [lavadaId]: true }))
    setTimeout(() => {
      setExpandedCards(prev => ({ ...prev, [lavadaId]: false }))
      setCollapsingCards(prev => { const n = { ...prev }; delete n[lavadaId]; return n })
    }, 350)
  }

  const withCardUpdate = async (lavadaId, fn) => {
    setUpdatingCards(prev => new Set(prev).add(lavadaId))
    try {
      await fn()
    } finally {
      setUpdatingCards(prev => { const next = new Set(prev); next.delete(lavadaId); return next })
    }
  }

  const getTimerProps = (lavada, tipo) => {
    if (tipo === 'espera') {
      if (lavada.duracion_espera != null) return { duration: lavada.duracion_espera }
      if (lavada.estado === 'EN ESPERA' && lavada.tiempo_espera_inicio) return { startTime: lavada.tiempo_espera_inicio }
      return { duration: 0 }
    }
    if (tipo === 'lavado') {
      if (lavada.duracion_lavado != null) return { duration: lavada.duracion_lavado }
      if (lavada.estado === 'EN LAVADO' && lavada.tiempo_lavado_inicio) return { startTime: lavada.tiempo_lavado_inicio }
      return { duration: 0 }
    }
    if (tipo === 'terminado') {
      if (lavada.duracion_terminado != null) return { duration: lavada.duracion_terminado }
      if (lavada.estado === 'TERMINADO' && lavada.tiempo_terminado_inicio) return { startTime: lavada.tiempo_terminado_inicio }
      return { duration: 0 }
    }
    return { duration: 0 }
  }

  const hasActiveTimer = (lavada) => {
    return lavada.estado === 'EN ESPERA' || lavada.estado === 'EN LAVADO' || lavada.estado === 'TERMINADO'
  }

  const getEstadoClass = (estado) => ESTADO_CLASSES[estado] || ''

  const calcularValor = (tipoId, adicionales) => {
    const tipo = tiposLavado.find(t => t.id == tipoId)
    let total = Number(tipo?.precio || 0)
    const incluidos = tipo?.adicionales_incluidos || []
    if (adicionales && adicionales.length > 0) {
      total += adicionales
        .filter(a => !incluidos.includes(a.id))
        .reduce((sum, a) => sum + Number(a.precio || 0), 0)
    }
    return total
  }

  const autoAddIncluidos = (tipo, adicionalesActuales) => {
    const incluidos = tipo?.adicionales_incluidos || []
    const nuevos = [...adicionalesActuales]
    incluidos.forEach(id => {
      if (!nuevos.some(a => a.id === id)) {
        const s = serviciosAdicionales.find(s => s.id === id)
        if (s) nuevos.push({ id: s.id, nombre: s.nombre, precio: Number(s.precio) })
      }
    })
    return nuevos
  }

  const handleEstadoChange = async (lavadaId, nuevoEstado) => {
    const lavada = lavadas.find(l => l.id === lavadaId)
    if (lavada.estado === nuevoEstado) return
    await withCardUpdate(lavadaId, async () => {
      const estadoAnterior = lavada.estado
      const ahora = new Date()
      const ahoraISO = ahora.toISOString()
      let updates = { estado: nuevoEstado }

      if (nuevoEstado === 'EN ESPERA') {
        updates.tiempo_espera_inicio = ahoraISO
        updates.duracion_espera = null
        updates.tiempo_lavado_inicio = null
        updates.duracion_lavado = null
        updates.tiempo_terminado_inicio = null
        updates.duracion_terminado = null
      } else {
        if (estadoAnterior === 'EN ESPERA' && lavada.tiempo_espera_inicio) {
          updates.duracion_espera = Math.round((ahora - new Date(lavada.tiempo_espera_inicio)) / 1000)
        }
        if (estadoAnterior === 'EN LAVADO' && lavada.tiempo_lavado_inicio) {
          updates.duracion_lavado = Math.round((ahora - new Date(lavada.tiempo_lavado_inicio)) / 1000)
        }
        if (estadoAnterior === 'TERMINADO' && lavada.tiempo_terminado_inicio) {
          updates.duracion_terminado = Math.round((ahora - new Date(lavada.tiempo_terminado_inicio)) / 1000)
        }

        if (nuevoEstado === 'EN LAVADO') {
          updates.tiempo_lavado_inicio = ahoraISO
          updates.duracion_lavado = null
        }
        if (nuevoEstado === 'TERMINADO') {
          updates.tiempo_terminado_inicio = ahoraISO
          updates.duracion_terminado = null
        }
      }

      const { error } = await supabase
        .from('lavadas')
        .update(updates)
        .eq('id', lavadaId)

      if (error) {
        toast.error('Error al cambiar estado: ' + error.message)
        return
      }
      updateLavadaLocal(lavadaId, updates)
    })
  }

  const handleLavadorChange = async (lavadaId, lavadorId) => {
    await withCardUpdate(lavadaId, async () => {
      const { error } = await supabase
        .from('lavadas')
        .update({ lavador_id: lavadorId || null })
        .eq('id', lavadaId)

      if (error) {
        toast.error('Error al cambiar lavador: ' + error.message)
        return
      }
      const lavador = lavadores.find(l => l.id == lavadorId)
      updateLavadaLocal(lavadaId, { lavador_id: lavadorId, lavador: lavador ? { nombre: lavador.nombre } : null })
    })
  }

  const clienteTieneMembresia = (cliente) => {
    if (!cliente?.membresia_id) return false
    const nombre = (cliente.membresia?.nombre || '').toLowerCase().trim()
    return nombre !== 'cliente' && nombre !== 'cliente frecuente' && nombre !== 'sin membresia' && nombre !== 'sin membresía'
  }

  const handleTipoLavadoChangeInline = async (lavadaId, tipoId) => {
    await withCardUpdate(lavadaId, async () => {
      const tipo = tiposLavado.find(t => t.id == tipoId)
      const lavada = lavadas.find(l => l.id === lavadaId)
      const nuevosAdicionales = autoAddIncluidos(tipo, lavada.adicionales || [])
      let nuevoValor = calcularValor(tipoId, nuevosAdicionales)

      // If client has active membership, force price to 0
      const cliente = clientes.find(c => c.id == lavada.cliente_id)
      if (clienteTieneMembresia(cliente)) nuevoValor = 0

      const { error } = await supabase
        .from('lavadas')
        .update({ tipo_lavado_id: tipoId, adicionales: nuevosAdicionales, valor: nuevoValor })
        .eq('id', lavadaId)

      if (error) {
        toast.error('Error al cambiar tipo de lavado: ' + error.message)
        return
      }
      updateLavadaLocal(lavadaId, {
        tipo_lavado_id: tipoId,
        tipo_lavado: tipo ? { nombre: tipo.nombre } : null,
        adicionales: nuevosAdicionales,
        valor: nuevoValor
      })
    })
  }

  const handlePagosChange = async (lavadaId, nuevosPagos) => {
    const pagosSanitized = nuevosPagos.map(p => ({
      ...p,
      metodo_pago_id: p.metodo_pago_id || null,
      valor: Number(p.valor) || 0
    }))
    const metodoCompatible = (pagosSanitized.length > 0 && pagosSanitized[0].metodo_pago_id)
      ? pagosSanitized[0].metodo_pago_id
      : null

    await withCardUpdate(lavadaId, async () => {
      const { error } = await supabase
        .from('lavadas')
        .update({ pagos: pagosSanitized, metodo_pago_id: metodoCompatible })
        .eq('id', lavadaId)

      if (error) {
        toast.error('Error al actualizar pagos: ' + error.message)
        return
      }
      updateLavadaLocal(lavadaId, { pagos: pagosSanitized, metodo_pago_id: metodoCompatible })
    })
  }

  const handleAdicionalChange = async (lavadaId, servicio, checked) => {
    await withCardUpdate(lavadaId, async () => {
      const lavada = lavadas.find(l => l.id === lavadaId)
      const adicionalesActuales = lavada.adicionales || []

      let nuevosAdicionales
      if (checked) {
        nuevosAdicionales = [...adicionalesActuales, { id: servicio.id, nombre: servicio.nombre, precio: Number(servicio.precio) }]
      } else {
        nuevosAdicionales = adicionalesActuales.filter(a => a.id !== servicio.id)
      }

      const nuevoValor = calcularValor(lavada.tipo_lavado_id, nuevosAdicionales)

      const { error } = await supabase
        .from('lavadas')
        .update({ adicionales: nuevosAdicionales, valor: nuevoValor })
        .eq('id', lavadaId)

      if (error) {
        toast.error('Error al actualizar adicionales: ' + error.message)
        return
      }
      updateLavadaLocal(lavadaId, {
        adicionales: nuevosAdicionales,
        valor: nuevoValor
      })
    })
  }

  const [pendingDeleteLavadaId, setPendingDeleteLavadaId] = useState(null)

  const requestEliminarLavada = (lavadaId) => {
    setPendingDeleteLavadaId(lavadaId)
  }

  const executeEliminarLavada = async () => {
    const lavadaId = pendingDeleteLavadaId
    if (!lavadaId) return
    await withCardUpdate(lavadaId, async () => {
      const { error } = await supabase
        .from('lavadas')
        .delete()
        .eq('id', lavadaId)

      if (error) {
        toast.error('Error al eliminar servicio: ' + error.message)
        return
      }
      deleteLavadaLocal(lavadaId)
    })
    setPendingDeleteLavadaId(null)
  }

  const resolverPlantilla = (texto, cliente, lavada, negocioNombre) => {
    const formatFechaVar = (str) => {
      if (!str) return '—'
      const dateOnly = typeof str === 'string' ? str.split('T')[0] : null
      if (!dateOnly) return '—'
      const d = new Date(dateOnly + 'T00:00:00')
      if (isNaN(d.getTime())) return '—'
      const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
      return `${d.getDate()} ${meses[d.getMonth()]} ${d.getFullYear()}`
    }
    const getEstadoMembresia = (c) => {
      if (!c.fecha_inicio_membresia || !c.fecha_fin_membresia) return 'Inactivo'
      const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
      const fin = new Date(typeof c.fecha_fin_membresia === 'string' ? c.fecha_fin_membresia.split('T')[0] + 'T00:00:00' : c.fecha_fin_membresia)
      if (isNaN(fin.getTime())) return 'Inactivo'
      return hoy <= fin ? 'Activo' : 'Vencido'
    }
    const formatMoneyVar = (v) => {
      const num = Number(v) || 0
      return '$' + num.toLocaleString('es-CO')
    }

    const variables = {
      nombre: cliente?.nombre || '',
      telefono: cliente?.telefono || '',
      negocio: negocioNombre || '',
      membresia: cliente?.membresia?.nombre || 'Sin membresía',
      estado_membresia: getEstadoMembresia(cliente || {}),
      vencimiento: formatFechaVar(cliente?.fecha_fin_membresia),
      placa: lavada?.placa || cliente?.placa || '',
      ultimo_servicio: lavada?.tipo_lavado?.nombre || '',
      valor_ultimo: formatMoneyVar(lavada?.valor),
    }

    return texto.replace(/\{(\w+)\}/g, (match, key) => variables[key] ?? match)
  }

  const enviarWhatsApp = (lavada, { plantillaId, negocioNombre, userEmail, origen } = {}) => {
    const cliente = clientes.find(c => c.id == lavada.cliente_id)
    if (!cliente?.telefono) {
      toast.info('El cliente no tiene número de teléfono registrado')
      return
    }

    const telefono = cliente.telefono.replace(/\D/g, '')

    if (!plantillaId) {
      window.open(`https://api.whatsapp.com/send?phone=57${telefono}`, '_blank')
      return
    }

    const plantilla = plantillasMensaje.find(p => p.id === plantillaId)
    if (!plantilla) {
      window.open(`https://api.whatsapp.com/send?phone=57${telefono}`, '_blank')
      return
    }

    const mensajeTexto = resolverPlantilla(plantilla.texto, cliente, lavada, negocioNombre)
    window.open(`https://api.whatsapp.com/send?phone=57${telefono}&text=${encodeURIComponent(mensajeTexto)}`, '_blank')

    // Fire-and-forget: registrar mensaje enviado
    supabase.from('mensajes_enviados').insert([{
      cliente_id: cliente.id,
      plantilla_id: plantilla.id,
      plantilla_nombre: plantilla.nombre,
      mensaje_texto: mensajeTexto,
      enviado_por: userEmail || null,
      origen: origen || 'servicios',
      negocio_id: negocioId,
    }]).then(() => {})
  }

  return {
    // UI state
    expandedCards, setExpandedCards,
    editingPago, setEditingPago,
    validationErrors, setValidationErrors,
    collapsingCards,
    updatingCards,
    // Helpers
    smoothCollapse,
    getTimerProps,
    hasActiveTimer,
    getEstadoClass,
    calcularValor,
    autoAddIncluidos,
    // Handlers
    handleEstadoChange,
    handleLavadorChange,
    handleTipoLavadoChangeInline,
    handlePagosChange,
    handleAdicionalChange,
    pendingDeleteLavadaId, setPendingDeleteLavadaId,
    requestEliminarLavada, executeEliminarLavada,
    enviarWhatsApp,
    resolverPlantilla,
    plantillasMensaje,
    // Data from context
    tiposLavado,
    serviciosAdicionales,
    lavadores,
    metodosPago,
    clientes,
  }
}
