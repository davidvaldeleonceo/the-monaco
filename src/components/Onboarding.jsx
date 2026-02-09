import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useTenant } from './TenantContext'

export default function Onboarding() {
  const { refresh, userEmail, userId } = useTenant()
  const [nombreNegocio, setNombreNegocio] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error: rpcError } = await supabase.rpc('crear_negocio_y_perfil', {
      p_nombre: nombreNegocio,
      p_email: userEmail,
    })

    if (rpcError) {
      setError('Error creando negocio: ' + rpcError.message)
      setLoading(false)
      return
    }

    localStorage.removeItem('pending_negocio')
    await refresh()
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <h1>monaco</h1>
          <span className="badge">PRO</span>
        </div>
        <p className="login-subtitle">Configura tu negocio</p>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Nombre de tu negocio</label>
            <input
              type="text"
              value={nombreNegocio}
              onChange={(e) => setNombreNegocio(e.target.value)}
              placeholder="Mi Lavadero"
              autoComplete="off"
              required
            />
          </div>

          {error && <div className="error-message" style={{ wordBreak: 'break-all' }}>{error}</div>}

          <button type="submit" disabled={loading} className="login-button">
            {loading ? 'Configurando...' : 'Comenzar'}
          </button>
        </form>

        <button
          onClick={async () => { await supabase.auth.signOut(); window.location.href = '/' }}
          style={{ marginTop: '1.5rem', background: 'none', border: '1px solid #666', color: '#666', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', width: '100%', fontSize: '0.85rem' }}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
