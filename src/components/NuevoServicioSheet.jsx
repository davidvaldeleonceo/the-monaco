import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { useData } from './DataContext'
import { useServiceHandlers } from '../hooks/useServiceHandlers'
import { formatMoney } from '../utils/money'
import { Plus, X } from 'lucide-react'
import UpgradeModal from './UpgradeModal'
import { useToast } from './Toast'

export default function NuevoServicioSheet({ isOpen, onClose, onSuccess }) {
  const { clientes, tiposMembresia, negocioId, addLavadaLocal, addClienteLocal, serviciosAdicionales: _sa } = useData()
  const { tiposLavado, serviciosAdicionales, lavadores, calcularValor, autoAddIncluidos } = useServiceHandlers()
  const toast = useToast()

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

  const [clienteSearch, setClienteSearch] = useState('')
  const [showClienteDropdown, setShowClienteDropdown] = useState(false)
  const [showNuevoCliente, setShowNuevoCliente] = useState(false)
  const [nuevoClienteData, setNuevoClienteData] = useState({ nombre: '', placa: '', telefono: '', cedula: '', correo: '', moto: '', membresia_id: '', fecha_inicio_membresia: '', fecha_fin_membresia: '' })
  const [showCamposExtra, setShowCamposExtra] = useState(false)
  const [creandoCliente, setCreandoCliente] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  // Bottom sheet drag-to-dismiss
  const sheetRef = useRef(null)
  const [dragY, setDragY] = useState(0)
  const dragStartY = useRef(null)
  const clienteWrapperRef = useRef(null)

  // Close cliente dropdown on click outside or touch outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (clienteWrapperRef.current && !clienteWrapperRef.current.contains(e.target)) {
        setShowClienteDropdown(false)
      }
    }
    if (showClienteDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [showClienteDropdown])

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

  const fechaLocalStr = (date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const handleMembresiaChangeInline = (membresiaId) => {
    const membresia = tiposMembresia.find(m => m.id === membresiaId)
    const hoy = new Date()
    const hoyStr = fechaLocalStr(hoy)

    if (!membresiaId || membresia?.nombre?.toLowerCase().includes('sin ')) {
      setNuevoClienteData(prev => ({
        ...prev,
        membresia_id: membresiaId,
        fecha_inicio_membresia: hoyStr,
        fecha_fin_membresia: hoyStr
      }))
    } else {
      const meses = membresia?.duracion_dias || 1
      const fin = new Date()
      fin.setMonth(fin.getMonth() + meses)
      setNuevoClienteData(prev => ({
        ...prev,
        membresia_id: membresiaId,
        fecha_inicio_membresia: hoyStr,
        fecha_fin_membresia: fechaLocalStr(fin)
      }))
    }
  }

  const emptyNuevoCliente = { nombre: '', placa: '', telefono: '', cedula: '', correo: '', moto: '', membresia_id: '', fecha_inicio_membresia: '', fecha_fin_membresia: '' }

  const handleCrearCliente = async () => {
    if (!nuevoClienteData.nombre || !nuevoClienteData.placa) return
    setCreandoCliente(true)
    const hoy = new Date()
    const hoyStr = fechaLocalStr(hoy)

    // Determine membership: use user selection if provided, otherwise default to "Sin Membresia"
    let membresiaId = nuevoClienteData.membresia_id
    let fechaInicio = nuevoClienteData.fecha_inicio_membresia || hoyStr
    let fechaFin = nuevoClienteData.fecha_fin_membresia || hoyStr
    if (!membresiaId) {
      const sinMembresia = tiposMembresia.find(m => m.nombre.toLowerCase().includes('sin '))
      membresiaId = sinMembresia?.id || null
      fechaInicio = hoyStr
      fechaFin = hoyStr
    }

    const { data, error } = await supabase
      .from('clientes')
      .insert([{
        nombre: nuevoClienteData.nombre,
        placa: nuevoClienteData.placa.toUpperCase(),
        telefono: nuevoClienteData.telefono || null,
        cedula: nuevoClienteData.cedula || null,
        correo: nuevoClienteData.correo || null,
        moto: nuevoClienteData.moto || null,
        membresia_id: membresiaId,
        fecha_inicio_membresia: fechaInicio,
        fecha_fin_membresia: fechaFin,
        estado: 'Activo',
        negocio_id: negocioId
      }])
      .select('*, membresia:tipos_membresia(nombre)')
      .single()
    setCreandoCliente(false)
    if (error) {
      if (error.message?.includes('PLAN_LIMIT_REACHED')) {
        setShowUpgradeModal(true)
        return
      }
      const existente = clientes.find(c => c.placa?.toLowerCase() === nuevoClienteData.placa.toLowerCase())
      if (existente) {
        setShowNuevoCliente(false)
        setShowCamposExtra(false)
        setNuevoClienteData(emptyNuevoCliente)
        handleClienteChange(existente.id)
        return
      }
      toast.error('Error al crear cliente: ' + (error.message || 'Error desconocido'))
      return
    }
    if (data) {
      addClienteLocal(data)
      setShowNuevoCliente(false)
      setShowCamposExtra(false)
      setNuevoClienteData(emptyNuevoCliente)
      setClienteSearch(`${data.nombre} - ${data.placa}`)
      setShowClienteDropdown(false)
      // Auto-detect lavado type based on the created client's membership
      const createdHasMembresia = data.membresia_id && !data.membresia?.nombre?.toLowerCase().includes('sin ')
      const tipoLavado = createdHasMembresia
        ? tiposLavado.find(t => { const n = t.nombre.toLowerCase(); return (n.includes('membresia') || n.includes('membresía')) && !n.includes('sin ') })
        : tiposLavado.find(t => t.nombre?.toLowerCase().includes('sin memb'))
      setFormData(prev => ({
        ...prev,
        cliente_id: data.id,
        placa: data.placa || '',
        tipo_lavado_id: tipoLavado?.id || '',
        valor: tipoLavado?.precio || 0
      }))
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

  const resetState = () => {
    setClienteSearch('')
    setShowClienteDropdown(false)
    setShowNuevoCliente(false)
    setShowCamposExtra(false)
    setNuevoClienteData(emptyNuevoCliente)
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
    setDragY(0)
    dragStartY.current = null
  }

  const handleClose = () => {
    resetState()
    onClose?.()
  }

  const doSubmit = async () => {
    if (submitting) return
    if (!formData.cliente_id) {
      toast.error('Selecciona un cliente antes de guardar')
      return
    }
    setSubmitting(true)

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

    setSubmitting(false)
    if (error?.message?.includes('PLAN_LIMIT_REACHED')) {
      setShowUpgradeModal(true)
      return
    }
    if (!error && data) {
      addLavadaLocal(data)
      resetState()
      onSuccess?.()
    }
  }

  // Touch handlers for sheet drag-to-dismiss
  const onSheetTouchStart = (e) => {
    dragStartY.current = e.touches[0].clientY
  }

  const onSheetTouchMove = (e) => {
    if (dragStartY.current === null) return
    const delta = e.touches[0].clientY - dragStartY.current
    if (delta > 0) setDragY(delta)
  }

  const onSheetTouchEnd = () => {
    const height = sheetRef.current?.offsetHeight || 500
    if (dragY > height * 0.3) {
      handleClose()
    }
    setDragY(0)
    dragStartY.current = null
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal modal-sheet"
        onClick={e => e.stopPropagation()}
        ref={sheetRef}
        style={dragY > 0 ? { transform: `translateY(${dragY}px)`, transition: 'none' } : {}}
      >
        {/* Drag handle */}
        <div
          className="modal-sheet-handle"
          onTouchStart={onSheetTouchStart}
          onTouchMove={onSheetTouchMove}
          onTouchEnd={onSheetTouchEnd}
        >
          <div className="modal-sheet-handle-bar" />
        </div>

        {/* Header con X izquierda, título centro, Guardar derecha */}
        <div className="modal-sheet-header">
          <button className="btn-sheet-close" onClick={handleClose}>
            <X size={20} />
          </button>
          <h2>Nuevo Servicio</h2>
          <button
            className="btn-sheet-action"
            onClick={doSubmit}
            disabled={!formData.cliente_id || submitting}
          >
            {submitting ? 'Guardando...' : 'Guardar'}
          </button>
        </div>

        {/* Form */}
        <form onSubmit={(e) => { e.preventDefault(); doSubmit(); }}>
          <div className="form-grid">
            <div className="form-group cliente-search-group">
              <label>Cliente</label>
              <div className="cliente-search-wrapper" ref={clienteWrapperRef}>
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
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setShowClienteDropdown(false)
                      e.target.blur()
                    }
                  }}
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
                    {(() => {
                      const filtered = clientes.filter(c => {
                        const q = clienteSearch.toLowerCase()
                        return !q || c.nombre?.toLowerCase().includes(q) || c.placa?.toLowerCase().includes(q) || c.telefono?.toLowerCase().includes(q)
                      })
                      return (
                        <>
                          {filtered.slice(0, 8).map(c => (
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
                          {filtered.length === 0 && (
                            <div className="cliente-search-empty">No se encontraron clientes</div>
                          )}
                          <div className="cliente-search-add">
                            <button
                              type="button"
                              className="btn-nuevo-cliente-inline"
                              onMouseDown={() => {
                                const search = clienteSearch.trim()
                                const soloDigitos = search.replace(/[\s+\-()]/g, '')
                                const cantDigitos = (soloDigitos.match(/\d/g) || []).length

                                let nuevoData = { ...emptyNuevoCliente }
                                if (cantDigitos >= 7) {
                                  nuevoData.telefono = search
                                } else if (/\d/.test(search)) {
                                  nuevoData.placa = search.toUpperCase()
                                } else {
                                  nuevoData.nombre = search
                                }

                                setShowNuevoCliente(true)
                                setShowClienteDropdown(false)
                                setNuevoClienteData(nuevoData)
                              }}
                            >
                              <Plus size={14} /> Agregar cliente
                            </button>
                          </div>
                        </>
                      )
                    })()}
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
                    {nuevoClienteData.nombre.trim() !== '' && clientes.some(c => c.nombre?.trim().toLowerCase() === nuevoClienteData.nombre.trim().toLowerCase()) && (
                      <span className="cliente-ya-existe-warning">Cliente ya existe</span>
                    )}
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
                      className="btn-mas-campos"
                      onClick={() => setShowCamposExtra(!showCamposExtra)}
                    >
                      {showCamposExtra ? '− Menos campos' : '+ Más campos'}
                    </button>
                    {showCamposExtra && (
                      <>
                        <input
                          type="text"
                          placeholder="Cédula"
                          value={nuevoClienteData.cedula}
                          onChange={(e) => setNuevoClienteData(prev => ({ ...prev, cedula: e.target.value }))}
                        />
                        <input
                          type="email"
                          placeholder="Correo"
                          value={nuevoClienteData.correo}
                          onChange={(e) => setNuevoClienteData(prev => ({ ...prev, correo: e.target.value }))}
                        />
                        <input
                          type="text"
                          placeholder="Moto"
                          value={nuevoClienteData.moto}
                          onChange={(e) => setNuevoClienteData(prev => ({ ...prev, moto: e.target.value }))}
                        />
                        <select
                          value={nuevoClienteData.membresia_id}
                          onChange={(e) => handleMembresiaChangeInline(e.target.value)}
                        >
                          <option value="">Tipo de cliente</option>
                          {tiposMembresia.map(m => (
                            <option key={m.id} value={m.id}>{m.nombre}</option>
                          ))}
                        </select>
                        <div className="nuevo-cliente-inline-fechas">
                          <input
                            type="date"
                            value={nuevoClienteData.fecha_inicio_membresia}
                            onChange={(e) => setNuevoClienteData(prev => ({ ...prev, fecha_inicio_membresia: e.target.value }))}
                          />
                          <input
                            type="date"
                            value={nuevoClienteData.fecha_fin_membresia}
                            onChange={(e) => setNuevoClienteData(prev => ({ ...prev, fecha_fin_membresia: e.target.value }))}
                            min={nuevoClienteData.fecha_inicio_membresia}
                          />
                        </div>
                      </>
                    )}
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
        </form>
      </div>
      {showUpgradeModal && <UpgradeModal onClose={() => setShowUpgradeModal(false)} reason="Has alcanzado el límite de 50 lavadas este mes" />}
    </div>
  )
}
