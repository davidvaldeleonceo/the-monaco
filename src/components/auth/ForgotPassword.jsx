import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_URL } from '../../config/constants'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setSent(true)
      }
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    }
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="login-container">
        <div className="login-box">
          <div className="login-header">
            <h1>monaco</h1>
            <span className="badge">PRO</span>
          </div>
          <p className="login-subtitle" style={{ marginBottom: '1rem' }}>Revisa tu correo</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, textAlign: 'center' }}>
            Si existe una cuenta con <strong>{email}</strong>, recibirás un enlace para restablecer tu contraseña.
          </p>
          <button className="login-button" style={{ marginTop: '1.5rem' }} onClick={() => navigate('/login')}>
            Volver a iniciar sesión
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <h1>monaco</h1>
          <span className="badge">PRO</span>
        </div>
        <p className="login-subtitle">Recuperar contraseña</p>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              required
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={loading} className="login-button">
            {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
          </button>
        </form>

        <div className="login-back-link">
          <a href="/login" onClick={(e) => { e.preventDefault(); navigate('/login') }}>
            ← Volver a iniciar sesión
          </a>
        </div>
      </div>
    </div>
  )
}
