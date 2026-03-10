import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../apiClient'
import PasswordInput from '../shared/PasswordInput'

const countryCodes = [
  { code: '+57', label: '🇨🇴 +57' },
  { code: '+58', label: '🇻🇪 +58' },
  { code: '+51', label: '🇵🇪 +51' },
  { code: '+52', label: '🇲🇽 +52' },
  { code: '+54', label: '🇦🇷 +54' },
  { code: '+56', label: '🇨🇱 +56' },
  { code: '+593', label: '🇪🇨 +593' },
  { code: '+507', label: '🇵🇦 +507' },
  { code: '+1', label: '🇺🇸 +1' },
]

export default function Register() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const planPro = searchParams.get('plan') === 'pro'
  const period = searchParams.get('period')
  const [nombreNegocio, setNombreNegocio] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [telefono, setTelefono] = useState('')
  const [countryCode, setCountryCode] = useState('+57')
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
          <h1 className="celebration-title">¡Registro exitoso!</h1>
          <p className="celebration-message">
            Revisa tu correo electrónico para confirmar tu cuenta y luego inicia sesión.
          </p>
          <button className="login-button" onClick={() => navigate('/login')}>
            Ir a iniciar sesión
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
              <select className="cliente-phone-code" value={countryCode} onChange={e => setCountryCode(e.target.value)}>
                {countryCodes.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
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
      </div>
    </div>
  )
}
