import { useState } from 'react'
import { supabase } from '../../apiClient'
import { useData } from '../context/DataContext'
import { useTenant } from '../context/TenantContext'
import { useToast } from '../layout/Toast'
import { formatMoney } from '../../utils/money'
import { Plus, Pencil, Trash2, X, Crown } from 'lucide-react'
import ConfirmDeleteModal from './ConfirmDeleteModal'

export default function MembresiaManager() {
  const { tiposMembresia, refreshConfig, negocioId } = useData()
  const { isPro } = useTenant()
  const toast = useToast()
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [formData, setFormData] = useState({ nombre: '', precio: '', descuento: '', duracion_dias: 1, activo: true })
  const [submitting, setSubmitting] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  const handleNew = () => {
    setEditando(null)
    setFormData({ nombre: '', precio: '', descuento: '', duracion_dias: 1, activo: true })
    setShowModal(true)
  }

  const handleEdit = (item) => {
    setEditando(item)
    setFormData({
      nombre: item.nombre || '',
      precio: item.precio ?? '',
      descuento: item.descuento ?? '',
      duracion_dias: item.duracion_dias ?? 1,
      activo: item.activo !== false,
    })
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.nombre.trim()) return
    setSubmitting(true)
    const payload = {
      nombre: formData.nombre.trim(),
      precio: formData.precio === '' ? null : Number(formData.precio),
      descuento: formData.descuento === '' ? null : Number(formData.descuento),
      duracion_dias: formData.duracion_dias === '' ? null : Number(formData.duracion_dias),
      activo: formData.activo,
    }

    if (editando) {
      const { error } = await supabase.from('tipos_membresia').update(payload).eq('id', editando.id)
      if (error) toast.error('Error al actualizar')
      else toast.success('Membresía actualizada')
    } else {
      const { error } = await supabase.from('tipos_membresia').insert({ ...payload, negocio_id: negocioId })
      if (error) toast.error('Error al crear')
      else toast.success('Membresía creada')
    }

    setSubmitting(false)
    setShowModal(false)
    refreshConfig()
  }

  const handleDelete = async () => {
    if (!deleteId) return
    const { error } = await supabase.from('tipos_membresia').delete().eq('id', deleteId)
    if (error) toast.error('Error al eliminar')
    else toast.success('Membresía eliminada')
    setDeleteId(null)
    refreshConfig()
  }

  const activas = tiposMembresia.filter(m => m.activo !== false)
  const inactivas = tiposMembresia.filter(m => m.activo === false)

  return (
    <div className="membresia-manager">
      <div className="membresia-manager-header">
        <h2 className="membresia-manager-title">
          <Crown size={20} /> Tipos de Membresía
        </h2>
        <button className="btn-primary btn-sm" onClick={handleNew}>
          <Plus size={16} /> Nueva
        </button>
      </div>

      {tiposMembresia.length === 0 ? (
        <div className="membresia-empty">
          <Crown size={32} />
          <p>No hay membresías configuradas</p>
          <button className="btn-primary" onClick={handleNew}><Plus size={16} /> Crear primera membresía</button>
        </div>
      ) : (
        <div className="membresia-list">
          {[...activas, ...inactivas].map(m => (
            <div key={m.id} className={`membresia-card ${!m.activo ? 'inactive' : ''}`}>
              <div className="membresia-card-info">
                <span className="membresia-card-name">{m.nombre}</span>
                <span className="membresia-card-price">{m.precio ? formatMoney(m.precio) : 'Sin precio'}</span>
                {m.descuento > 0 && <span className="membresia-card-discount">{Math.round(m.descuento * 100)}% desc.</span>}
                {m.duracion_dias > 0 && <span className="membresia-card-duration">{m.duracion_dias} {m.duracion_dias === 1 ? 'mes' : 'meses'}</span>}
                {!m.activo && <span className="membresia-card-badge-inactive">Inactiva</span>}
              </div>
              <div className="membresia-card-actions">
                <button onClick={() => handleEdit(m)} title="Editar"><Pencil size={16} /></button>
                <button onClick={() => setDeleteId(m.id)} title="Eliminar"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>{editando ? 'Editar' : 'Nueva'} Membresía</h2>
              <button className="btn-close" onClick={() => setShowModal(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nombre</label>
                <input type="text" value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Precio</label>
                <input type="number" value={formData.precio} onChange={e => setFormData({ ...formData, precio: e.target.value === '' ? '' : Number(e.target.value) })} />
              </div>
              <div className="form-group">
                <label>Descuento (decimal, ej: 0.4 = 40%)</label>
                <input type="number" step="0.01" value={formData.descuento} onChange={e => setFormData({ ...formData, descuento: e.target.value === '' ? '' : Number(e.target.value) })} />
              </div>
              <div className="form-group">
                <label>Duración (meses, 0 = sin vencimiento)</label>
                <input type="number" min="0" value={formData.duracion_dias} onChange={e => setFormData({ ...formData, duracion_dias: e.target.value === '' ? '' : Number(e.target.value) })} />
              </div>
              <div className="form-group checkbox-group">
                <label><input type="checkbox" checked={formData.activo} onChange={e => setFormData({ ...formData, activo: e.target.checked })} /> Activa</label>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={submitting}>{editando ? 'Actualizar' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <ConfirmDeleteModal
          title="Eliminar membresía"
          message="Esta acción no se puede deshacer."
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  )
}
