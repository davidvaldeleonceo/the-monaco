import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useData } from './DataContext'
import { Plus, X, Trash2, Pencil, DollarSign, Users, Hash } from 'lucide-react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { registerLocale } from 'react-datepicker'
import es from 'date-fns/locale/es'

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
  const [y, m, d] = str.split('-').map(Number)
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
  const { metodosPago, negocioId } = useData()

  const [pagos, setPagos] = useState([])
  const [lavadores, setLavadores] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [lavadasPeriodo, setLavadasPeriodo] = useState([])
  const [calculando, setCalculando] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [diasYaPagados, setDiasYaPagados] = useState([])
  const [lavadasExcluidas, setLavadasExcluidas] = useState(0)
  const [descuentosFocused, setDescuentosFocused] = useState(false)

  // Filtros de fecha (igual que Balance)
  const hoyInit = new Date()
  hoyInit.setHours(0, 0, 0, 0)
  const [filtroDesde, setFiltroDesde] = useState(new Date(hoyInit.getFullYear(), hoyInit.getMonth(), 1))
  const [filtroHasta, setFiltroHasta] = useState(new Date(hoyInit.getFullYear(), hoyInit.getMonth() + 1, 0))
  const [filtroRapido, setFiltroRapido] = useState('mes')

  const [formData, setFormData] = useState({
    lavador_id: '',
    fecha: new Date().toISOString().split('T')[0],
    fecha_desde: '',
    fecha_hasta: '',
    lavadas_cantidad: 0,
    kit_cantidad: 0,
    cera_cantidad: 0,
    basico: 0,
    total: 0,
    descuentos: 0,
    total_pagar: 0,
    adicionales_cantidad: 0,
    detalle: null,
    metodo_pago_id: ''
  })

  useEffect(() => {
    fetchData()
  }, [filtroDesde, filtroHasta])

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

  const isAutoCalc = () => {
    const lavador = getSelectedLavador()
    return lavador && lavador.tipo_pago
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
  const calcularPagoAutomatico = (lavador, lavadas) => {
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
      const sueldo = Number(lavador.pago_sueldo_base || 0)
      const porLavada = numLavadas * Number(lavador.pago_por_lavada || 0)
      const porAdicional = numAdicionales * Number(lavador.pago_por_adicional || 0)
      total = sueldo + porLavada + porAdicional
      detalleInfo.sueldo_base = lavador.pago_sueldo_base
      detalleInfo.pago_por_lavada = lavador.pago_por_lavada
      detalleInfo.pago_por_adicional = lavador.pago_por_adicional
    } else if (tipo === 'porcentaje_lavada') {
      const sumaPorcentajeLavada = lavadas.reduce((sum, l) => {
        const precioTipo = Number(l.tipo_lavado?.precio || 0)
        return sum + (precioTipo * (Number(lavador.pago_porcentaje_lavada || 0) / 100))
      }, 0)
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

      const result = calcularPagoAutomatico(lavador, lavadasFiltradas)
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

  // Recalc total_pagar when descuentos change (auto mode)
  useEffect(() => {
    if (isAutoCalc()) {
      setFormData(prev => ({ ...prev, total_pagar: prev.total - Number(prev.descuentos) }))
    }
  }, [formData.descuentos])

  const calcularTotalManual = (data) => {
    const total = Number(data.basico) + (data.lavadas_cantidad * 5000) + (data.kit_cantidad * 3000) + (data.cera_cantidad * 2000)
    const totalPagar = total - Number(data.descuentos)
    return { total, total_pagar: totalPagar }
  }

  const handleChange = (field, value) => {
    const newData = { ...formData, [field]: value }
    if (!isAutoCalc()) {
      const { total, total_pagar } = calcularTotalManual(newData)
      setFormData({ ...newData, total, total_pagar })
    } else {
      setFormData(newData)
    }
  }

  const resetForm = () => {
    setFormData({
      lavador_id: '',
      fecha: new Date().toISOString().split('T')[0],
      fecha_desde: '',
      fecha_hasta: '',
      lavadas_cantidad: 0,
      kit_cantidad: 0,
      cera_cantidad: 0,
      basico: 0,
      total: 0,
      descuentos: 0,
      total_pagar: 0,
      adicionales_cantidad: 0,
      detalle: null,
      metodo_pago_id: ''
    })
    setLavadasPeriodo([])
    setLavadasExcluidas(0)
  }

  // Abrir modal en modo edición
  const handleEditar = (pago) => {
    setEditandoId(pago.id)
    setFormData({
      lavador_id: pago.lavador_id || '',
      fecha: pago.fecha?.split('T')[0] || new Date().toISOString().split('T')[0],
      fecha_desde: pago.fecha_desde || '',
      fecha_hasta: pago.fecha_hasta || '',
      lavadas_cantidad: pago.lavadas_cantidad || 0,
      kit_cantidad: pago.kit_cantidad || 0,
      cera_cantidad: pago.cera_cantidad || 0,
      basico: pago.basico || 0,
      total: pago.total || 0,
      descuentos: pago.descuentos || 0,
      total_pagar: pago.total_pagar || 0,
      adicionales_cantidad: pago.adicionales_cantidad || 0,
      detalle: pago.detalle || null,
      metodo_pago_id: pago.metodo_pago_id || ''
    })
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.metodo_pago_id) {
      alert('Debes seleccionar un método de pago.')
      return
    }

    if (formData.total_pagar <= 0) {
      alert('El total a pagar debe ser mayor a cero.')
      return
    }

    const lavador = getSelectedLavador()
    const periodo = formData.fecha_desde && formData.fecha_hasta
      ? `${formData.fecha_desde} a ${formData.fecha_hasta}`
      : formData.fecha

    if (editandoId) {
      const pagoAnterior = pagos.find(p => p.id === editandoId)
      const periodoAnterior = pagoAnterior?.fecha_desde && pagoAnterior?.fecha_hasta
        ? `${pagoAnterior.fecha_desde} a ${pagoAnterior.fecha_hasta}`
        : pagoAnterior?.fecha?.split('T')[0]
      const nombreAnterior = pagoAnterior?.lavador?.nombre || ''

      const { error: pagoError } = await supabase
        .from('pago_trabajadores')
        .update({
          lavador_id: formData.lavador_id,
          fecha: formData.fecha,
          fecha_desde: formData.fecha_desde || null,
          fecha_hasta: formData.fecha_hasta || null,
          lavadas_cantidad: formData.lavadas_cantidad,
          kit_cantidad: formData.kit_cantidad,
          cera_cantidad: formData.cera_cantidad,
          basico: formData.basico,
          total: formData.total,
          descuentos: formData.descuentos,
          total_pagar: formData.total_pagar,
          adicionales_cantidad: formData.adicionales_cantidad,
          detalle: formData.detalle,
          metodo_pago_id: formData.metodo_pago_id
        })
        .eq('id', editandoId)

      if (pagoError) {
        alert('Error al actualizar el pago: ' + pagoError.message)
        return
      }

      const descripcionAnterior = `Pago trabajador - ${periodoAnterior}`
      await supabase
        .from('transacciones')
        .delete()
        .eq('categoria', 'PAGO TRABAJADOR')
        .ilike('placa_o_persona', nombreAnterior)
        .ilike('descripcion', `%${descripcionAnterior}%`)

      await supabase.from('transacciones').insert([{
        tipo: 'EGRESO',
        categoria: 'PAGO TRABAJADOR',
        valor: formData.total_pagar,
        metodo_pago_id: formData.metodo_pago_id,
        placa_o_persona: lavador?.nombre || '',
        descripcion: `Pago trabajador - ${periodo}`,
        fecha: formData.fecha + 'T12:00:00-05:00',
        negocio_id: negocioId
      }])

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
          const continuar = confirm('Ya existe un pago para este trabajador con un período que se cruza. ¿Deseas continuar de todas formas?')
          if (!continuar) return
        }
      }

      const { error: pagoError } = await supabase.from('pago_trabajadores').insert([{
        ...formData,
        metodo_pago_id: formData.metodo_pago_id,
        negocio_id: negocioId
      }])

      if (pagoError) {
        alert('Error al guardar el pago: ' + pagoError.message)
        return
      }

      await supabase.from('transacciones').insert([{
        tipo: 'EGRESO',
        categoria: 'PAGO TRABAJADOR',
        valor: formData.total_pagar,
        metodo_pago_id: formData.metodo_pago_id,
        placa_o_persona: lavador?.nombre || '',
        descripcion: `Pago trabajador - ${periodo}`,
        fecha: formData.fecha + 'T12:00:00-05:00',
        negocio_id: negocioId
      }])
    }

    setShowModal(false)
    setEditandoId(null)
    resetForm()
    fetchData()
  }

  const handleAnular = async (pago) => {
    const confirmado = confirm(`¿Estás seguro de anular el pago de ${pago.lavador?.nombre || 'este trabajador'}?`)
    if (!confirmado) return

    await supabase
      .from('pago_trabajadores')
      .update({ anulado: true })
      .eq('id', pago.id)

    const periodo = pago.fecha_desde && pago.fecha_hasta
      ? `${pago.fecha_desde} a ${pago.fecha_hasta}`
      : pago.fecha?.split('T')[0]

    const nombreLavador = pago.lavador?.nombre || ''
    const descripcionBuscada = `Pago trabajador - ${periodo}`

    await supabase
      .from('transacciones')
      .delete()
      .eq('categoria', 'PAGO TRABAJADOR')
      .ilike('placa_o_persona', nombreLavador)
      .ilike('descripcion', `%${descripcionBuscada}%`)

    fetchData()
  }

  const formatFechaLocal = (fechaStr) => {
    if (!fechaStr) return '-'
    const f = fechaStr.split('T')[0]
    const [y, m, d] = f.split('-')
    return `${d}/${m}/${y}`
  }

  const formatMoney = (value) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value)
  }

  const pagosActivos = pagos.filter(p => !p.anulado)
  const totalPagadoMes = pagosActivos.reduce((sum, p) => sum + Number(p.total_pagar), 0)
  const pagosRealizados = pagosActivos.length
  const trabajadoresUnicos = new Set(pagosActivos.map(p => p.lavador_id)).size

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

  const renderDescuentosInput = () => (
    <input
      type="text"
      inputMode="numeric"
      value={descuentosFocused ? (formData.descuentos || '') : formatMoney(formData.descuentos)}
      placeholder={formatMoney(0)}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d]/g, '')
        handleChange('descuentos', raw === '' ? 0 : Number(raw))
      }}
      onFocus={(e) => {
        setDescuentosFocused(true)
        if (formData.descuentos === 0) e.target.value = ''
      }}
      onBlur={() => setDescuentosFocused(false)}
      className="pago-descuento-input"
    />
  )

  const renderMetodoPagoSelect = () => (
    <div className="form-group">
      <label>Método de Pago</label>
      <select
        value={formData.metodo_pago_id}
        onChange={(e) => handleChange('metodo_pago_id', e.target.value)}
        required
      >
        <option value="">Seleccionar</option>
        {metodosPago.map(m => (
          <option key={m.id} value={m.id}>{m.nombre}</option>
        ))}
      </select>
    </div>
  )

  const renderAutoForm = () => {
    const lavador = getSelectedLavador()
    return (
      <>
        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '1rem' }}>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label>Fecha Desde</label>
            <DatePicker
              selected={parseDateStr(formData.fecha_desde)}
              onChange={(date) => handleChange('fecha_desde', date ? fechaLocalStr(date) : '')}
              dateFormat="dd/MM/yyyy"
              locale="es"
              placeholderText="Seleccionar"
              isClearable
              highlightDates={highlightPagados}
            />
          </div>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label>Fecha Hasta</label>
            <DatePicker
              selected={parseDateStr(formData.fecha_hasta)}
              onChange={(date) => handleChange('fecha_hasta', date ? fechaLocalStr(date) : '')}
              dateFormat="dd/MM/yyyy"
              locale="es"
              placeholderText="Seleccionar"
              isClearable
              minDate={parseDateStr(formData.fecha_desde)}
              highlightDates={highlightPagados}
            />
          </div>
        </div>

        {renderMetodoPagoSelect()}

        {calculando && <p style={{ color: '#888', fontStyle: 'italic' }}>Calculando...</p>}

        {!calculando && formData.fecha_desde && formData.fecha_hasta && (
          <div style={{ background: 'var(--bg-secondary, #f5f5f5)', padding: '12px', borderRadius: '8px', marginBottom: '12px', gridColumn: '1 / -1' }}>
            <p style={{ margin: '0 0 8px', fontWeight: '600' }}>Resumen ({tipoPagoLabel(lavador?.tipo_pago)})</p>
            <p style={{ margin: '4px 0' }}>Servicios en período: <strong>{formData.lavadas_cantidad}</strong></p>
            <p style={{ margin: '4px 0' }}>Adicionales: <strong>{formData.adicionales_cantidad}</strong></p>
            {lavadasExcluidas > 0 && (
              <p style={{ margin: '4px 0', color: 'var(--accent-yellow)', fontSize: '0.85em' }}>
                {lavadasExcluidas} servicio{lavadasExcluidas > 1 ? 's' : ''} excluido{lavadasExcluidas > 1 ? 's' : ''} (días ya pagados)
              </p>
            )}
            {lavador?.tipo_pago === 'porcentaje' && (
              <p style={{ margin: '4px 0' }}>Valor total servicios: <strong>{formatMoney(formData.detalle?.suma_valor_lavadas || 0)}</strong> x {lavador.pago_porcentaje || 0}%</p>
            )}
            {lavador?.tipo_pago === 'sueldo_fijo' && (
              <>
                <p style={{ margin: '4px 0' }}>Sueldo base: <strong>{formatMoney(lavador.pago_sueldo_base || 0)}</strong></p>
                <p style={{ margin: '4px 0' }}>+ {formData.lavadas_cantidad} servicios x {formatMoney(lavador.pago_por_lavada || 0)}</p>
                <p style={{ margin: '4px 0' }}>+ {formData.adicionales_cantidad} adicionales x {formatMoney(lavador.pago_por_adicional || 0)}</p>
              </>
            )}
            {lavador?.tipo_pago === 'porcentaje_lavada' && (
              <>
                <p style={{ margin: '4px 0' }}>% por tipo de servicio: {lavador.pago_porcentaje_lavada || 0}%</p>
                <p style={{ margin: '4px 0' }}>+ {formData.adicionales_cantidad} adicionales x {formatMoney(lavador.pago_adicional_fijo || 0)}</p>
              </>
            )}
            <div className="pago-linea-total" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
              <span>Subtotal</span>
              <strong>{formatMoney(formData.total)}</strong>
            </div>
          </div>
        )}

        <div style={{ gridColumn: '1 / -1' }}>
          <div className="pago-linea-total">
            <span>Descuentos</span>
            {renderDescuentosInput()}
          </div>
          <div className="pago-linea-total pago-linea-final">
            <span>Total a Pagar</span>
            <strong>{formatMoney(formData.total_pagar)}</strong>
          </div>
        </div>
      </>
    )
  }

  const renderManualForm = () => {
    return (
      <>
        <div className="form-group">
          <label>Fecha</label>
          <DatePicker
            selected={parseDateStr(formData.fecha)}
            onChange={(date) => handleChange('fecha', date ? fechaLocalStr(date) : '')}
            dateFormat="dd/MM/yyyy"
            locale="es"
            placeholderText="Seleccionar"
            isClearable
          />
        </div>

        {renderMetodoPagoSelect()}

        <div className="form-group">
          <label>Cantidad Servicios</label>
          <input
            type="number"
            value={formData.lavadas_cantidad}
            onChange={(e) => handleChange('lavadas_cantidad', Number(e.target.value))}
          />
        </div>

        <div className="form-group">
          <label>Cantidad Kit</label>
          <input
            type="number"
            value={formData.kit_cantidad}
            onChange={(e) => handleChange('kit_cantidad', Number(e.target.value))}
          />
        </div>

        <div className="form-group">
          <label>Cantidad Cera</label>
          <input
            type="number"
            value={formData.cera_cantidad}
            onChange={(e) => handleChange('cera_cantidad', Number(e.target.value))}
          />
        </div>

        <div className="form-group">
          <label>Básico</label>
          <input
            type="number"
            value={formData.basico}
            onChange={(e) => handleChange('basico', Number(e.target.value))}
          />
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <div className="pago-linea-total">
            <span>Total</span>
            <strong>{formatMoney(formData.total)}</strong>
          </div>
          <div className="pago-linea-total">
            <span>Descuentos</span>
            {renderDescuentosInput()}
          </div>
          <div className="pago-linea-total pago-linea-final">
            <span>Total a Pagar</span>
            <strong>{formatMoney(formData.total_pagar)}</strong>
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="pagos-page">
      <div className="page-header">
        <h1 className="page-title">Pago Trabajadores</h1>
        <button className="btn-primary" onClick={() => { resetForm(); setEditandoId(null); setShowModal(true) }}>
          <Plus size={20} />
          Nuevo Pago
        </button>
      </div>

      <div className="filters">
        <div className="filter-rapido">
          <button className={`filter-btn ${filtroRapido === 'hoy' ? 'active' : ''}`} onClick={() => aplicarFiltroRapido('hoy')}>Hoy</button>
          <button className={`filter-btn ${filtroRapido === 'semana' ? 'active' : ''}`} onClick={() => aplicarFiltroRapido('semana')}>Semana</button>
          <button className={`filter-btn ${filtroRapido === 'mes' ? 'active' : ''}`} onClick={() => aplicarFiltroRapido('mes')}>Mes</button>
          <button className={`filter-btn ${filtroRapido === 'año' ? 'active' : ''}`} onClick={() => aplicarFiltroRapido('año')}>Año</button>
          <button className={`filter-btn ${filtroRapido === 'todas' ? 'active' : ''}`} onClick={() => aplicarFiltroRapido('todas')}>Todas</button>
        </div>

        <div className="filter-fechas">
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

      <div className="card">
        <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Trabajador</th>
              <th>Tipo Pago</th>
              <th>Período</th>
              <th>Servicios</th>
              <th>Total</th>
              <th>Descuentos</th>
              <th>A Pagar</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pagos.map((pago) => {
              const esAuto = !!pago.detalle
              const esAnulado = !!pago.anulado
              return (
                <tr key={pago.id} className={esAnulado ? 'fila-anulada' : ''}>
                  <td>{formatFechaLocal(pago.fecha)}</td>
                  <td>{pago.lavador?.nombre}</td>
                  <td>{esAuto ? tipoPagoLabel(pago.detalle?.tipo_pago) : 'Manual'}</td>
                  <td>{pago.fecha_desde && pago.fecha_hasta
                    ? `${formatFechaLocal(pago.fecha_desde)} - ${formatFechaLocal(pago.fecha_hasta)}`
                    : '-'}</td>
                  <td>{pago.lavadas_cantidad || 0}</td>
                  <td>{formatMoney(pago.total)}</td>
                  <td className="valor-negativo">{formatMoney(pago.descuentos)}</td>
                  <td className={esAnulado ? '' : 'valor-positivo'}><strong>{formatMoney(pago.total_pagar)}</strong></td>
                  <td style={{ textAlign: 'center' }}>
                    {esAnulado ? (
                      <span className="estado-badge inactivo">Anulado</span>
                    ) : (
                      <div className="acciones">
                        <button
                          className="btn-icon"
                          onClick={() => handleEditar(pago)}
                          title="Editar pago"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="btn-icon delete"
                          onClick={() => handleAnular(pago)}
                          title="Anular pago"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
            {pagos.length === 0 && (
              <tr>
                <td colSpan="9" className="empty">No hay pagos registrados en este período</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>{editandoId ? 'Editar Pago' : 'Nuevo Pago'}</h2>
              <button className="btn-close" onClick={() => { setShowModal(false); setEditandoId(null) }}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Trabajador</label>
                  <select
                    value={formData.lavador_id}
                    onChange={(e) => handleChange('lavador_id', e.target.value)}
                    required
                  >
                    <option value="">Seleccionar</option>
                    {lavadores.map(l => (
                      <option key={l.id} value={l.id}>{l.nombre}{l.tipo_pago ? ` (${tipoPagoLabel(l.tipo_pago)})` : ''}</option>
                    ))}
                  </select>
                </div>

                {isAutoCalc() ? renderAutoForm() : renderManualForm()}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => { setShowModal(false); setEditandoId(null) }}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  {editandoId ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
