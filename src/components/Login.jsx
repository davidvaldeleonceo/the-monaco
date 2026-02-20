import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import PasswordInput from './common/PasswordInput'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
    }
    setLoading(false)
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <h1>monaco</h1>
          <span className="badge">PRO</span>
        </div>
        <p className="login-subtitle">Sistema de Gestión</p>
        
        <form onSubmit={handleLogin}>
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
          
          <div className="input-group">
            <label>Contraseña</label>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={loading} className="login-button">
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <div className="login-register-link">
          <span>¿No tienes cuenta? </span>
          <a href="/" onClick={(e) => { e.preventDefault(); navigate('/') }}>
            Registra tu negocio
          </a>
        </div>
        <div className="login-back-link">
          <a href="/" onClick={(e) => { e.preventDefault(); navigate('/') }}>
            ← Volver
          </a>
        </div>
      </div>
    </div>
  )
}