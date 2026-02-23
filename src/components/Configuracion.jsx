import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useData } from './DataContext'
import { useTenant } from './TenantContext'
import { useToast } from './Toast'
import { Plus, X, Edit, Trash2, Settings, ChevronDown, Crown, Shield, MessageCircle, Mail, User, Check, LogOut } from 'lucide-react'
import { formatMoney } from '../utils/money'
import { API_URL, TOKEN_KEY, SESSION_KEY } from '../config/constants'
import UpgradeModal from './UpgradeModal'
import ConfirmDeleteModal from './common/ConfirmDeleteModal'
import PasswordInput from './common/PasswordInput'

export default function Configuracion() {
  const navigate = useNavigate()
  const { refreshConfig, serviciosAdicionales, productos, negocioId, tiposLavado } = useData()
  const { userProfile, isPro, planStatus, planCancelled, daysLeftInTrial, refresh, userEmail, negocioNombre } = useTenant()
  const toast = useToast()
  const isAdmin = userProfile?.rol === 'admin'
  const [activeTab, setActiveTab] = useState('datos')
  const [configSubTab, setConfigSubTab] = useState('membresias')
  const [editingField, setEditingField] = useState(null) // 'negocio' | 'email' | 'password'
  const [negocioNombreEdit, setNegocioNombreEdit] = useState('')
  const [emailEdit, setEmailEdit] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [datosError, setDatosError] = useState('')
  const [datosSaving, setDatosSaving] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [data, setData] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [formData, setFormData] = useState({})
  const [expandedCard, setExpandedCard] = useState(null)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [showFabMenu, setShowFabMenu] = useState(false)
  // Adicionales inline editing (inside lavados tab)
  const [adicionalEdit, setAdicionalEdit] = useState(null) // { id, nombre, precio } or { id: null, nombre, precio } for new
  const [showAdicionales, setShowAdicionales] = useState(true)
  const [pendingDeleteId, setPendingDeleteId] = useState(null)
  const [pendingAdicionalDeleteId, setPendingAdicionalDeleteId] = useState(null)
  const [pendingCancelSub, setPendingCancelSub] = useState(false)
  const [bulkForm, setBulkForm] = useState({
    tipo_pago: null,
    pago_porcentaje: '',
    pago_sueldo_base: '',
    pago_por_lavada: '',
    pago_por_adicional: '',
    pago_porcentaje_lavada: '',
    pago_adicional_fijo: '',
    pago_adicionales_detalle: null
  })

  const tabs = [
    { id: 'datos', label: 'Mi Cuenta' },
    ...(isAdmin ? [{ id: 'plan', label: 'Mi Plan' }] : []),
    ...(isAdmin ? [{ id: 'config', label: 'Configuración' }] : []),
    { id: 'soporte', label: 'Soporte' },
  ]

  const configSubTabs = [
    { id: 'membresias', label: 'Tipos de Cliente', table: 'tipos_membresia' },
    { id: 'lavados', label: 'Tipos de Servicio', table: 'tipos_lavado' },
    { id: 'metodos', label: 'Métodos de Pago', table: 'metodos_pago' },
    { id: 'lavadores', label: 'Lavadores', table: 'lavadores' },
    { id: 'productos', label: 'Productos', table: 'productos' },
    { id: 'mensajes', label: 'Mensajes', table: 'plantillas_mensaje' },
  ]

  // Handle ?tab=plan from URL
  const [searchParams] = useSearchParams()
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && tabs.some(t => t.id === tab)) setActiveTab(tab)
    const subtab = searchParams.get('subtab')
    if (subtab && configSubTabs.some(t => t.id === subtab)) {
      setActiveTab('config')
      setConfigSubTab(subtab)
    }
  }, [searchParams])


  useEffect(() => {
    if (activeTab === 'config') fetchData()
    setExpandedCard(null)
  }, [activeTab, configSubTab])

  const getTable = () => configSubTabs.find(t => t.id === configSubTab)?.table

  const fetchData = async () => {
    const { data: result } = await supabase
      .from(getTable())
      .select('*')
      .order('nombre')
    setData(result || [])
  }

  const getInitialForm = () => {
    switch (configSubTab) {
      case 'membresias':
        return { nombre: '', precio: '', descuento: '', cashback: '', duracion_dias: 1, activo: true }
      case 'lavados':
        return { nombre: '', precio: '', descripcion: '', adicionales_incluidos: [], activo: true, es_base: false }
      case 'metodos':
        return { nombre: '', activo: true }
      case 'lavadores':
        return { nombre: '', telefono: '', activo: true, tipo_pago: null, pago_porcentaje: '', pago_sueldo_base: '', pago_por_lavada: '', pago_por_adicional: '', pago_porcentaje_lavada: '', pago_adicional_fijo: '', pago_adicionales_detalle: null }
      case 'productos':
        return { nombre: '', precio: '', cantidad: '', activo: true }
      case 'mensajes':
        return { nombre: '', texto: '', activo: true }
      default:
        return {}
    }
  }

  const getEditableFields = () => {
    switch (configSubTab) {
      case 'membresias':
        return ['nombre', 'precio', 'descuento', 'cashback', 'duracion_dias', 'activo']
      case 'lavados':
        return ['nombre', 'precio', 'descripcion', 'adicionales_incluidos', 'activo', 'es_base']
      case 'metodos':
        return ['nombre', 'activo']
      case 'lavadores':
        return ['nombre', 'telefono', 'activo', 'tipo_pago', 'pago_porcentaje', 'pago_sueldo_base', 'pago_por_lavada', 'pago_por_adicional', 'pago_porcentaje_lavada', 'pago_adicional_fijo', 'pago_adicionales_detalle']
      case 'productos':
        return ['nombre', 'precio', 'cantidad', 'activo']
      case 'mensajes':
        return ['nombre', 'texto', 'activo']
      default:
        return []
    }
  }

  const stringFields = ['nombre', 'telefono', 'descripcion', 'tipo_pago', 'activo', 'pago_adicionales_detalle', 'adicionales_incluidos', 'es_base', 'texto']

  const numVal = (v) => v === '' || v === null || v === undefined ? '' : v
  const numChange = (field) => (e) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value === '' ? '' : Number(e.target.value) }))
  }
  const bulkNumChange = (field) => (e) => {
    setBulkForm(prev => ({ ...prev, [field]: e.target.value === '' ? '' : Number(e.target.value) }))
  }

  const cleanForSave = (obj) => {
    const cleaned = { ...obj }
    for (const key of Object.keys(cleaned)) {
      if (stringFields.includes(key)) continue
      if (Array.isArray(cleaned[key])) continue
      if (cleaned[key] === '' || cleaned[key] === null || cleaned[key] === undefined) {
        cleaned[key] = 0
      }
    }
    if (cleaned.tipo_pago === '') cleaned.tipo_pago = null
    // UUID[] column: convert JS array to PostgreSQL array literal or omit for default
    if ('adicionales_incluidos' in cleaned) {
      let arr = cleaned.adicionales_incluidos
      if (!Array.isArray(arr)) {
        try { arr = JSON.parse(arr) } catch { arr = [] }
        if (!Array.isArray(arr)) arr = []
      }
      if (arr.length === 0) {
        delete cleaned.adicionales_incluidos
      } else {
        cleaned.adicionales_incluidos = `{${arr.join(',')}}`
      }
    }
    return cleaned
  }

  const handleNew = () => {
    setEditando(null)
    setFormData(getInitialForm())
    setShowModal(true)
  }

  const handleEdit = (item) => {
    setEditando(item.id)
    const fields = getEditableFields()
    const editData = {}
    for (const f of fields) {
      if (f === 'tipo_pago') {
        editData[f] = item[f] || null
      } else if (f === 'pago_adicionales_detalle') {
        editData[f] = item[f] || null
      } else if (f === 'adicionales_incluidos') {
        const raw = item[f]
        editData[f] = Array.isArray(raw) ? raw : []
      } else if (stringFields.includes(f)) {
        editData[f] = item[f] ?? ''
      } else {
        editData[f] = item[f] ?? ''
      }
    }
    setFormData(editData)
    setShowModal(true)
  }

  const requestDeleteConfig = (id) => {
    setPendingDeleteId(id)
  }

  const executeDeleteConfig = async () => {
    const id = pendingDeleteId
    if (!id) return
    const { error } = await supabase.from(getTable()).delete().eq('id', id)
    if (error) {
      toast.error('Error al eliminar: ' + error.message)
    } else {
      fetchData()
      refreshConfig()
    }
    setPendingDeleteId(null)
  }

  const handleToggleActive = async (item) => {
    const newStatus = !item.activo
    setData(data.map(d => d.id === item.id ? { ...d, activo: newStatus } : d))

    const { error } = await supabase.from(getTable()).update({ activo: newStatus }).eq('id', item.id)

    if (error) {
      toast.error(`Error al actualizar estado: ${error.message}`)
      fetchData()
    }
    refreshConfig()
  }

  const handleToggleBase = async (item) => {
    const newBase = !item.es_base
    if (newBase) {
      // Optimistic: set all to false, then this one to true
      setData(data.map(d => ({ ...d, es_base: d.id === item.id })))
      // DB: clear all, then set this one
      await supabase.from('tipos_lavado').update({ es_base: false }).eq('negocio_id', negocioId)
      await supabase.from('tipos_lavado').update({ es_base: true }).eq('id', item.id)
    } else {
      setData(data.map(d => d.id === item.id ? { ...d, es_base: false } : d))
      await supabase.from('tipos_lavado').update({ es_base: false }).eq('id', item.id)
    }
    refreshConfig()
  }

  const handleTipoPagoInline = async (item, nuevoTipo) => {
    const valor = nuevoTipo || null
    setData(data.map(d => d.id === item.id ? { ...d, tipo_pago: valor } : d))

    const { error } = await supabase
      .from('lavadores')
      .update({ tipo_pago: valor })
      .eq('id', item.id)

    if (error) {
      toast.error('Error al actualizar tipo de pago: ' + error.message)
      fetchData()
    }
    refreshConfig()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const fields = getEditableFields()
    const payload = {}
    for (const f of fields) {
      payload[f] = formData[f]
    }
    const cleaned = cleanForSave(payload)

    // If saving a lavado as base, clear others first
    if (configSubTab === 'lavados' && cleaned.es_base) {
      await supabase.from('tipos_lavado').update({ es_base: false }).eq('negocio_id', negocioId)
    }

    let error
    if (editando) {
      const res = await supabase.from(getTable()).update(cleaned).eq('id', editando)
      error = res.error
    } else {
      const res = await supabase.from(getTable()).insert([{ ...cleaned, negocio_id: negocioId }])
      error = res.error
    }

    if (error) {
      toast.error('Error al guardar: ' + error.message)
      return
    }

    setShowModal(false)
    setEditando(null)
    fetchData()
    refreshConfig()
  }

  const handleBulkSubmit = async (e) => {
    e.preventDefault()
    const cleaned = cleanForSave({ ...bulkForm })
    const { error } = await supabase
      .from('lavadores')
      .update(cleaned)
      .eq('activo', true)

    if (error) {
      toast.error('Error al actualizar: ' + error.message)
    } else {
      setShowBulkModal(false)
      fetchData()
      refreshConfig()
    }
  }


  // ─── Adicionales CRUD ─────────────────────────────────────────────
  const handleAdicionalSave = async () => {
    if (!adicionalEdit || !adicionalEdit.nombre.trim()) return
    const payload = { nombre: adicionalEdit.nombre.trim(), precio: Number(adicionalEdit.precio) || 0, activo: true }
    let error
    if (adicionalEdit.id) {
      const res = await supabase.from('servicios_adicionales').update(payload).eq('id', adicionalEdit.id)
      error = res.error
    } else {
      const res = await supabase.from('servicios_adicionales').insert([{ ...payload, negocio_id: negocioId }])
      error = res.error
    }
    if (error) { toast.error('Error: ' + error.message); return }
    setAdicionalEdit(null)
    refreshConfig()
  }

  const requestAdicionalDelete = (id) => {
    setPendingAdicionalDeleteId(id)
  }

  const executeAdicionalDelete = async () => {
    const id = pendingAdicionalDeleteId
    if (!id) return
    const { error } = await supabase.from('servicios_adicionales').delete().eq('id', id)
    if (error) { toast.error('Error: ' + error.message); return }
    refreshConfig()
    setPendingAdicionalDeleteId(null)
  }

  const handleAdicionalToggle = async (item) => {
    const { error } = await supabase.from('servicios_adicionales').update({ activo: !item.activo }).eq('id', item.id)
    if (error) { toast.error('Error: ' + error.message); return }
    refreshConfig()
  }

  const formatPct = (v) => (Number(v) || 0) + '%'

  const getDetallePago = (item) => {
    if (!item.tipo_pago) return '-'
    if (item.tipo_pago === 'porcentaje') {
      return formatPct(item.pago_porcentaje) + ' del valor total'
    }
    if (item.tipo_pago === 'sueldo_fijo') {
      return `Base ${formatMoney(item.pago_sueldo_base || 0)} + ${formatMoney(item.pago_por_lavada || 0)}/lav + ${formatMoney(item.pago_por_adicional || 0)}/adic`
    }
    if (item.tipo_pago === 'porcentaje_lavada') {
      const tipoBase = tiposLavado.find(t => t.es_base)
      const baseLabel = tipoBase ? `${tipoBase.nombre} (${formatMoney(tipoBase.precio)})` : 'lavada básica'
      const adicInfo = item.pago_adicionales_detalle
        ? 'valor por servicio'
        : `${formatMoney(item.pago_adicional_fijo || 0)}/adic`
      return `${formatPct(item.pago_porcentaje_lavada)} de ${baseLabel} + ${adicInfo}`
    }
    return '-'
  }

  const getModoAdicional = (formObj) => {
    return formObj.pago_adicionales_detalle ? 'por_servicio' : 'mismo_valor'
  }

  const handleModoAdicionalChange = (setFn, formObj, modo) => {
    if (modo === 'por_servicio') {
      const detalle = {}
      serviciosAdicionales.forEach(s => { detalle[s.id] = 0 })
      setFn(prev => ({ ...prev, pago_adicionales_detalle: detalle, pago_adicional_fijo: '' }))
    } else {
      setFn(prev => ({ ...prev, pago_adicionales_detalle: null, pago_adicional_fijo: '' }))
    }
  }

  const handleDetalleAdicionalChange = (setFn, servicioId, value) => {
    setFn(prev => ({
      ...prev,
      pago_adicionales_detalle: {
        ...(prev.pago_adicionales_detalle || {}),
        [servicioId]: value === '' ? '' : Number(value)
      }
    }))
  }

  const renderAdicionalesSection = () => (
    <div key="adicionales-section" className="adicionales-section">
      <div className="adicionales-section-header" onClick={() => setShowAdicionales(!showAdicionales)}>
        <h3>Servicios Adicionales ({serviciosAdicionales.length})</h3>
        <ChevronDown size={16} className={showAdicionales ? 'rotated' : ''} />
      </div>
      {showAdicionales && (
        <div className="adicionales-section-body">
          {serviciosAdicionales.map(s => (
            <div key={s.id} className="adicional-row">
              {adicionalEdit?.id === s.id ? (
                <>
                  <input
                    type="text"
                    className="adicional-input"
                    value={adicionalEdit.nombre}
                    onChange={(e) => setAdicionalEdit({ ...adicionalEdit, nombre: e.target.value })}
                    placeholder="Nombre"
                    autoFocus
                  />
                  <input
                    type="number"
                    className="adicional-input adicional-input-precio"
                    value={adicionalEdit.precio}
                    onChange={(e) => setAdicionalEdit({ ...adicionalEdit, precio: e.target.value })}
                    placeholder="Precio"
                  />
                  <button className="btn-icon" onClick={handleAdicionalSave} title="Guardar"><Plus size={16} style={{ transform: 'rotate(45deg)' }} /></button>
                  <button className="btn-icon" onClick={() => setAdicionalEdit(null)} title="Cancelar"><X size={16} /></button>
                </>
              ) : (
                <>
                  <span className="adicional-nombre">{s.nombre}</span>
                  <span className="adicional-precio">{formatMoney(s.precio)}</span>
                  <label className="switch switch-sm" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={s.activo} onChange={() => handleAdicionalToggle(s)} />
                    <span className="slider"></span>
                  </label>
                  <button className="btn-icon" onClick={() => setAdicionalEdit({ id: s.id, nombre: s.nombre, precio: s.precio })} title="Editar"><Edit size={14} /></button>
                  <button className="btn-icon delete" onClick={() => requestAdicionalDelete(s.id)} title="Eliminar"><Trash2 size={14} /></button>
                </>
              )}
            </div>
          ))}
          {adicionalEdit?.id === null ? (
            <div className="adicional-row adicional-row-new">
              <input
                type="text"
                className="adicional-input"
                value={adicionalEdit.nombre}
                onChange={(e) => setAdicionalEdit({ ...adicionalEdit, nombre: e.target.value })}
                placeholder="Nombre del adicional"
                autoFocus
              />
              <input
                type="number"
                className="adicional-input adicional-input-precio"
                value={adicionalEdit.precio}
                onChange={(e) => setAdicionalEdit({ ...adicionalEdit, precio: e.target.value })}
                placeholder="Precio"
              />
              <button className="btn-icon" onClick={handleAdicionalSave} title="Guardar"><Plus size={16} /></button>
              <button className="btn-icon" onClick={() => setAdicionalEdit(null)} title="Cancelar"><X size={16} /></button>
            </div>
          ) : (
            <button className="btn-add-adicional" onClick={() => setAdicionalEdit({ id: null, nombre: '', precio: '' })}>
              <Plus size={14} /> Agregar adicional
            </button>
          )}
        </div>
      )}
    </div>
  )

  const renderTable = () => {
    switch (configSubTab) {
      case 'membresias':
        return (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Precio</th>
                  <th>Descuento</th>
                  <th>Duración</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.map(item => (
                  <tr key={item.id}>
                    <td>{item.nombre}</td>
                    <td>{formatMoney(item.precio)}</td>
                    <td>{(item.descuento * 100).toFixed(0)}%</td>
                    <td>{item.duracion_dias === 1 ? '1 mes' : `${item.duracion_dias} meses`}</td>
                    <td>
                      <label className="switch">
                        <input type="checkbox" checked={item.activo} onChange={() => handleToggleActive(item)} />
                        <span className="slider"></span>
                      </label>
                    </td>
                    <td>
                      <div className="acciones">
                        <button className="btn-icon" onClick={() => handleEdit(item)}><Edit size={18} /></button>
                        <button className="btn-icon delete" onClick={() => requestDeleteConfig(item.id)}><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      case 'lavados':
        return (
          <>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Precio</th>
                    <th>Incluye</th>
                    <th>Base</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map(item => {
                    const inclNames = (item.adicionales_incluidos || [])
                      .map(id => serviciosAdicionales.find(s => s.id === id)?.nombre)
                      .filter(Boolean)
                    return (
                      <tr key={item.id}>
                        <td>{item.nombre}</td>
                        <td>{formatMoney(item.precio)}</td>
                        <td style={{ fontSize: '0.85em', color: inclNames.length ? 'inherit' : '#999' }}>
                          {inclNames.length ? inclNames.join(', ') : '—'}
                        </td>
                        <td>
                          <label className="switch">
                            <input type="checkbox" checked={!!item.es_base} onChange={() => handleToggleBase(item)} />
                            <span className="slider"></span>
                          </label>
                        </td>
                        <td>
                          <label className="switch">
                            <input type="checkbox" checked={item.activo} onChange={() => handleToggleActive(item)} />
                            <span className="slider"></span>
                          </label>
                        </td>
                        <td>
                          <div className="acciones">
                            <button className="btn-icon" onClick={() => handleEdit(item)}><Edit size={18} /></button>
                            <button className="btn-icon delete" onClick={() => requestDeleteConfig(item.id)}><Trash2 size={18} /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {renderAdicionalesSection()}
          </>
        )
      case 'metodos':
        return (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.map(item => (
                  <tr key={item.id}>
                    <td>{item.nombre}</td>
                    <td>
                      <label className="switch">
                        <input type="checkbox" checked={item.activo} onChange={() => handleToggleActive(item)} />
                        <span className="slider"></span>
                      </label>
                    </td>
                    <td>
                      <div className="acciones">
                        <button className="btn-icon" onClick={() => handleEdit(item)}><Edit size={18} /></button>
                        <button className="btn-icon delete" onClick={() => requestDeleteConfig(item.id)}><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      case 'lavadores':
        return (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Teléfono</th>
                  <th>Modo de Pago</th>
                  <th>Detalle</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.map(item => (
                  <tr key={item.id}>
                    <td>{item.nombre}</td>
                    <td className="lavador-telefono">{item.telefono || '-'}</td>
                    <td>
                      <select
                        value={item.tipo_pago || ''}
                        onChange={(e) => handleTipoPagoInline(item, e.target.value)}
                        className="config-inline-select"
                      >
                        <option value="">Sin configurar</option>
                        <option value="porcentaje">Porcentaje</option>
                        <option value="sueldo_fijo">Sueldo fijo</option>
                        <option value="porcentaje_lavada">% de lavada + adic.</option>
                      </select>
                    </td>
                    <td className={`lavador-detalle ${!item.tipo_pago ? 'muted' : ''}`}>
                      {getDetallePago(item)}
                    </td>
                    <td>
                      <label className="switch">
                        <input type="checkbox" checked={item.activo} onChange={() => handleToggleActive(item)} />
                        <span className="slider"></span>
                      </label>
                    </td>
                    <td>
                      <div className="acciones">
                        <button className="btn-icon" onClick={() => handleEdit(item)}><Edit size={18} /></button>
                        <button className="btn-icon delete" onClick={() => requestDeleteConfig(item.id)}><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      case 'productos':
        return (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Precio</th>
                  <th>Cantidad</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.map(item => (
                  <tr key={item.id}>
                    <td>{item.nombre}</td>
                    <td>{formatMoney(item.precio)}</td>
                    <td>{item.cantidad}</td>
                    <td>
                      <label className="switch">
                        <input type="checkbox" checked={item.activo} onChange={() => handleToggleActive(item)} />
                        <span className="slider"></span>
                      </label>
                    </td>
                    <td>
                      <div className="acciones">
                        <button className="btn-icon" onClick={() => handleEdit(item)}><Edit size={18} /></button>
                        <button className="btn-icon delete" onClick={() => requestDeleteConfig(item.id)}><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      case 'mensajes':
        return (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Texto</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.map(item => (
                  <tr key={item.id}>
                    <td>{item.nombre}</td>
                    <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.texto}</td>
                    <td>
                      <label className="switch">
                        <input type="checkbox" checked={item.activo} onChange={() => handleToggleActive(item)} />
                        <span className="slider"></span>
                      </label>
                    </td>
                    <td>
                      <div className="acciones">
                        <button className="btn-icon" onClick={() => handleEdit(item)}><Edit size={18} /></button>
                        <button className="btn-icon delete" onClick={() => requestDeleteConfig(item.id)}><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      default:
        return null
    }
  }

  const renderMobileCards = () => {
    if (data.length === 0) return null

    switch (configSubTab) {
      case 'membresias':
        return data.map(item => {
          const isExpanded = expandedCard === item.id
          return (
            <div key={item.id} className={`config-card ${isExpanded ? 'expanded' : ''}`}>
              <div className="config-card-header" onClick={() => setExpandedCard(isExpanded ? null : item.id)}>
                <div className="config-card-left">
                  <span className="config-card-nombre">{item.nombre}</span>
                  <span className="config-card-sub">{formatMoney(item.precio)}</span>
                </div>
                <div className="config-card-right">
                  <label className="switch" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={item.activo} onChange={() => handleToggleActive(item)} />
                    <span className="slider"></span>
                  </label>
                  <ChevronDown size={16} className={`cliente-card-chevron ${isExpanded ? 'rotated' : ''}`} />
                </div>
              </div>
              {isExpanded && (
                <div className="config-card-body">
                  <div className="cliente-card-row">
                    <span className="cliente-card-label">Descuento</span>
                    <span className="cliente-card-value">{(item.descuento * 100).toFixed(0)}%</span>
                  </div>
                  <div className="cliente-card-row">
                    <span className="cliente-card-label">Duración</span>
                    <span className="cliente-card-value">{item.duracion_dias === 1 ? '1 mes' : `${item.duracion_dias} meses`}</span>
                  </div>
                  <div className="cliente-card-actions">
                    <button className="btn-secondary" onClick={() => handleEdit(item)}><Edit size={16} /> Editar</button>
                    <button className="btn-secondary btn-danger-outline" onClick={() => requestDeleteConfig(item.id)}><Trash2 size={16} /> Eliminar</button>
                  </div>
                </div>
              )}
            </div>
          )
        })
      case 'lavados':
        return data.map(item => {
          const isExpanded = expandedCard === item.id
          const inclNames = (item.adicionales_incluidos || [])
            .map(id => serviciosAdicionales.find(s => s.id === id)?.nombre)
            .filter(Boolean)
          return (
            <div key={item.id} className={`config-card ${isExpanded ? 'expanded' : ''}`}>
              <div className="config-card-header" onClick={() => setExpandedCard(isExpanded ? null : item.id)}>
                <div className="config-card-left">
                  <span className="config-card-nombre">
                    {item.nombre}
                    {item.es_base && <span className="badge-base">Base</span>}
                  </span>
                  <span className="config-card-sub">{formatMoney(item.precio)}</span>
                </div>
                <div className="config-card-right">
                  <label className="switch" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={item.activo} onChange={() => handleToggleActive(item)} />
                    <span className="slider"></span>
                  </label>
                  <ChevronDown size={16} className={`cliente-card-chevron ${isExpanded ? 'rotated' : ''}`} />
                </div>
              </div>
              {isExpanded && (
                <div className="config-card-body">
                  {inclNames.length > 0 && (
                    <div className="config-card-incluye">
                      {inclNames.map(name => (
                        <span key={name} className="tag-incluido">{name}</span>
                      ))}
                    </div>
                  )}
                  <div className="cliente-card-row">
                    <span className="cliente-card-label">Lavada Base</span>
                    <label className="switch" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={!!item.es_base} onChange={() => handleToggleBase(item)} />
                      <span className="slider"></span>
                    </label>
                  </div>
                  <div className="cliente-card-actions">
                    <button className="btn-secondary" onClick={() => handleEdit(item)}><Edit size={16} /> Editar</button>
                    <button className="btn-secondary btn-danger-outline" onClick={() => requestDeleteConfig(item.id)}><Trash2 size={16} /> Eliminar</button>
                  </div>
                </div>
              )}
            </div>
          )
        }).concat(renderAdicionalesSection())
      case 'metodos':
        return data.map(item => (
          <div key={item.id} className="config-card">
            <div className="config-card-header">
              <div className="config-card-left">
                <span className="config-card-nombre">{item.nombre}</span>
              </div>
              <div className="config-card-right">
                <label className="switch" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={item.activo} onChange={() => handleToggleActive(item)} />
                  <span className="slider"></span>
                </label>
                <button className="btn-icon" onClick={() => handleEdit(item)}><Edit size={16} /></button>
                <button className="btn-icon delete" onClick={() => requestDeleteConfig(item.id)}><Trash2 size={16} /></button>
              </div>
            </div>
          </div>
        ))
      case 'lavadores':
        return data.map(item => {
          const isExpanded = expandedCard === item.id
          return (
            <div key={item.id} className={`config-card ${isExpanded ? 'expanded' : ''}`}>
              <div className="config-card-header" onClick={() => setExpandedCard(isExpanded ? null : item.id)}>
                <div className="config-card-left">
                  <span className="config-card-nombre">{item.nombre}</span>
                  <span className="config-card-sub">{item.telefono || 'Sin teléfono'}</span>
                </div>
                <div className="config-card-right">
                  <label className="switch" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={item.activo} onChange={() => handleToggleActive(item)} />
                    <span className="slider"></span>
                  </label>
                  <ChevronDown size={16} className={`cliente-card-chevron ${isExpanded ? 'rotated' : ''}`} />
                </div>
              </div>
              {isExpanded && (
                <div className="config-card-body">
                  <div className="cliente-card-row">
                    <span className="cliente-card-label">Modo de Pago</span>
                    <span className="cliente-card-value">
                      <select
                        value={item.tipo_pago || ''}
                        onChange={(e) => handleTipoPagoInline(item, e.target.value)}
                        className="config-inline-select"
                        onClick={e => e.stopPropagation()}
                      >
                        <option value="">Sin configurar</option>
                        <option value="porcentaje">Porcentaje</option>
                        <option value="sueldo_fijo">Sueldo fijo</option>
                        <option value="porcentaje_lavada">% lavada + adic.</option>
                      </select>
                    </span>
                  </div>
                  <div className="cliente-card-row">
                    <span className="cliente-card-label">Detalle</span>
                    <span className={`cliente-card-value lavador-detalle ${!item.tipo_pago ? 'muted' : ''}`}>{getDetallePago(item)}</span>
                  </div>
                  <div className="cliente-card-actions">
                    <button className="btn-secondary" onClick={() => handleEdit(item)}><Edit size={16} /> Editar</button>
                    <button className="btn-secondary btn-danger-outline" onClick={() => requestDeleteConfig(item.id)}><Trash2 size={16} /> Eliminar</button>
                  </div>
                </div>
              )}
            </div>
          )
        })
      case 'productos':
        return data.map(item => {
          const isExpanded = expandedCard === item.id
          return (
            <div key={item.id} className={`config-card ${isExpanded ? 'expanded' : ''}`}>
              <div className="config-card-header" onClick={() => setExpandedCard(isExpanded ? null : item.id)}>
                <div className="config-card-left">
                  <span className="config-card-nombre">{item.nombre}</span>
                  <span className="config-card-sub">{formatMoney(item.precio)} · {item.cantidad} disp.</span>
                </div>
                <div className="config-card-right">
                  <label className="switch" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={item.activo} onChange={() => handleToggleActive(item)} />
                    <span className="slider"></span>
                  </label>
                  <ChevronDown size={16} className={`cliente-card-chevron ${isExpanded ? 'rotated' : ''}`} />
                </div>
              </div>
              {isExpanded && (
                <div className="config-card-body">
                  <div className="cliente-card-row">
                    <span className="cliente-card-label">Precio</span>
                    <span className="cliente-card-value">{formatMoney(item.precio)}</span>
                  </div>
                  <div className="cliente-card-row">
                    <span className="cliente-card-label">Cantidad</span>
                    <span className="cliente-card-value">{item.cantidad}</span>
                  </div>
                  <div className="cliente-card-actions">
                    <button className="btn-secondary" onClick={() => handleEdit(item)}><Edit size={16} /> Editar</button>
                    <button className="btn-secondary btn-danger-outline" onClick={() => requestDeleteConfig(item.id)}><Trash2 size={16} /> Eliminar</button>
                  </div>
                </div>
              )}
            </div>
          )
        })
      case 'mensajes':
        return data.map(item => {
          const isExpanded = expandedCard === item.id
          return (
            <div key={item.id} className={`config-card ${isExpanded ? 'expanded' : ''}`}>
              <div className="config-card-header" onClick={() => setExpandedCard(isExpanded ? null : item.id)}>
                <div className="config-card-left">
                  <span className="config-card-nombre">{item.nombre}</span>
                  <span className="config-card-sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>{item.texto}</span>
                </div>
                <div className="config-card-right">
                  <label className="switch" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={item.activo} onChange={() => handleToggleActive(item)} />
                    <span className="slider"></span>
                  </label>
                  <ChevronDown size={16} className={`cliente-card-chevron ${isExpanded ? 'rotated' : ''}`} />
                </div>
              </div>
              {isExpanded && (
                <div className="config-card-body">
                  <div className="cliente-card-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                    <span className="cliente-card-label">Texto completo</span>
                    <span className="cliente-card-value" style={{ whiteSpace: 'pre-wrap', fontSize: '0.9em' }}>{item.texto}</span>
                  </div>
                  <p style={{ fontSize: '0.8em', color: '#888', margin: '8px 0 4px' }}>
                    Variables: {'{nombre}'}, {'{telefono}'}, {'{negocio}'}, {'{membresia}'}, {'{estado_membresia}'}, {'{vencimiento}'}, {'{placa}'}, {'{ultimo_servicio}'}, {'{valor_ultimo}'}
                  </p>
                  <div className="cliente-card-actions">
                    <button className="btn-secondary" onClick={() => handleEdit(item)}><Edit size={16} /> Editar</button>
                    <button className="btn-secondary btn-danger-outline" onClick={() => requestDeleteConfig(item.id)}><Trash2 size={16} /> Eliminar</button>
                  </div>
                </div>
              )}
            </div>
          )
        })
      default:
        return null
    }
  }

  const renderPagoFields = (formObj, setFn, changeHandler) => (
    <>
      <div className="form-group">
        <label>Tipo de Pago</label>
        <select value={formObj.tipo_pago || ''} onChange={(e) => setFn(prev => ({ ...prev, tipo_pago: e.target.value || null }))}>
          <option value="">Sin configurar</option>
          <option value="porcentaje">Porcentaje del valor total</option>
          <option value="sueldo_fijo">Sueldo fijo + adicionales</option>
          <option value="porcentaje_lavada">% sobre lavada básica + adicionales</option>
        </select>
      </div>
      {formObj.tipo_pago === 'porcentaje' && (
        <div className="form-group">
          <label>Porcentaje sobre el valor total (ej: 40 = 40%)</label>
          <input type="number" value={numVal(formObj.pago_porcentaje)} onChange={changeHandler('pago_porcentaje')} />
        </div>
      )}
      {formObj.tipo_pago === 'sueldo_fijo' && (
        <>
          <div className="form-group">
            <label>Sueldo Base</label>
            <input type="number" value={numVal(formObj.pago_sueldo_base)} onChange={changeHandler('pago_sueldo_base')} />
          </div>
          <div className="form-group">
            <label>Pago por Lavada</label>
            <input type="number" value={numVal(formObj.pago_por_lavada)} onChange={changeHandler('pago_por_lavada')} />
          </div>
          <div className="form-group">
            <label>Pago por Adicional</label>
            <input type="number" value={numVal(formObj.pago_por_adicional)} onChange={changeHandler('pago_por_adicional')} />
          </div>
        </>
      )}
      {formObj.tipo_pago === 'porcentaje_lavada' && (
        <>
          {(() => {
            const tipoBase = tiposLavado.find(t => t.es_base)
            return tipoBase ? (
              <div className="info-box">
                Lavada base: <strong>{tipoBase.nombre}</strong> ({formatMoney(tipoBase.precio)})
              </div>
            ) : (
              <div className="info-box warning">
                No hay lavada base configurada. Ve a Tipos de Servicio y marca una como "Base".
              </div>
            )
          })()}
          <div className="form-group">
            <label>% sobre lavada básica (ej: 40 = 40%)</label>
            <input type="number" value={numVal(formObj.pago_porcentaje_lavada)} onChange={changeHandler('pago_porcentaje_lavada')} />
          </div>
          <div className="form-group">
            <label>Pago por adicionales</label>
            <select
              value={getModoAdicional(formObj)}
              onChange={(e) => handleModoAdicionalChange(setFn, formObj, e.target.value)}
            >
              <option value="mismo_valor">Mismo valor por cada adicional</option>
              <option value="por_servicio">Valor diferente por servicio</option>
            </select>
          </div>
          {getModoAdicional(formObj) === 'mismo_valor' && (
            <div className="form-group">
              <label>Pago fijo por cada adicional</label>
              <input type="number" value={numVal(formObj.pago_adicional_fijo)} onChange={changeHandler('pago_adicional_fijo')} />
            </div>
          )}
          {getModoAdicional(formObj) === 'por_servicio' && (
            <>
              <div className="adicionales-config-list">
                {Object.keys(formObj.pago_adicionales_detalle || {}).map(id => {
                  const s = serviciosAdicionales.find(serv => serv.id === id)
                  if (!s) return null
                  return (
                    <div className="form-group-row" key={id}>
                      <label style={{ flex: 1 }}>{s.nombre}</label>
                      <input
                        type="number"
                        style={{ width: '100px' }}
                        value={numVal(formObj.pago_adicionales_detalle[id])}
                        onChange={(e) => handleDetalleAdicionalChange(setFn, id, e.target.value)}
                        placeholder="$0"
                      />
                      <button
                        type="button"
                        className="btn-icon delete"
                        onClick={() => {
                          const newDetalle = { ...formObj.pago_adicionales_detalle }
                          delete newDetalle[id]
                          setFn(prev => ({ ...prev, pago_adicionales_detalle: newDetalle }))
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )
                })}
              </div>

              <div className="form-group">
                <select
                  value=""
                  onChange={(e) => {
                    const id = e.target.value
                    if (id) {
                      setFn(prev => ({
                        ...prev,
                        pago_adicionales_detalle: {
                          ...(prev.pago_adicionales_detalle || {}),
                          [id]: 0
                        }
                      }))
                    }
                  }}
                  className="add-service-select"
                >
                  <option value="">+ Agregar servicio adicional</option>
                  {serviciosAdicionales
                    .filter(s => !formObj.pago_adicionales_detalle?.[s.id])
                    .map(s => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                </select>
              </div>
            </>
          )}
        </>
      )}
    </>
  )

  const renderForm = () => {
    switch (configSubTab) {
      case 'membresias':
        return (
          <>
            <div className="form-group">
              <label>Nombre</label>
              <input type="text" value={formData.nombre || ''} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Precio</label>
              <input type="number" value={numVal(formData.precio)} onChange={numChange('precio')} required />
            </div>
            <div className="form-group">
              <label>Descuento (decimal, ej: 0.4 = 40%)</label>
              <input type="number" step="0.01" value={numVal(formData.descuento)} onChange={numChange('descuento')} />
            </div>
            <div className="form-group">
              <label>Duración (meses)</label>
              <input type="number" min="1" value={numVal(formData.duracion_dias)} onChange={numChange('duracion_dias')} required />
            </div>
            <div className="form-group checkbox-group">
              <label><input type="checkbox" checked={formData.activo} onChange={(e) => setFormData({ ...formData, activo: e.target.checked })} /> Activo</label>
            </div>
          </>
        )
      case 'lavados':
        return (
          <>
            <div className="form-group">
              <label>Nombre</label>
              <input type="text" value={formData.nombre || ''} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Precio</label>
              <input type="number" value={numVal(formData.precio)} onChange={numChange('precio')} required />
            </div>
            {serviciosAdicionales.length > 0 && (
              <div className="form-group">
                <label>Adicionales incluidos en el precio</label>
                <div className="adicionales-check-list">
                  {serviciosAdicionales.map(s => (
                    <label key={s.id} className="adicional-check-item">
                      <input
                        type="checkbox"
                        checked={(formData.adicionales_incluidos || []).includes(s.id)}
                        onChange={(e) => {
                          const current = formData.adicionales_incluidos || []
                          setFormData({
                            ...formData,
                            adicionales_incluidos: e.target.checked
                              ? [...current, s.id]
                              : current.filter(id => id !== s.id)
                          })
                        }}
                      />
                      {s.nombre}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="form-group checkbox-group">
              <label><input type="checkbox" checked={formData.activo} onChange={(e) => setFormData({ ...formData, activo: e.target.checked })} /> Activo</label>
            </div>
            <div className="form-group checkbox-group">
              <label><input type="checkbox" checked={!!formData.es_base} onChange={(e) => setFormData({ ...formData, es_base: e.target.checked })} /> Lavada base (para cálculo de pago %)</label>
            </div>
          </>
        )
      case 'metodos':
        return (
          <>
            <div className="form-group">
              <label>Nombre</label>
              <input type="text" value={formData.nombre || ''} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} required />
            </div>
            <div className="form-group checkbox-group">
              <label><input type="checkbox" checked={formData.activo} onChange={(e) => setFormData({ ...formData, activo: e.target.checked })} /> Activo</label>
            </div>
          </>
        )
      case 'lavadores':
        return (
          <>
            <div className="form-group">
              <label>Nombre</label>
              <input type="text" value={formData.nombre || ''} onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label>Teléfono</label>
              <input type="text" value={formData.telefono || ''} onChange={(e) => setFormData(prev => ({ ...prev, telefono: e.target.value }))} />
            </div>
            {renderPagoFields(formData, setFormData, numChange)}
            <div className="form-group checkbox-group">
              <label><input type="checkbox" checked={formData.activo} onChange={(e) => setFormData(prev => ({ ...prev, activo: e.target.checked }))} /> Activo</label>
            </div>
          </>
        )
      case 'productos':
        return (
          <>
            <div className="form-group">
              <label>Nombre</label>
              <input type="text" value={formData.nombre || ''} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Precio</label>
              <input type="number" value={numVal(formData.precio)} onChange={numChange('precio')} required />
            </div>
            <div className="form-group">
              <label>Cantidad disponible</label>
              <input type="number" min="0" value={numVal(formData.cantidad)} onChange={numChange('cantidad')} required />
            </div>
            <div className="form-group checkbox-group">
              <label><input type="checkbox" checked={formData.activo} onChange={(e) => setFormData({ ...formData, activo: e.target.checked })} /> Activo</label>
            </div>
          </>
        )
      case 'mensajes':
        return (
          <>
            <div className="form-group">
              <label>Nombre de la plantilla</label>
              <input type="text" value={formData.nombre || ''} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Texto del mensaje</label>
              <textarea
                rows={5}
                value={formData.texto || ''}
                onChange={(e) => setFormData({ ...formData, texto: e.target.value })}
                required
                style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 'inherit', padding: '8px 12px', borderRadius: '8px', border: '1px solid #ddd' }}
              />
              <p style={{ fontSize: '0.8em', color: '#888', marginTop: '6px' }}>
                Variables disponibles: {'{nombre}'}, {'{telefono}'}, {'{negocio}'}, {'{membresia}'}, {'{estado_membresia}'}, {'{vencimiento}'}, {'{placa}'}, {'{ultimo_servicio}'}, {'{valor_ultimo}'}
              </p>
            </div>
            <div className="form-group checkbox-group">
              <label><input type="checkbox" checked={formData.activo} onChange={(e) => setFormData({ ...formData, activo: e.target.checked })} /> Activo</label>
            </div>
          </>
        )
      default:
        return null
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const cancelEdit = () => {
    setEditingField(null)
    setDatosError('')
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  const handleSaveNegocioNombre = async () => {
    if (!negocioNombreEdit.trim()) return
    setDatosSaving(true)
    const { error } = await supabase
      .from('negocios')
      .update({ nombre: negocioNombreEdit.trim() })
      .eq('id', negocioId)
    setDatosSaving(false)
    if (error) {
      setDatosError('Error al guardar: ' + error.message)
    } else {
      refresh()
      cancelEdit()
    }
  }

  const handleSaveEmail = async () => {
    if (!emailEdit.trim() || !currentPassword) return
    setDatosError('')
    setDatosSaving(true)
    try {
      const token = localStorage.getItem(TOKEN_KEY)
      const res = await fetch(`${API_URL}/api/auth/update-email`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newEmail: emailEdit.trim() }),
      })
      const result = await res.json()
      setDatosSaving(false)
      if (result.error) {
        setDatosError(result.error)
      } else {
        // Update local session with new token
        if (result.data?.session) {
          localStorage.setItem(TOKEN_KEY, result.data.session.access_token)
          localStorage.setItem(SESSION_KEY, JSON.stringify(result.data.session))
        }
        refresh()
        cancelEdit()
      }
    } catch {
      setDatosSaving(false)
      setDatosError('Error de conexión')
    }
  }

  const handleSavePassword = async () => {
    if (!currentPassword || !newPassword) return
    if (newPassword !== confirmPassword) {
      setDatosError('Las contraseñas no coinciden')
      return
    }
    if (newPassword.length < 6) {
      setDatosError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setDatosError('')
    setDatosSaving(true)
    try {
      const token = localStorage.getItem(TOKEN_KEY)
      const res = await fetch(`${API_URL}/api/auth/update-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const result = await res.json()
      setDatosSaving(false)
      if (result.error) {
        setDatosError(result.error)
      } else {
        cancelEdit()
      }
    } catch {
      setDatosSaving(false)
      setDatosError('Error de conexión')
    }
  }

  const renderDatosTab = () => (
    <div className="cuenta-datos-panel">
      {datosError && <div className="cuenta-datos-error">{datosError}</div>}

      {/* Correo electrónico */}
      <div className="cuenta-datos-row">
        <div className="cuenta-datos-left">
          <span className="cuenta-datos-label">Correo electrónico</span>
          {editingField === 'email' ? (
            <div className="cuenta-datos-edit-fields">
              <input type="email" className="cuenta-datos-input" value={emailEdit} onChange={(e) => setEmailEdit(e.target.value)} placeholder="Nuevo correo" autoFocus />
              <PasswordInput className="cuenta-datos-input" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Contraseña actual" />
            </div>
          ) : (
            <span className="cuenta-datos-value">{userEmail || '—'}</span>
          )}
        </div>
        {editingField === 'email' ? (
          <div className="cuenta-datos-confirm-icons">
            <button className="btn-icon-plain" onClick={handleSaveEmail} disabled={datosSaving} title="Confirmar"><Check size={18} /></button>
            <button className="btn-icon-plain" onClick={cancelEdit} title="Cancelar"><X size={18} /></button>
          </div>
        ) : (
          editingField === null && (
            <button className="btn-icon" onClick={() => { setEmailEdit(userEmail || ''); setEditingField('email') }} title="Editar"><Edit size={16} /></button>
          )
        )}
      </div>

      {/* Contraseña */}
      <div className="cuenta-datos-row">
        <div className="cuenta-datos-left">
          <span className="cuenta-datos-label">Contraseña</span>
          {editingField === 'password' ? (
            <div className="cuenta-datos-edit-fields">
              <PasswordInput className="cuenta-datos-input" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Contraseña actual" autoFocus />
              <PasswordInput className="cuenta-datos-input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Nueva contraseña" />
              <PasswordInput className="cuenta-datos-input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirmar nueva contraseña" />
            </div>
          ) : (
            <span className="cuenta-datos-value">••••••••</span>
          )}
        </div>
        {editingField === 'password' ? (
          <div className="cuenta-datos-confirm-icons">
            <button className="btn-icon-plain" onClick={handleSavePassword} disabled={datosSaving} title="Confirmar"><Check size={18} /></button>
            <button className="btn-icon-plain" onClick={cancelEdit} title="Cancelar"><X size={18} /></button>
          </div>
        ) : (
          editingField === null && (
            <button className="btn-icon" onClick={() => setEditingField('password')} title="Editar"><Edit size={16} /></button>
          )
        )}
      </div>

      {/* Rol */}
      <div className="cuenta-datos-row">
        <div className="cuenta-datos-left">
          <span className="cuenta-datos-label">Rol</span>
          <span className="cuenta-datos-value">{userProfile?.rol || 'admin'}</span>
        </div>
      </div>

      {/* Nombre del negocio */}
      <div className="cuenta-datos-row">
        <div className="cuenta-datos-left">
          <span className="cuenta-datos-label">Nombre del negocio</span>
          {editingField === 'negocio' ? (
            <div className="cuenta-datos-edit-fields">
              <input type="text" className="cuenta-datos-input" value={negocioNombreEdit} onChange={(e) => setNegocioNombreEdit(e.target.value)} autoFocus />
            </div>
          ) : (
            <span className="cuenta-datos-value">{negocioNombre || '—'}</span>
          )}
        </div>
        {editingField === 'negocio' ? (
          <div className="cuenta-datos-confirm-icons">
            <button className="btn-icon-plain" onClick={handleSaveNegocioNombre} disabled={datosSaving} title="Confirmar"><Check size={18} /></button>
            <button className="btn-icon-plain" onClick={cancelEdit} title="Cancelar"><X size={18} /></button>
          </div>
        ) : (
          editingField === null && isAdmin && (
            <button className="btn-icon" onClick={() => { setNegocioNombreEdit(negocioNombre || ''); setEditingField('negocio') }} title="Editar"><Edit size={16} /></button>
          )
        )}
      </div>

      {/* Cerrar sesión */}
      <div className="cuenta-datos-row cuenta-datos-logout" onClick={handleLogout}>
        <div className="cuenta-datos-left">
          <LogOut size={18} />
          <span className="cuenta-datos-label">Cerrar sesión</span>
        </div>
      </div>
    </div>
  )

  const renderSoporteTab = () => (
    <div className="plan-panel">
      <div className="plan-panel-header">
        <MessageCircle size={32} />
        <div>
          <h2>Soporte</h2>
        </div>
      </div>
      <div className="plan-panel-info">
        <p>¿Necesitas ayuda? Contáctanos:</p>
        <div className="cuenta-actions">
          <a
            href="https://wa.me/573001234567?text=Hola%2C%20necesito%20ayuda%20con%20Monaco"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
          >
            <MessageCircle size={18} /> WhatsApp
          </a>
          <a
            href="mailto:soporte@monaco.app"
            className="btn-secondary"
          >
            <Mail size={18} /> Email
          </a>
        </div>
        <p className="cuenta-version">Monaco v1.0.0</p>
      </div>
    </div>
  )

  const requestCancelSubscription = () => {
    setPendingCancelSub(true)
  }

  const executeCancelSubscription = async () => {
    try {
      const token = localStorage.getItem(TOKEN_KEY)
      const res = await fetch(`${API_URL}/api/wompi/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        refresh()
      }
    } catch {
      // silently fail
    }
    setPendingCancelSub(false)
  }

  const renderPlanTab = () => {
    const statusLabel = planCancelled && isPro ? 'CANCELADO'
      : planStatus === 'active' ? 'PRO ACTIVO'
      : planStatus === 'trial' ? 'PRO TRIAL'
      : 'GRATUITO'
    const statusClass = planStatus === 'free' ? 'plan-status--free'
      : planCancelled ? 'plan-status--cancelled'
      : 'plan-status--pro'

    const expiresAt = userProfile?.negocio?.subscription_expires_at || userProfile?.negocio?.trial_ends_at
    const expiresLabel = expiresAt ? new Date(expiresAt).toLocaleDateString('es-CO') : null

    return (
      <div className="plan-panel">
        <div className="plan-panel-header">
          <Crown size={32} />
          <div>
            <h2>Tu Plan</h2>
            <span className={`plan-status-badge ${statusClass}`}>{statusLabel}</span>
          </div>
          {isPro && !planCancelled && (
            <button className="btn-cancel-sub" onClick={requestCancelSubscription}>
              Cancelar suscripción
            </button>
          )}
        </div>

        {planCancelled && isPro && (
          <div className="plan-panel-info">
            <p>Tu suscripción fue cancelada. Seguirás con acceso PRO hasta el <strong>{expiresLabel}</strong>.</p>
          </div>
        )}

        {planStatus === 'trial' && !planCancelled && (
          <div className="plan-panel-info">
            <p>Te quedan <strong>{daysLeftInTrial}</strong> día{daysLeftInTrial !== 1 ? 's' : ''} de prueba gratuita.</p>
          </div>
        )}

        {planStatus === 'active' && !planCancelled && (
          <div className="plan-panel-info">
            <p>Tu suscripción está activa — expira el {expiresLabel || 'N/A'}</p>
          </div>
        )}

        {planStatus === 'free' && (
          <div className="plan-panel-info">
            <p>Estás en el plan gratuito con límites:</p>
            <ul className="plan-panel-limits">
              <li>50 lavadas por mes</li>
              <li>30 clientes máximo</li>
              <li>Pago de trabajadores: <strong>Bloqueado</strong></li>
              <li>Membresías: <strong>Bloqueado</strong></li>
            </ul>
          </div>
        )}

        {(planStatus === 'free' || planStatus === 'trial') && !planCancelled && (
          <button className="btn-primary plan-upgrade-btn" onClick={() => setShowUpgradeModal(true)}>
            <Crown size={18} /> {planStatus === 'free' ? 'Actualizar a PRO' : 'Suscribirse ahora'}
          </button>
        )}

        {planCancelled && !isPro && (
          <button className="btn-primary plan-upgrade-btn" onClick={() => setShowUpgradeModal(true)}>
            <Crown size={18} /> Reactivar suscripción
          </button>
        )}

        {showUpgradeModal && <UpgradeModal onClose={() => setShowUpgradeModal(false)} />}
      </div>
    )
  }

  return (
    <div className="configuracion-page">
      <div className="config-title-row">
        <h1 className="page-title">Mi Cuenta</h1>
      </div>

      {/* Mobile: horizontal pills */}
      <div className="config-pills-mobile">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`config-pill ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Desktop: tab buttons */}
      <div className="tabs config-tabs-desktop">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Mis Datos tab */}
      {activeTab === 'datos' && renderDatosTab()}

      {/* Plan tab */}
      {activeTab === 'plan' && renderPlanTab()}

      {/* Configuración tab */}
      {activeTab === 'config' && (
        <>
          {/* Config sub-tabs */}
          <div className="config-pills-mobile config-sub-pills">
            {configSubTabs.map(t => (
              <button
                key={t.id}
                className={`config-pill ${configSubTab === t.id ? 'active' : ''}`}
                onClick={() => setConfigSubTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="config-title-row">
            <div />
            <div className="config-desktop-actions">
              {configSubTab === 'lavadores' && (
                <button className="btn-secondary" onClick={() => {
                  setBulkForm({ tipo_pago: null, pago_porcentaje: '', pago_sueldo_base: '', pago_por_lavada: '', pago_por_adicional: '', pago_porcentaje_lavada: '', pago_adicional_fijo: '', pago_adicionales_detalle: null })
                  setShowBulkModal(true)
                }}>
                  <Settings size={18} />
                  <span className="btn-label">Pago General</span>
                </button>
              )}
              <button className="btn-primary" onClick={handleNew}>
                <Plus size={18} />
                <span className="btn-label">Nuevo</span>
              </button>
            </div>
          </div>

          {/* Desktop: tabla */}
          <div className="card config-tabla-desktop">
            {configSubTab === 'membresias' && !isPro ? (
              <div className="plan-restricted-inline">
                <Shield size={32} />
                <p>Tipos de Cliente/Membresía requiere plan PRO</p>
                <button className="btn-primary" onClick={() => setShowUpgradeModal(true)}>Ver opciones</button>
                {showUpgradeModal && <UpgradeModal onClose={() => setShowUpgradeModal(false)} />}
              </div>
            ) : (
              <>
                {renderTable()}
                {data.length === 0 && (
                  <p className="empty">No hay registros</p>
                )}
              </>
            )}
          </div>

          {/* Mobile: cards */}
          <div className="config-cards-mobile">
            {renderMobileCards()}
            {data.length === 0 && (
              <div className="clientes-cards-empty">No hay registros</div>
            )}
          </div>

          {/* FAB (mobile only) */}
          {configSubTab === 'lavadores' ? (
            <>
              <button
                className={`config-fab ${showFabMenu ? 'open' : ''}`}
                onClick={() => setShowFabMenu(!showFabMenu)}
              >
                <Plus size={24} />
              </button>
              {showFabMenu && (
                <>
                  <div className="config-fab-overlay" onClick={() => setShowFabMenu(false)} />
                  <div className="config-fab-menu">
                    <button onClick={() => { setShowFabMenu(false); handleNew() }}>
                      <Plus size={18} /> Nuevo Lavador
                    </button>
                    <button onClick={() => {
                      setShowFabMenu(false)
                      setBulkForm({ tipo_pago: null, pago_porcentaje: '', pago_sueldo_base: '', pago_por_lavada: '', pago_por_adicional: '', pago_porcentaje_lavada: '', pago_adicional_fijo: '', pago_adicionales_detalle: null })
                      setShowBulkModal(true)
                    }}>
                      <Settings size={18} /> Pago General
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            <button className="config-fab" onClick={handleNew}>
              <Plus size={24} />
            </button>
          )}
        </>
      )}

      {/* Soporte tab */}
      {activeTab === 'soporte' && renderSoporteTab()}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>{editando ? 'Editar' : 'Nuevo'}</h2>
              <button className="btn-close" onClick={() => setShowModal(false)}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              {renderForm()}
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">{editando ? 'Actualizar' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBulkModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Configurar Pago General</h2>
              <button className="btn-close" onClick={() => setShowBulkModal(false)}>
                <X size={24} />
              </button>
            </div>
            <p style={{ padding: '0 20px', color: '#666', fontSize: '0.9em' }}>
              Esto aplicará la configuración de pago a <strong>todos los lavadores activos</strong>.
            </p>
            <form onSubmit={handleBulkSubmit}>
              {renderPagoFields(bulkForm, setBulkForm, bulkNumChange)}
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowBulkModal(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Aplicar a Todos</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={!!pendingDeleteId}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={executeDeleteConfig}
        message="Se eliminará este registro permanentemente. Ingresa tu contraseña para confirmar."
      />

      <ConfirmDeleteModal
        isOpen={!!pendingAdicionalDeleteId}
        onClose={() => setPendingAdicionalDeleteId(null)}
        onConfirm={executeAdicionalDelete}
        message="Se eliminará este adicional permanentemente. Ingresa tu contraseña para confirmar."
      />

      <ConfirmDeleteModal
        isOpen={pendingCancelSub}
        onClose={() => setPendingCancelSub(false)}
        onConfirm={executeCancelSubscription}
        message="¿Estás seguro de cancelar tu suscripción? Seguirás con acceso PRO hasta que expire. Ingresa tu contraseña para confirmar."
      />
    </div>
  )
}
