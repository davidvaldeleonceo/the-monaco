import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useData } from './DataContext'
import { Plus, X, Edit, Trash2, Settings } from 'lucide-react'

export default function Configuracion() {
  const { refreshConfig, serviciosAdicionales } = useData()
  const [activeTab, setActiveTab] = useState('membresias')
  const [data, setData] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [formData, setFormData] = useState({})
  const [showBulkModal, setShowBulkModal] = useState(false)
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
    { id: 'membresias', label: 'Tipos de Cliente', table: 'tipos_membresia' },
    { id: 'lavados', label: 'Tipos de Lavado', table: 'tipos_lavado' },
    { id: 'metodos', label: 'Métodos de Pago', table: 'metodos_pago' },
    { id: 'lavadores', label: 'Lavadores', table: 'lavadores' },
    { id: 'servicios', label: 'Servicios', table: 'servicios_adicionales' }
  ]

  useEffect(() => {
    fetchData()
  }, [activeTab])

  const getTable = () => tabs.find(t => t.id === activeTab)?.table

  const fetchData = async () => {
    const { data: result } = await supabase
      .from(getTable())
      .select('*')
      .order('nombre')
    setData(result || [])
  }

  const getInitialForm = () => {
    switch (activeTab) {
      case 'membresias':
        return { nombre: '', precio: '', descuento: '', cashback: '', duracion_dias: 30, activo: true }
      case 'lavados':
        return { nombre: '', precio: '', descripcion: '', activo: true }
      case 'metodos':
        return { nombre: '', activo: true }
      case 'lavadores':
        return { nombre: '', telefono: '', activo: true, tipo_pago: null, pago_porcentaje: '', pago_sueldo_base: '', pago_por_lavada: '', pago_por_adicional: '', pago_porcentaje_lavada: '', pago_adicional_fijo: '', pago_adicionales_detalle: null }
      case 'servicios':
        return { nombre: '', precio: '', activo: true }
      default:
        return {}
    }
  }

  const getEditableFields = () => {
    switch (activeTab) {
      case 'membresias':
        return ['nombre', 'precio', 'descuento', 'cashback', 'duracion_dias', 'activo']
      case 'lavados':
        return ['nombre', 'precio', 'descripcion', 'activo']
      case 'metodos':
        return ['nombre', 'activo']
      case 'lavadores':
        return ['nombre', 'telefono', 'activo', 'tipo_pago', 'pago_porcentaje', 'pago_sueldo_base', 'pago_por_lavada', 'pago_por_adicional', 'pago_porcentaje_lavada', 'pago_adicional_fijo', 'pago_adicionales_detalle']
      case 'servicios':
        return ['nombre', 'precio', 'activo']
      default:
        return []
    }
  }

  const stringFields = ['nombre', 'telefono', 'descripcion', 'tipo_pago', 'activo', 'pago_adicionales_detalle']

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
      if (cleaned[key] === '' || cleaned[key] === null || cleaned[key] === undefined) {
        cleaned[key] = 0
      }
    }
    if (cleaned.tipo_pago === '') cleaned.tipo_pago = null
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
      } else if (stringFields.includes(f)) {
        editData[f] = item[f] ?? ''
      } else {
        editData[f] = item[f] ?? ''
      }
    }
    setFormData(editData)
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (confirm('¿Estás seguro de eliminar este registro? Esta acción es permanente.')) {
      const { error } = await supabase.from(getTable()).delete().eq('id', id)
      if (error) {
        alert('Error al eliminar: ' + error.message)
      } else {
        fetchData()
        refreshConfig()
      }
    }
  }

  const handleToggleActive = async (item) => {
    const newStatus = !item.activo
    setData(data.map(d => d.id === item.id ? { ...d, activo: newStatus } : d))

    const { error } = await supabase.from(getTable()).update({ activo: newStatus }).eq('id', item.id)

    if (error) {
      alert(`Error al actualizar estado: ${error.message}`)
      fetchData()
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
      alert('Error al actualizar tipo de pago: ' + error.message)
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

    let error
    if (editando) {
      const res = await supabase.from(getTable()).update(cleaned).eq('id', editando)
      error = res.error
    } else {
      const res = await supabase.from(getTable()).insert([cleaned])
      error = res.error
    }

    if (error) {
      alert('Error al guardar: ' + error.message)
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
      alert('Error al actualizar: ' + error.message)
    } else {
      setShowBulkModal(false)
      fetchData()
      refreshConfig()
    }
  }

  const formatMoney = (value) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value)
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
      const adicInfo = item.pago_adicionales_detalle
        ? 'valor por servicio'
        : `${formatMoney(item.pago_adicional_fijo || 0)}/adic`
      return `${formatPct(item.pago_porcentaje_lavada)} lavada básica + ${adicInfo}`
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
        ...prev.pago_adicionales_detalle,
        [servicioId]: value === '' ? '' : Number(value)
      }
    }))
  }

  const renderTable = () => {
    switch (activeTab) {
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
                  <td>{item.duracion_dias} días</td>
                  <td>
                    <label className="switch">
                      <input type="checkbox" checked={item.activo} onChange={() => handleToggleActive(item)} />
                      <span className="slider"></span>
                    </label>
                  </td>
                  <td>
                    <div className="acciones">
                      <button className="btn-icon" onClick={() => handleEdit(item)}><Edit size={18} /></button>
                      <button className="btn-icon delete" onClick={() => handleDelete(item.id)}><Trash2 size={18} /></button>
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
          <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Precio</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.map(item => (
                <tr key={item.id}>
                  <td>{item.nombre}</td>
                  <td>{formatMoney(item.precio)}</td>
                  <td>
                    <label className="switch">
                      <input type="checkbox" checked={item.activo} onChange={() => handleToggleActive(item)} />
                      <span className="slider"></span>
                    </label>
                  </td>
                  <td>
                    <div className="acciones">
                      <button className="btn-icon" onClick={() => handleEdit(item)}><Edit size={18} /></button>
                      <button className="btn-icon delete" onClick={() => handleDelete(item.id)}><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
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
                      <button className="btn-icon delete" onClick={() => handleDelete(item.id)}><Trash2 size={18} /></button>
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
                  <td>{item.telefono || '-'}</td>
                  <td>
                    <select
                      value={item.tipo_pago || ''}
                      onChange={(e) => handleTipoPagoInline(item, e.target.value)}
                      style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border, #ddd)', fontSize: '0.85em', width: '100%' }}
                    >
                      <option value="">Sin configurar</option>
                      <option value="porcentaje">Porcentaje</option>
                      <option value="sueldo_fijo">Sueldo fijo</option>
                      <option value="porcentaje_lavada">% de lavada + adic.</option>
                    </select>
                  </td>
                  <td style={{ fontSize: '0.85em', color: item.tipo_pago ? 'inherit' : '#999' }}>
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
                      <button className="btn-icon delete" onClick={() => handleDelete(item.id)}><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )
      case 'servicios':
        return (
          <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Precio</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.map(item => (
                <tr key={item.id}>
                  <td>{item.nombre}</td>
                  <td>{formatMoney(item.precio)}</td>
                  <td>
                    <label className="switch">
                      <input type="checkbox" checked={item.activo} onChange={() => handleToggleActive(item)} />
                      <span className="slider"></span>
                    </label>
                  </td>
                  <td>
                    <div className="acciones">
                      <button className="btn-icon" onClick={() => handleEdit(item)}><Edit size={18} /></button>
                      <button className="btn-icon delete" onClick={() => handleDelete(item.id)}><Trash2 size={18} /></button>
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
              {serviciosAdicionales.map(s => (
                <div className="form-group" key={s.id}>
                  <label>{s.nombre}</label>
                  <input
                    type="number"
                    value={numVal(formObj.pago_adicionales_detalle?.[s.id])}
                    onChange={(e) => handleDetalleAdicionalChange(setFn, s.id, e.target.value)}
                  />
                </div>
              ))}
            </>
          )}
        </>
      )}
    </>
  )

  const renderForm = () => {
    switch (activeTab) {
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
              <label>Duración (días)</label>
              <input type="number" value={numVal(formData.duracion_dias)} onChange={numChange('duracion_dias')} />
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
            <div className="form-group checkbox-group">
              <label><input type="checkbox" checked={formData.activo} onChange={(e) => setFormData({ ...formData, activo: e.target.checked })} /> Activo</label>
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
      case 'servicios':
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
            <div className="form-group checkbox-group">
              <label><input type="checkbox" checked={formData.activo} onChange={(e) => setFormData({ ...formData, activo: e.target.checked })} /> Activo</label>
            </div>
          </>
        )
      default:
        return null
    }
  }

  return (
    <div className="configuracion-page">
      <div className="page-header">
        <h1 className="page-title">Configuración</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          {activeTab === 'lavadores' && (
            <button className="btn-secondary" onClick={() => {
              setBulkForm({ tipo_pago: null, pago_porcentaje: '', pago_sueldo_base: '', pago_por_lavada: '', pago_por_adicional: '', pago_porcentaje_lavada: '', pago_adicional_fijo: '', pago_adicionales_detalle: null })
              setShowBulkModal(true)
            }}>
              <Settings size={20} />
              Pago General
            </button>
          )}
          <button className="btn-primary" onClick={handleNew}>
            <Plus size={20} />
            Nuevo
          </button>
        </div>
      </div>

      <div className="tabs">
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

      <div className="card">
        {renderTable()}
        {data.length === 0 && (
          <p className="empty">No hay registros</p>
        )}
      </div>

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
    </div>
  )
}
