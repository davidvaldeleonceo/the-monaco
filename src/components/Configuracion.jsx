import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { Plus, X, Edit, Trash2 } from 'lucide-react'

export default function Configuracion() {
  const [activeTab, setActiveTab] = useState('membresias')
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [formData, setFormData] = useState({})

  const tabs = [
    { id: 'membresias', label: 'Membresías', table: 'tipos_membresia' },
    { id: 'lavados', label: 'Tipos de Lavado', table: 'tipos_lavado' },
    { id: 'metodos', label: 'Métodos de Pago', table: 'metodos_pago' },
    { id: 'lavadores', label: 'Lavadores', table: 'lavadores' }
  ]

  useEffect(() => {
    fetchData()
  }, [activeTab])

  const getTable = () => tabs.find(t => t.id === activeTab)?.table

  const fetchData = async () => {
    setLoading(true)
    const { data: result } = await supabase
      .from(getTable())
      .select('*')
      .order('nombre')
    setData(result || [])
    setLoading(false)
  }

  const getInitialForm = () => {
    switch (activeTab) {
      case 'membresias':
        return { nombre: '', precio: 0, descuento: 0, cashback: 0, duracion_dias: 30, activo: true }
      case 'lavados':
        return { nombre: '', precio: 0, descripcion: '', activo: true }
      case 'metodos':
        return { nombre: '', activo: true }
      case 'lavadores':
        return { nombre: '', telefono: '', activo: true }
      default:
        return {}
    }
  }

  const handleNew = () => {
    setEditando(null)
    setFormData(getInitialForm())
    setShowModal(true)
  }

  const handleEdit = (item) => {
    setEditando(item.id)
    setFormData(item)
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (confirm('¿Estás seguro de eliminar este registro?')) {
      await supabase.from(getTable()).delete().eq('id', id)
      fetchData()
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (editando) {
      await supabase.from(getTable()).update(formData).eq('id', editando)
    } else {
      await supabase.from(getTable()).insert([formData])
    }

    setShowModal(false)
    setEditando(null)
    fetchData()
  }

  const formatMoney = (value) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value)
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
                    <span className={`estado-badge ${item.activo ? 'activo' : 'inactivo'}`}>
                      {item.activo ? 'Activo' : 'Inactivo'}
                    </span>
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
                    <span className={`estado-badge ${item.activo ? 'activo' : 'inactivo'}`}>
                      {item.activo ? 'Activo' : 'Inactivo'}
                    </span>
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
                    <span className={`estado-badge ${item.activo ? 'activo' : 'inactivo'}`}>
                      {item.activo ? 'Activo' : 'Inactivo'}
                    </span>
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
                    <span className={`estado-badge ${item.activo ? 'activo' : 'inactivo'}`}>
                      {item.activo ? 'Activo' : 'Inactivo'}
                    </span>
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
              <input type="number" value={formData.precio || 0} onChange={(e) => setFormData({ ...formData, precio: Number(e.target.value) })} required />
            </div>
            <div className="form-group">
              <label>Descuento (decimal, ej: 0.4 = 40%)</label>
              <input type="number" step="0.01" value={formData.descuento || 0} onChange={(e) => setFormData({ ...formData, descuento: Number(e.target.value) })} />
            </div>
            <div className="form-group">
              <label>Duración (días)</label>
              <input type="number" value={formData.duracion_dias || 30} onChange={(e) => setFormData({ ...formData, duracion_dias: Number(e.target.value) })} />
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
              <input type="number" value={formData.precio || 0} onChange={(e) => setFormData({ ...formData, precio: Number(e.target.value) })} required />
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
              <input type="text" value={formData.nombre || ''} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Teléfono</label>
              <input type="text" value={formData.telefono || ''} onChange={(e) => setFormData({ ...formData, telefono: e.target.value })} />
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

  if (loading) {
    return <div className="loading">Cargando...</div>
  }

  return (
    <div className="configuracion-page">
      <div className="page-header">
        <h1 className="page-title">Configuración</h1>
        <button className="btn-primary" onClick={handleNew}>
          <Plus size={20} />
          Nuevo
        </button>
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
    </div>
  )
}