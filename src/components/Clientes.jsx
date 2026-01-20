import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useData } from './DataContext'
import { Plus, Search, X, Edit, Trash2 } from 'lucide-react'

export default function Clientes() {
  const { clientes, tiposMembresia, loading, addClienteLocal, updateClienteLocal, deleteClienteLocal, refreshClientes } = useData()
  
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [search, setSearch] = useState('')

  const [formData, setFormData] = useState({
    nombre: '',
    cedula: '',
    telefono: '',
    correo: '',
    placa: '',
    moto: '',
    membresia_id: '',
    fecha_inicio_membresia: '',
    fecha_fin_membresia: '',
    estado: 'Activo'
  })

  const handleMembresiaChange = (membresiaId) => {
    const membresia = tiposMembresia.find(m => m.id === membresiaId)
    const hoy = new Date()
    const fin = new Date()
    fin.setDate(fin.getDate() + (membresia?.duracion_dias || 30))

    setFormData(prev => ({
      ...prev,
      membresia_id: membresiaId,
      fecha_inicio_membresia: hoy.toISOString().split('T')[0],
      fecha_fin_membresia: fin.toISOString().split('T')[0]
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (editando) {
      const { error } = await supabase
        .from('clientes')
        .update(formData)
        .eq('id', editando)
      
      if (!error) {
        const membresia = tiposMembresia.find(m => m.id === formData.membresia_id)
        updateClienteLocal(editando, { ...formData, membresia })
      }
    } else {
      const { data, error } = await supabase
        .from('clientes')
        .insert([formData])
        .select('*, membresia:tipos_membresia(nombre)')
        .single()
      
      if (!error && data) {
        addClienteLocal(data)
      }
    }

    setShowModal(false)
    setEditando(null)
    setFormData({
      nombre: '',
      cedula: '',
      telefono: '',
      correo: '',
      placa: '',
      moto: '',
      membresia_id: '',
      fecha_inicio_membresia: '',
      fecha_fin_membresia: '',
      estado: 'Activo'
    })
  }

  const handleEdit = (cliente) => {
    setEditando(cliente.id)
    setFormData({
      nombre: cliente.nombre || '',
      cedula: cliente.cedula || '',
      telefono: cliente.telefono || '',
      correo: cliente.correo || '',
      placa: cliente.placa || '',
      moto: cliente.moto || '',
      membresia_id: cliente.membresia_id || '',
      fecha_inicio_membresia: cliente.fecha_inicio_membresia || '',
      fecha_fin_membresia: cliente.fecha_fin_membresia || '',
      estado: cliente.estado || 'Activo'
    })
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (confirm('¿Estás seguro de eliminar este cliente?')) {
      const { error } = await supabase.from('clientes').delete().eq('id', id)
      if (!error) {
        deleteClienteLocal(id)
      }
    }
  }

  const clientesFiltrados = clientes.filter(c =>
    c.nombre?.toLowerCase().includes(search.toLowerCase()) ||
    c.placa?.toLowerCase().includes(search.toLowerCase()) ||
    c.cedula?.includes(search)
  )

  if (loading) {
    return <div className="loading">Cargando...</div>
  }

  return (
    <div className="clientes-page">
      <div className="page-header">
        <h1 className="page-title">Clientes</h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={20} />
          Nuevo Cliente
        </button>
      </div>

      <div className="filters">
        <div className="search-box">
          <Search size={20} />
          <input
            type="text"
            placeholder="Buscar por nombre, placa o cédula..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card">
        <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Placa</th>
              <th>Teléfono</th>
              <th>Membresía</th>
              <th>Vencimiento</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clientesFiltrados.map((cliente) => (
              <tr key={cliente.id}>
                <td>
                  <div className="cliente-cell">
                    <span className="cliente-nombre">{cliente.nombre}</span>
                    <span className="cliente-fecha">{cliente.moto}</span>
                  </div>
                </td>
                <td>{cliente.placa}</td>
                <td>{cliente.telefono}</td>
                <td>{cliente.membresia?.nombre || 'Sin membresía'}</td>
                <td>{cliente.fecha_fin_membresia || '-'}</td>
                <td>
                  <span className={`estado-badge ${cliente.estado === 'Activo' ? 'activo' : 'inactivo'}`}>
                    {cliente.estado}
                  </span>
                </td>
                <td>
                  <div className="acciones">
                    <button className="btn-icon" onClick={() => handleEdit(cliente)}>
                      <Edit size={18} />
                    </button>
                    <button className="btn-icon delete" onClick={() => handleDelete(cliente.id)}>
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {clientesFiltrados.length === 0 && (
              <tr>
                <td colSpan="7" className="empty">No hay clientes registrados</td>
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
              <h2>{editando ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
              <button className="btn-close" onClick={() => { setShowModal(false); setEditando(null) }}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Nombre completo</label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Cédula</label>
                  <input
                    type="text"
                    value={formData.cedula}
                    onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Teléfono</label>
                  <input
                    type="text"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Correo</label>
                  <input
                    type="email"
                    value={formData.correo}
                    onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Placa</label>
                  <input
                    type="text"
                    value={formData.placa}
                    onChange={(e) => setFormData({ ...formData, placa: e.target.value.toUpperCase() })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Moto</label>
                  <input
                    type="text"
                    value={formData.moto}
                    onChange={(e) => setFormData({ ...formData, moto: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Membresía</label>
                  <select
                    value={formData.membresia_id}
                    onChange={(e) => handleMembresiaChange(e.target.value)}
                  >
                    <option value="">Sin membresía</option>
                    {tiposMembresia.map(m => (
                      <option key={m.id} value={m.id}>{m.nombre}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Estado</label>
                  <select
                    value={formData.estado}
                    onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                  >
                    <option value="Activo">Activo</option>
                    <option value="No Activo">No Activo</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Fecha inicio membresía</label>
                  <input
                    type="date"
                    value={formData.fecha_inicio_membresia}
                    onChange={(e) => setFormData({ ...formData, fecha_inicio_membresia: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Fecha fin membresía</label>
                  <input
                    type="date"
                    value={formData.fecha_fin_membresia}
                    onChange={(e) => setFormData({ ...formData, fecha_fin_membresia: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => { setShowModal(false); setEditando(null) }}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  {editando ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}