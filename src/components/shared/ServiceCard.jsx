import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import Timer from './Timer'
import { formatMoney, getCurrencySymbol, formatPriceLocale } from '../../utils/money'
import { ESTADO_LABELS, ESTADO_CLASSES } from '../../config/constants'
import { MessageCircle, Trash2, CheckCircle2, Plus, X, Clock, Droplets, CircleCheck, HandCoins, Sparkles, Pencil } from 'lucide-react'

export default function ServiceCard({
  lavada,
  // Handlers
  onEstadoChange,
  onTipoLavadoChange,
  onAdicionalChange,
  onLavadorChange,
  onPagosChange,
  onNotasChange,
  onValorChange,
  onEliminar,
  onWhatsApp,
  // UI state
  isExpanded,
  isCollapsing,
  isUpdating,
  editingPago,
  validationErrors,
  // UI setters
  onToggleExpand,
  onSetEditingPago,
  onSetValidationErrors,
  onSmoothCollapse,
  // Data
  tiposLavado,
  serviciosAdicionales,
  lavadores,
  metodosPago,
  // Helpers
  getTimerProps,
  hasActiveTimer,
  getEstadoClass,
  // Selection (optional)
  selectionMode = false,
  isSelected = false,
  onToggleSelect,
  // Highlight
  isHighlighted = false,
  // Cliente info
  clienteCategoria,
  onPlacaClick,
  // Plantillas
  plantillasMensaje = [],
  // Validation toast callback
  onValidationToast,
  // Popover coordination
  activePopoverId,
  onPopoverOpen,
}) {
  const navigate = useNavigate()
  // Prevent entry animation replay on re-renders / remounts while expanded
  const mountedExpandedRef = useRef(isExpanded)
  const popupRef = useRef(null)

  useEffect(() => {
    const el = popupRef.current
    if (!el || !isExpanded) return

    if (mountedExpandedRef.current) {
      // Remount while already expanded — skip animation
      el.style.animation = 'none'
    } else {
      // Fresh expansion — let animation play, then disable to prevent retrigger
      const handler = () => { el.style.animation = 'none' }
      el.addEventListener('animationend', handler, { once: true })
      return () => el.removeEventListener('animationend', handler)
    }
  }, [isExpanded])

  // When closing starts, clear inline animation so exit class can take over
  useEffect(() => {
    if (isCollapsing && popupRef.current) {
      popupRef.current.style.animation = ''
    }
  }, [isCollapsing])

  useEffect(() => {
    if (!isExpanded) mountedExpandedRef.current = false
    else mountedExpandedRef.current = true
  }, [isExpanded])

  const [waMenu, setWaMenu] = useState(false)
  const [estadoPopover, setEstadoPopoverLocal] = useState(false)
  const [pagoPopover, setPagoPopoverLocal] = useState(false)
  const [pendingEstado, setPendingEstado] = useState(null)
  const [editingValor, setEditingValor] = useState(false)
  const [localValor, setLocalValor] = useState('')
  const valorInputRef = useRef(null)
  const valorEscapedRef = useRef(false)

  const setEstadoPopover = (val) => {
    setEstadoPopoverLocal(val)
    if (val && onPopoverOpen) onPopoverOpen(lavada.id)
  }
  const setPagoPopover = (val) => {
    setPagoPopoverLocal(val)
    if (val && onPopoverOpen) onPopoverOpen(lavada.id)
  }

  useEffect(() => {
    if (activePopoverId !== undefined && activePopoverId !== lavada.id) {
      setEstadoPopoverLocal(false)
      setPagoPopoverLocal(false)
    }
  }, [activePopoverId, lavada.id])
  const [waMenuPos, setWaMenuPos] = useState({ top: 0, right: 0 })
  const waButtonRef = useRef(null)
  const lavadorSelectRef = useRef(null)
  const pagos = lavada.pagos || []
  const [localPagos, setLocalPagos] = useState([])
  const debounceRef = useRef(null)

  const lastLocalPagosRef = useRef(null)

  const isEditingPagos = pagoPopover || isExpanded

  // Sync pagos when editing starts; flush pending changes when it stops
  useEffect(() => {
    if (isEditingPagos) {
      setLocalPagos(pagos.length > 0 ? pagos.map(p => ({ ...p })) : [])
      lastLocalPagosRef.current = null
    } else if (lastLocalPagosRef.current) {
      // Flush immediately on close/collapse
      if (debounceRef.current) clearTimeout(debounceRef.current)
      onPagosChange(lavada.id, lastLocalPagosRef.current)
      lastLocalPagosRef.current = null
    }
  }, [isEditingPagos])

  // Debounced sync localPagos → parent
  const syncPagosToParent = useCallback((newPagos) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onPagosChange(lavada.id, newPagos)
    }, 400)
  }, [lavada.id, onPagosChange])

  // Cleanup debounce on unmount
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  // Notas local state + debounce
  const [localNotas, setLocalNotas] = useState('')
  const notasDebounceRef = useRef(null)
  const lastLocalNotasRef = useRef(null)

  useEffect(() => {
    if (isExpanded) {
      setLocalNotas(lavada.notas || '')
      lastLocalNotasRef.current = null
    } else if (lastLocalNotasRef.current !== null) {
      if (notasDebounceRef.current) clearTimeout(notasDebounceRef.current)
      onNotasChange?.(lavada.id, lastLocalNotasRef.current)
      lastLocalNotasRef.current = null
    }
  }, [isExpanded])

  useEffect(() => () => { if (notasDebounceRef.current) clearTimeout(notasDebounceRef.current) }, [])

  const total = Math.round(lavada.valor || 0)
  // Use localPagos when editing (popover or expanded card), pagos otherwise
  const activePagos = isEditingPagos ? localPagos : pagos
  const sumaPagos = Math.round(activePagos.reduce((s, p) => s + (Number(p.valor) || 0), 0))
  const diff = sumaPagos - total
  const pagosOk = total === 0 ? (activePagos.length === 0 || Math.abs(diff) < 1) : (activePagos.length > 0 && Math.abs(diff) < 1)
  const allMetodosSet = activePagos.length === 0 || activePagos.every(p => p.metodo_pago_id)
  const tipoOk = !!lavada.tipo_lavado_id
  const lavadorOk = !!lavada.lavador_id
  const canComplete = pagosOk && allMetodosSet && tipoOk && lavadorOk
  const yaEntregado = lavada.estado === 'ENTREGADO'
  const isEditingThisLavada = editingPago?.lavadaId === lavada.id

  const tipoLavadoNombre = tiposLavado.find(t => t.id == lavada.tipo_lavado_id)?.nombre || ''
  const pagoStatus = pagosOk ? 'pagado' : sumaPagos > 0 ? 'parcial' : 'sin-pagar'
  const pagoLabel = pagoStatus === 'pagado' ? 'Pagado' : pagoStatus === 'parcial' ? 'Parcial' : 'Sin pagar'
  const vErrs = validationErrors || {}
  // showBody removed — popup renders when isExpanded is true

  const triggerValidationErrors = () => {
    const errs = {}
    if (!tipoOk) errs.tipo = true
    if (!lavadorOk) errs.lavador = true
    if (!pagosOk || !allMetodosSet) errs.pagos = true
    onSetValidationErrors(errs)
    if (onValidationToast) {
      const msg = !tipoOk ? 'Falta seleccionar tipo de lavado'
        : !lavadorOk ? 'Falta asignar un lavador'
        : 'Revisa los pagos del servicio'
      onValidationToast(msg)
    }
    setTimeout(() => onSetValidationErrors(null), 2000)
  }

  const estadosConfig = [
    { key: 'EN ESPERA', timer: 'espera', icon: Clock, label: 'Espera' },
    { key: 'EN LAVADO', timer: 'lavado', icon: Droplets, label: 'Lavado' },
    { key: 'TERMINADO', timer: 'terminado', icon: CircleCheck, label: 'Terminado' },
    { key: 'ENTREGADO', timer: null, icon: HandCoins, label: 'Entregado' },
  ]

  const updateLocalPagos = (newPagos) => {
    setLocalPagos(newPagos)
    lastLocalPagosRef.current = newPagos
    syncPagosToParent(newPagos)
  }

  const localSumaPagos = Math.round(localPagos.reduce((s, p) => s + (Number(p.valor) || 0), 0))
  const localDiff = localSumaPagos - total
  const localPagosOk = total === 0 ? (localPagos.length === 0 || Math.abs(localDiff) < 1) : (localPagos.length > 0 && Math.abs(localDiff) < 1)
  const localAllMetodosSet = localPagos.length === 0 || localPagos.every(p => p.metodo_pago_id)

  const renderPagoPopover = () => (
    <>
      <div className="pago-popover-overlay" onClick={(e) => { e.stopPropagation(); setPagoPopover(false) }} />
      <div
        className="pago-popover"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pago-popover-header">
          <span className="pago-popover-title">Pago</span>
          <button className="pago-popover-close" onClick={() => setPagoPopover(false)}>
            <X size={18} />
          </button>
        </div>

        <div className="pago-popover-info">
          <div className="pago-popover-info-left">
            <span className="pago-popover-cliente">{lavada.cliente?.nombre || 'Sin cliente'}</span>
            <span className="pago-popover-placa">{lavada.placa}</span>
            {tipoLavadoNombre && <span className="pago-popover-tipo">{tipoLavadoNombre}</span>}
            <span className="pago-popover-adicionales">{lavada.adicionales?.length > 0 ? lavada.adicionales.map(a => a.nombre).join(', ') : 'Sin adicionales'}</span>
          </div>
          <div className="pago-popover-info-right">
            <span className="pago-popover-total-label">Total</span>
            <span className={`pago-popover-total ${(pagosOk && allMetodosSet) ? 'pago-ok' : total > 0 ? 'pago-error' : ''}`}>{formatMoney(total)}</span>
          </div>
        </div>

        <div className="pago-popover-rows">
          {localPagos.map((p, idx) => (
            <div key={idx} className="pago-popover-row">
              <select
                value={p.metodo_pago_id || ''}
                onChange={(e) => {
                  const metodo = metodosPago.find(m => m.id == e.target.value)
                  updateLocalPagos(localPagos.map((pg, i) =>
                    i === idx ? { ...pg, metodo_pago_id: e.target.value, nombre: metodo?.nombre || '' } : pg
                  ))
                }}
                className="pago-popover-select"
              >
                <option value="">Método</option>
                {metodosPago.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
              <input
                type="text"
                inputMode="numeric"
                value={p.valor === 0 ? '' : formatPriceLocale(p.valor)}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '')
                  updateLocalPagos(localPagos.map((pg, i) =>
                    i === idx ? { ...pg, valor: val === '' ? 0 : Number(val) } : pg
                  ))
                }}
                className="pago-popover-input"
                placeholder={getCurrencySymbol() + '0'}
              />
              <button
                className="pago-popover-delete"
                onClick={() => updateLocalPagos(localPagos.filter((_, i) => i !== idx))}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <button
          className="pago-popover-add"
          onClick={() => {
            const restante = total - localSumaPagos
            updateLocalPagos([...localPagos, { metodo_pago_id: '', nombre: '', valor: restante > 0 ? restante : 0 }])
          }}
        >
          <Plus size={14} /> <span>Agregar pago</span>
        </button>

        {localPagos.length > 0 && !localPagosOk && (
          <div className="pago-popover-diff">
            {localDiff > 0 ? `Excede ${formatMoney(localDiff)}` : `Falta ${formatMoney(Math.abs(localDiff))}`}
          </div>
        )}

        {localPagos.length > 0 && localPagosOk && localAllMetodosSet && (
          <div className="pago-popover-ok"><CheckCircle2 size={14} /> Pagos completos</div>
        )}
      </div>
    </>
  )

  const renderEstadoPopover = () => (
    <>
      <div className="estado-popover-overlay" onClick={(e) => { e.stopPropagation(); setEstadoPopover(false) }} />
      <div className="estado-popover" onClick={(e) => e.stopPropagation()}>
        <div className="pago-popover-header">
          <span className="pago-popover-title">Estado</span>
          <button className="pago-popover-close" onClick={() => setEstadoPopover(false)}>
            <X size={18} />
          </button>
        </div>
        <div className="pago-popover-info">
          <div className="pago-popover-info-left">
            <span className="pago-popover-cliente">{lavada.cliente?.nombre || 'Sin cliente'}</span>
            <span className="pago-popover-placa">{lavada.placa}</span>
            {tipoLavadoNombre && <span className="pago-popover-tipo">{tipoLavadoNombre}</span>}
          </div>
          <div className="pago-popover-info-right">
            <span className="pago-popover-total-label">Total</span>
            <span className="pago-popover-total">{formatMoney(total)}</span>
          </div>
        </div>
        {estadosConfig.map(({ key: est, timer }) => (
          <button
            key={est}
            className={`estado-popover-option ${lavada.estado === est ? 'active' : ''} ${(est === 'ENTREGADO' || est === 'TERMINADO') && !lavadorOk ? 'disabled-look' : ''} ${est === 'ENTREGADO' && !canComplete && !yaEntregado ? 'disabled-look' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              if ((est === 'TERMINADO' || est === 'ENTREGADO') && !lavadorOk) {
                if (onValidationToast) onValidationToast('Falta asignar un lavador')
                setEstadoPopover(false)
                return
              }
              if (est === 'ENTREGADO' && !canComplete) {
                triggerValidationErrors()
                setEstadoPopover(false)
                return
              }
              if (est === 'EN LAVADO' && !lavadorOk) {
                setEstadoPopover(false)
                setPendingEstado(est)
                return
              }
              onEstadoChange(lavada.id, est)
              setEstadoPopover(false)
            }}
          >
            <span className="estado-popover-label">{ESTADO_LABELS[est]}</span>
            {timer && <span className="estado-popover-time"><Timer {...getTimerProps(lavada, timer)} /></span>}
          </button>
        ))}
      </div>
    </>
  )

  return (
    <div data-id={lavada.id} className={`lavada-card ${getEstadoClass(lavada.estado)}-border pago-${pagoStatus} ${isSelected ? 'card-selected' : ''} ${isUpdating ? 'card-updating' : ''} ${isHighlighted ? 'card-highlight' : ''}`}>
      <div
        className="lavada-card-header"
        onClick={() => { setEstadoPopover(false); setPagoPopover(false); selectionMode && onToggleSelect ? onToggleSelect(lavada.id) : onToggleExpand() }}
      >
        <div className="lavada-card-cliente">
          <span className="lavada-card-nombre">{lavada.cliente?.nombre || 'No encontrado'} <span className="lavada-card-fecha">{new Date(lavada.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', timeZone: 'America/Bogota' })}</span></span>
          <span className="lavada-card-placa">
            <span onClick={(e) => { e.stopPropagation(); onPlacaClick?.(lavada) }} style={{ cursor: 'pointer' }}>{lavada.placa}</span>
            {clienteCategoria && <span className="cliente-categoria-badge badge-desktop-only">{clienteCategoria}</span>}
          </span>
          {tipoLavadoNombre && <span className="lavada-card-tipo-mobile">{tipoLavadoNombre}</span>}
        </div>
        <div className="lavada-card-summary">
          <span className={`pago-badge pago-badge-${pagoStatus} badge-desktop-only`}>{pagoLabel}</span>
          <div className="summary-valor-estado">
            <span
              className={`lavada-card-valor-mini ${(pagosOk && allMetodosSet) ? 'valor-ok' : total > 0 ? 'valor-pendiente' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                if (selectionMode) { onToggleSelect?.(lavada.id); return }
                setEstadoPopover(false)
                setPagoPopover(true)
              }}
              style={{ cursor: 'pointer' }}
            >{formatMoney(lavada.valor)}</span>
            <div className="summary-estado-row">
              {hasActiveTimer(lavada) && (
                <span className={`lavada-card-timer ${getEstadoClass(lavada.estado)}`}>
                  <Timer {...getTimerProps(lavada, lavada.estado === 'EN ESPERA' ? 'espera' : lavada.estado === 'EN LAVADO' ? 'lavado' : 'terminado')} />
                </span>
              )}
              <span className="estado-badge-wrapper">
                <span
                  className={`estado-badge-mini ${getEstadoClass(lavada.estado)} estado-badge-clickable`}
                  onClick={(e) => { e.stopPropagation(); if (selectionMode) { onToggleSelect?.(lavada.id); return } setPagoPopover(false); setEstadoPopover(!estadoPopover) }}
                >
                  {ESTADO_LABELS[lavada.estado] || lavada.estado}
                </span>
                {estadoPopover && renderEstadoPopover()}
                {pagoPopover && renderPagoPopover()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {pendingEstado && createPortal(
        <div className="lavador-picker-overlay" onClick={() => setPendingEstado(null)}>
          <div className="lavador-picker" onClick={(e) => e.stopPropagation()}>
            <div className="lavador-picker-header">
              <span className="lavador-picker-title">Asignar lavador</span>
              <button className="pago-popover-close" onClick={() => setPendingEstado(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="lavador-picker-info">
              <span>{lavada.cliente?.nombre || 'Sin cliente'}</span>
              <span className="lavador-picker-placa">{lavada.placa}</span>
            </div>
            <div className="lavador-picker-list">
              {lavadores.map(l => (
                <button
                  key={l.id}
                  className="lavador-picker-btn"
                  onClick={() => {
                    onLavadorChange(lavada.id, l.id)
                    onEstadoChange(lavada.id, pendingEstado)
                    setPendingEstado(null)
                  }}
                >
                  {l.nombre}
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      {isExpanded && (
        <>
          <div className={`pago-popover-overlay${isCollapsing ? ' overlay-exit' : ''}`} onClick={() => onSmoothCollapse(lavada.id)} />
          <div ref={popupRef} className={`servicio-popup${isCollapsing ? ' servicio-popup-exit' : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className="servicio-popup-header">
              <div className="servicio-popup-header-info">
                <span className="servicio-popup-cliente">{lavada.cliente?.nombre || 'Sin cliente'}</span>
                <span className="servicio-popup-sub">{lavada.placa} &middot; {formatMoney(total)}</span>
              </div>
              <button className="pago-popover-close" onClick={() => onSmoothCollapse(lavada.id)}>
                <X size={20} />
              </button>
            </div>

            <div className="estado-flow">
              {estadosConfig.map(({ key: est, timer, icon: Icon, label }) => {
                const isEntregado = est === 'ENTREGADO'
                const isActive = isEntregado ? yaEntregado : lavada.estado === est
                const bgClass = est === 'EN ESPERA' ? 'estado-espera-bg' : est === 'EN LAVADO' ? 'estado-lavado-bg' : est === 'TERMINADO' ? 'estado-terminado-bg' : 'estado-entregado-bg'
                return (
                  <button
                    key={est}
                    className={`estado-step-btn ${bgClass} ${isActive ? 'active' : ''} ${(isEntregado || est === 'TERMINADO') && !lavadorOk ? 'disabled-look' : ''} ${isEntregado && !canComplete && !yaEntregado ? 'disabled-look' : ''}`}
                    title={
                      (est === 'TERMINADO' || isEntregado) && !lavadorOk ? 'Falta asignar lavador' :
                      isEntregado && !canComplete && !yaEntregado ? (
                        !tipoOk ? 'Falta tipo de lavado' :
                          activePagos.length === 0 ? 'Agrega al menos un pago' :
                            !allMetodosSet ? 'Todos los pagos necesitan método' :
                              !pagosOk ? (diff > 0 ? `Pagos exceden ${formatMoney(diff)}` : `Faltan ${formatMoney(Math.abs(diff))}`) : ''
                      ) : undefined
                    }
                    onClick={(e) => {
                      e.stopPropagation()
                      if ((est === 'TERMINADO' || isEntregado) && !lavadorOk) {
                        if (onValidationToast) onValidationToast('Falta asignar un lavador')
                        lavadorSelectRef.current?.focus()
                        return
                      }
                      if (isEntregado && !canComplete) {
                        triggerValidationErrors()
                        return
                      }
                      if (est === 'EN LAVADO' && !lavadorOk) {
                        setPendingEstado(est)
                        return
                      }
                      onEstadoChange(lavada.id, est)
                    }}
                  >
                    <div className="estado-circle-icon">
                      <Icon size={28} />
                    </div>
                    <span className="estado-step-label">{label}</span>
                    {timer && <span className="estado-step-time"><Timer {...getTimerProps(lavada, timer)} /></span>}
                  </button>
                )
              })}
            </div>

            <div className="lavada-card-tipo-adic">
              <div className="lavada-card-field">
                <label style={{ margin: '0.5rem 1rem 1.2rem' }}>Tipo de lavado</label>
                <select
                  value={lavada.tipo_lavado_id || ''}
                  onChange={(e) => onTipoLavadoChange(lavada.id, e.target.value)}
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
                  <label style={{ margin: '0.5rem 1rem' }}>Adicionales</label>
                  <div className="adicionales-circles">
                    {serviciosAdicionales.map(s => {
                      const checked = (lavada.adicionales || []).some(a => a.id === s.id)
                      return (
                        <button
                          type="button"
                          key={s.id}
                          className={`adicional-circle-btn ${checked ? 'active' : ''}`}
                          onClick={() => onAdicionalChange(lavada.id, s, !checked)}
                        >
                          <div className="adicional-circle-icon">
                            <Sparkles size={28} />
                          </div>
                          <span className="adicional-circle-label">{s.nombre}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="lavada-card-row">
              <div className="lavada-card-field full">
                <label style={{ margin: '0.5rem 1rem' }}>Lavador</label>
                <select
                  ref={lavadorSelectRef}
                  value={lavada.lavador_id || ''}
                  onChange={(e) => onLavadorChange(lavada.id, e.target.value)}
                  className={`lavador-select ${vErrs.lavador ? 'field-error' : ''}`}
                >
                  <option value="">Sin asignar</option>
                  {lavadores.map(l => (
                    <option key={l.id} value={l.id}>{l.nombre}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="lavada-card-notas">
              <label style={{ margin: '0.5rem 1rem' }}>Notas</label>
              <textarea
                className="notas-textarea"
                value={localNotas}
                onChange={(e) => {
                  const val = e.target.value
                  setLocalNotas(val)
                  lastLocalNotasRef.current = val
                  if (notasDebounceRef.current) clearTimeout(notasDebounceRef.current)
                  notasDebounceRef.current = setTimeout(() => {
                    onNotasChange?.(lavada.id, val)
                  }, 600)
                }}
                placeholder="Agregar notas del servicio..."
                rows={Math.max(2, Math.min(5, (localNotas || '').split('\n').length))}
              />
            </div>

            <div className="lavada-card-footer">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {editingValor ? (
                  <div className="valor-edit-inline">
                    <span className="valor-edit-prefix">{getCurrencySymbol()}</span>
                    <input
                      ref={valorInputRef}
                      className="valor-edit-input"
                      type="number"
                      inputMode="numeric"
                      autoComplete="off"
                      value={localValor}
                      onChange={(e) => setLocalValor(e.target.value)}
                      onBlur={() => {
                        if (valorEscapedRef.current) { valorEscapedRef.current = false; return }
                        const v = Math.max(0, Math.round(Number(localValor) || 0))
                        if (v !== total) onValorChange?.(lavada.id, v)
                        setEditingValor(false)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.target.blur()
                        if (e.key === 'Escape') { valorEscapedRef.current = true; setEditingValor(false) }
                      }}
                      style={{ width: `${Math.max(4, String(localValor).length + 1)}ch` }}
                    />
                  </div>
                ) : (
                  <div
                    className={`lavada-card-valor valor-editable ${(pagosOk && allMetodosSet) ? 'pago-ok' : total > 0 ? 'pago-error' : ''}`}
                    onClick={() => { valorEscapedRef.current = false; setLocalValor(String(total)); setEditingValor(true); setTimeout(() => valorInputRef.current?.select(), 50) }}
                  >
                    {formatMoney(total)}
                    <Pencil size={12} className="valor-edit-icon" />
                  </div>
                )}
                <button
                  className="pago-pill-add"
                  onClick={() => setPagoPopover(true)}
                >
                  <Plus size={14} />
                </button>
              </div>
              <div className={`lavada-card-pagos-pills ${vErrs.pagos ? 'field-error' : ''}`}>
                {activePagos.length === 0 && lavada.metodo_pago?.nombre && (
                  <span className="pago-pill legacy">{lavada.metodo_pago.nombre}</span>
                )}
                {activePagos.map((p, idx) => {
                  const isEditing = isEditingThisLavada && editingPago.idx === idx
                  const metodoNombre = p.nombre || metodosPago.find(m => m.id == p.metodo_pago_id)?.nombre

                  if (isEditing || !p.metodo_pago_id) {
                    return (
                      <div key={idx} className="pago-pill editing">
                        <select
                          value={p.metodo_pago_id || ''}
                          onChange={(e) => {
                            const metodo = metodosPago.find(m => m.id == e.target.value)
                            const nuevosPagos = activePagos.map((pg, i) =>
                              i === idx ? { ...pg, metodo_pago_id: e.target.value, nombre: metodo?.nombre || '' } : pg
                            )
                            updateLocalPagos(nuevosPagos)
                            if (e.target.value && p.valor > 0) onSetEditingPago(null)
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
                          value={p.valor === 0 ? '' : formatPriceLocale(p.valor)}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '')
                            const nuevosPagos = activePagos.map((pg, i) =>
                              i === idx ? { ...pg, valor: val === '' ? 0 : Number(val) } : pg
                            )
                            updateLocalPagos(nuevosPagos)
                          }}
                          onKeyDown={(e) => { if (e.key === 'Enter' && p.metodo_pago_id) onSetEditingPago(null) }}
                          className="pago-pill-input"
                          placeholder={getCurrencySymbol() + '0'}
                        />
                        <button
                          className="pago-pill-x"
                          onClick={() => {
                            const nuevosPagos = activePagos.filter((_, i) => i !== idx)
                            updateLocalPagos(nuevosPagos)
                            onSetEditingPago(null)
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
                      onClick={() => onSetEditingPago({ lavadaId: lavada.id, idx })}
                    >
                      <span className="pago-pill-metodo">{metodoNombre}</span>
                      <span className="pago-pill-valor">{formatMoney(p.valor)}</span>
                      <button
                        className="pago-pill-x"
                        onClick={(e) => {
                          e.stopPropagation()
                          const nuevosPagos = activePagos.filter((_, i) => i !== idx)
                          updateLocalPagos(nuevosPagos)
                        }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )
                })}
                {pagoPopover && renderPagoPopover()}
                {activePagos.length > 0 && !pagosOk && (
                  <span className="pago-diff-msg">
                    {diff > 0
                      ? `Excede ${formatMoney(diff)}`
                      : `Falta ${formatMoney(Math.abs(diff))}`}
                  </span>
                )}
              </div>
              <div className="lavada-card-actions">
                <div className="wa-menu-wrapper">
                  <button
                    ref={waButtonRef}
                    className="btn-whatsapp"
                    onClick={() => {
                      if (!waMenu && waButtonRef.current) {
                        const rect = waButtonRef.current.getBoundingClientRect()
                        setWaMenuPos({ bottom: window.innerHeight - rect.top + 4, right: window.innerWidth - rect.right })
                      }
                      setWaMenu(!waMenu)
                    }}
                    title="Enviar WhatsApp"
                  >
                    <MessageCircle size={18} />
                  </button>
                  {waMenu && (
                    <>
                      <div className="wa-menu-overlay" onClick={() => setWaMenu(false)} />
                      <div className="wa-menu-dropdown" style={{ bottom: waMenuPos.bottom, right: waMenuPos.right }}>
                        {plantillasMensaje.length > 0 ? plantillasMensaje.map(p => (
                          <button key={p.id} onClick={() => { setWaMenu(false); onWhatsApp(lavada, { plantillaId: p.id }) }}>
                            {p.nombre}
                          </button>
                        )) : (
                          <span style={{ padding: '8px 12px', color: '#999', fontSize: '0.85em' }}>No hay plantillas</span>
                        )}
                        <button onClick={() => { setWaMenu(false); onWhatsApp(lavada, {}) }}>
                          Ir al contacto
                        </button>
                        <button onClick={() => { setWaMenu(false); navigate('/cuenta?tab=config&subtab=mensajes') }}>
                          + Agregar plantilla
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <button
                  className="btn-eliminar-card"
                  onClick={() => onEliminar(lavada.id)}
                  title="Eliminar"
                >
                  <Trash2 size={24} style={{ margin: '0 1rem', color: 'var(--accent-red)' }} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
