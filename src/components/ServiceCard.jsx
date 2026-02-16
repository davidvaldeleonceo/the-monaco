import Timer from './common/Timer'
import { formatMoney } from '../utils/money'
import { ESTADO_LABELS } from '../config/constants'
import { MessageCircle, Trash2, ChevronDown, CheckCircle2, Plus, X } from 'lucide-react'

export default function ServiceCard({
  lavada,
  // Handlers
  onEstadoChange,
  onTipoLavadoChange,
  onAdicionalChange,
  onLavadorChange,
  onPagosChange,
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
}) {
  const pagos = lavada.pagos || []

  const total = Math.round(lavada.valor || 0)
  const sumaPagos = Math.round(pagos.reduce((s, p) => s + (Number(p.valor) || 0), 0))
  const diff = sumaPagos - total
  const pagosOk = total === 0 ? (pagos.length === 0 || Math.abs(diff) < 1) : (pagos.length > 0 && Math.abs(diff) < 1)
  const allMetodosSet = pagos.length === 0 || pagos.every(p => p.metodo_pago_id)
  const tipoOk = !!lavada.tipo_lavado_id
  const lavadorOk = !!lavada.lavador_id
  const canComplete = pagosOk && allMetodosSet && tipoOk && lavadorOk
  const yaEntregado = lavada.estado === 'ENTREGADO'
  const isEditingThisLavada = editingPago?.lavadaId === lavada.id

  const pagoStatus = pagosOk ? 'pagado' : sumaPagos > 0 ? 'parcial' : 'sin-pagar'
  const pagoLabel = pagoStatus === 'pagado' ? 'Pagado' : pagoStatus === 'parcial' ? 'Parcial' : 'Sin pagar'
  const vErrs = validationErrors || {}
  const showBody = isExpanded || isCollapsing

  const triggerValidationErrors = () => {
    const errs = {}
    if (!tipoOk) errs.tipo = true
    if (!lavadorOk) errs.lavador = true
    if (!pagosOk || !allMetodosSet) errs.pagos = true
    onSetValidationErrors(errs)
    setTimeout(() => onSetValidationErrors(null), 2000)
  }

  return (
    <div className={`lavada-card ${getEstadoClass(lavada.estado)}-border ${isExpanded && !isCollapsing ? 'expanded' : ''} ${isSelected ? 'card-selected' : ''} ${isUpdating ? 'card-updating' : ''}`}>
      <div
        className="lavada-card-header"
        onClick={() => selectionMode && onToggleSelect ? onToggleSelect(lavada.id) : onToggleExpand()}
      >
        <div className="lavada-card-cliente">
          {selectionMode && onToggleSelect && (
            <label className="custom-check" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleSelect(lavada.id)}
              />
              <span className="checkmark"></span>
            </label>
          )}
          <span className="lavada-card-nombre">{lavada.cliente?.nombre || 'No encontrado'} <span className="lavada-card-fecha">{new Date(lavada.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}</span></span>
          <span className="lavada-card-placa">{lavada.placa}</span>
        </div>
        <div className="lavada-card-summary">
          <span className={`pago-badge pago-badge-${pagoStatus}`}>{pagoLabel}</span>
          <span className={`estado-badge-mini ${getEstadoClass(lavada.estado)}`}>{ESTADO_LABELS[lavada.estado] || lavada.estado}</span>
          {hasActiveTimer(lavada) && (
            <span className={`lavada-card-timer ${getEstadoClass(lavada.estado)}`}>
              <Timer {...getTimerProps(lavada, lavada.estado === 'EN ESPERA' ? 'espera' : lavada.estado === 'EN LAVADO' ? 'lavado' : 'terminado')} />
            </span>
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
              onClick={(e) => { e.stopPropagation(); onEstadoChange(lavada.id, 'EN ESPERA') }}
            >
              <span className="estado-step-label">Espera</span>
              <span className="estado-step-time"><Timer {...getTimerProps(lavada, 'espera')} /></span>
            </button>
            <button
              className={`estado-step-btn estado-lavado-bg ${lavada.estado === 'EN LAVADO' ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); onEstadoChange(lavada.id, 'EN LAVADO') }}
            >
              <span className="estado-step-label">Lavado</span>
              <span className="estado-step-time"><Timer {...getTimerProps(lavada, 'lavado')} /></span>
            </button>
            <button
              className={`estado-step-btn estado-terminado-bg ${lavada.estado === 'TERMINADO' ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); onEstadoChange(lavada.id, 'TERMINADO') }}
            >
              <span className="estado-step-label">Terminado</span>
              <span className="estado-step-time"><Timer {...getTimerProps(lavada, 'terminado')} /></span>
            </button>
            <button
              className={`estado-step-btn estado-entregado-bg ${yaEntregado ? 'active' : ''} ${!canComplete && !yaEntregado ? 'disabled-look' : ''}`}
              title={yaEntregado ? 'Entregado' : (canComplete ? 'Marcar como entregado' : (
                !tipoOk ? 'Falta tipo de lavado' :
                  !lavadorOk ? 'Falta asignar lavador' :
                    pagos.length === 0 ? 'Agrega al menos un pago' :
                      !allMetodosSet ? 'Todos los pagos necesitan método' :
                        !pagosOk ? (diff > 0 ? `Pagos exceden ${formatMoney(diff)}` : `Faltan ${formatMoney(Math.abs(diff))}`) : ''
              ))}
              onClick={(e) => {
                e.stopPropagation()
                if (!canComplete) {
                  triggerValidationErrors()
                  return
                }
                onEstadoChange(lavada.id, 'ENTREGADO')
                onSmoothCollapse(lavada.id)
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
                          onChange={(e) => onAdicionalChange(lavada.id, s, e.target.checked)}
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
                          onPagosChange(lavada.id, nuevosPagos)
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
                        value={p.valor === 0 ? '' : Number(p.valor).toLocaleString('es-CO')}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '')
                          const nuevosPagos = pagos.map((pg, i) =>
                            i === idx ? { ...pg, valor: val === '' ? 0 : Number(val) } : pg
                          )
                          onPagosChange(lavada.id, nuevosPagos)
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter' && p.metodo_pago_id) onSetEditingPago(null) }}
                        className="pago-pill-input"
                        placeholder="$0"
                      />
                      <button
                        className="pago-pill-x"
                        onClick={() => {
                          const nuevosPagos = pagos.filter((_, i) => i !== idx)
                          onPagosChange(lavada.id, nuevosPagos)
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
                        const nuevosPagos = pagos.filter((_, i) => i !== idx)
                        onPagosChange(lavada.id, nuevosPagos)
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
                  onPagosChange(lavada.id, nuevosPagos)
                  onSetEditingPago({ lavadaId: lavada.id, idx: pagos.length })
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
                onClick={() => onWhatsApp(lavada)}
                title="Enviar WhatsApp"
                disabled={!pagosOk}
              >
                <MessageCircle size={18} />
              </button>
              <button
                className="btn-eliminar-card"
                onClick={() => onEliminar(lavada.id)}
                title="Eliminar"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <button
              className={`btn-completar-servicio ${yaEntregado ? 'completado' : ''} ${!canComplete && !yaEntregado ? 'error' : ''}`}
              title={yaEntregado ? 'Servicio entregado' : (canComplete ? 'Marcar como completado' : (
                !tipoOk ? 'Falta tipo de lavado' :
                  !lavadorOk ? 'Falta asignar lavador' :
                    pagos.length === 0 ? 'Agrega al menos un pago' :
                      !allMetodosSet ? 'Todos los pagos necesitan método' :
                        !pagosOk ? (diff > 0 ? `Pagos exceden ${formatMoney(diff)}` : `Faltan ${formatMoney(Math.abs(diff))}`) : ''
              ))}
              onClick={() => {
                if (yaEntregado) {
                  onSmoothCollapse(lavada.id)
                  return
                }
                if (!canComplete) {
                  triggerValidationErrors()
                  return
                }
                onEstadoChange(lavada.id, 'ENTREGADO')
                onSmoothCollapse(lavada.id)
              }}
            >
              <CheckCircle2 size={16} />
              {yaEntregado ? 'Completado' : 'Completar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
