import { useState } from 'react'
import { supabase } from '../../apiClient'
import { useTenant } from '../context/TenantContext'
import { COUNTRIES } from '../../config/currencies'

export default function Onboarding() {
  const { refresh, userEmail, userId } = useTenant()
  const [nombreNegocio, setNombreNegocio] = useState('')
  const [pais, setPais] = useState('CO')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error: rpcError } = await supabase.rpc('crear_negocio_y_perfil', {
      p_nombre: nombreNegocio,
      p_email: userEmail,
      p_pais: pais,
    })

    if (rpcError) {
      // Profile already exists (race condition from register flow) — just refresh
      if (rpcError.message?.includes('Duplicate')) {
        await refresh()
        return
      }
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
            <label>País</label>
            <div className="country-selector-grid">
              {COUNTRIES.map(c => (
                <button
                  key={c.code}
                  type="button"
                  className={`country-chip ${pais === c.code ? 'active' : ''}`}
                  onClick={() => setPais(c.code)}
                >
                  <span className="country-flag">{c.flag}</span>
                  <span className="country-name">{c.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="input-group">
            <label>Nombre de tu negocio</label>
            <input
              type="text"
              value={nombreNegocio}
              onChange={(e) => setNombreNegocio(e.target.value)}
              placeholder="Mi Negocio"
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
