import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import { X } from 'lucide-react'
import PasswordInput from './PasswordInput'

export default function ConfirmDeleteModal({ isOpen, onClose, onConfirm, message }) {
  const [password, setPassword] = useState('')
  const [errorPassword, setErrorPassword] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setPassword('')
      setErrorPassword('')
      setLoading(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleConfirm = async () => {
    if (!password.trim()) {
      setErrorPassword('Ingresa tu contraseña')
      return
    }

    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const email = session?.user?.email
      if (!email) {
        setErrorPassword('No se pudo obtener la sesión')
        return
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setErrorPassword('Contraseña incorrecta')
        return
      }

      await onConfirm()
      onClose()
    } catch {
      setErrorPassword('Error al verificar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay confirm-delete-overlay">
      <div className="modal confirm-delete-modal">
        <div className="modal-header">
          <h2>Confirmar eliminación</h2>
          <button className="btn-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        <div style={{ padding: '1.5rem' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            {message || 'Esta acción no se puede deshacer. Ingresa tu contraseña para confirmar.'}
          </p>
          <div className="form-group">
            <label>Contraseña</label>
            <PasswordInput
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErrorPassword('') }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm() }}
              placeholder="Ingresa tu contraseña"
              autoFocus
            />
            {errorPassword && (
              <span style={{ color: 'var(--accent-red)', fontSize: '0.85rem', marginTop: '0.5rem', display: 'block' }}>
                {errorPassword}
              </span>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" style={{ background: 'var(--accent-red)' }} onClick={handleConfirm} disabled={loading}>
            {loading ? 'Verificando...' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}
