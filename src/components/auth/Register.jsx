import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../apiClient'
import { COUNTRIES } from '../../config/currencies'
import PasswordInput from '../shared/PasswordInput'

const PHONE_CODES = {
  CO: '+57', MX: '+52', US: '+1', EC: '+593', PA: '+507',
  PE: '+51', CL: '+56', AR: '+54', NI: '+505',
}

export default function Register() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const planPro = searchParams.get('plan') === 'pro'
  const period = searchParams.get('period')
  const [nombreNegocio, setNombreNegocio] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [telefono, setTelefono] = useState('')
  const [pais, setPais] = useState('CO')
  const countryCode = PHONE_CODES[pais] || '+57'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const handleRegister = async (e) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setLoading(true)

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    const fullPhone = countryCode.replace('+', '') + telefono

    if (!signUpData.session) {
      // Email requires confirmation — save negocio data for after confirmation
      localStorage.setItem('pending_negocio', JSON.stringify({
        nombre_negocio: nombreNegocio,
        nombre_usuario: null,
        telefono: fullPhone,
        pais,
      }))
      setSuccess(true)
      setLoading(false)
      return
    }

    // If auto-confirm is enabled, session exists immediately
    const { error: rpcError } = await supabase.rpc('register_negocio', {
      p_nombre_negocio: nombreNegocio,
      p_nombre_usuario: null,
      p_email: email,
      p_user_id: signUpData.user?.id,
      p_telefono: fullPhone,
      p_pais: pais,
    })

    if (rpcError) {
      setError('Error al crear el negocio: ' + rpcError.message)
      setLoading(false)
      return
    }

    navigate(planPro ? `/home?upgrade=1${period ? `&period=${period}` : ''}` : '/dashboard')
    setLoading(false)
  }

  if (success) {
    return (
      <div className="login-container">
        <div className="celebration-confetti">
          {[...Array(50)].map((_, i) => (
            <div key={i} className="confetti-piece" style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 3}s`,
              backgroundColor: ['#575200', '#006048', '#0A2F7E', '#A32B1A', '#006048', '#EC4899'][i % 6],
            }} />
          ))}
        </div>
        <div className="login-box celebration-box">
          <div className="celebration-icon">🎉</div>
          <h1 className="celebration-title">¡Bienvenido a Monaco!</h1>
          <p className="celebration-message">
            Revisa tu correo electrónico para confirmar tu cuenta.
          </p>
          <p className="celebration-message" style={{ marginTop: '0.5rem', fontWeight: 600 }}>
            Dejemos tu negocio listo en menos de 2 minutos
          </p>
          <button className="login-button" onClick={() => navigate('/login')}>
            Iniciar
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
        <p className="login-subtitle">Registra tu negocio</p>

        <form onSubmit={handleRegister}>
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
            <label>Nombre del negocio</label>
            <input
              type="text"
              value={nombreNegocio}
              onChange={(e) => setNombreNegocio(e.target.value)}
              placeholder="Mi Lavadero"
              required
            />
          </div>

          <div className="input-group">
            <label>Correo electrónico de tu negocio</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              required
            />
          </div>

          <div className="form-group">
            <label>Teléfono</label>
            <div className="cliente-phone-group">
              <span className="cliente-phone-code-label">{countryCode}</span>
              <input
                className="cliente-phone-number"
                type="tel"
                inputMode="numeric"
                placeholder="300 123 4567"
                value={telefono}
                onChange={e => setTelefono(e.target.value.replace(/\D/g, ''))}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label>Contraseña</label>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
              minLength={6}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={loading} className="login-button">
            {loading ? 'Registrando...' : 'Crear cuenta'}
          </button>
        </form>

        <div className="login-register-link">
          <span>¿Ya tienes cuenta? </span>
          <a href="/login" onClick={(e) => { e.preventDefault(); navigate('/login') }}>
            Inicia sesión
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
