import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, CreditCard, Lock, Loader, CheckCircle, ArrowLeft, LogIn, UserPlus } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { API_URL, TOKEN_KEY } from '../config/constants'

const PLANS = {
  monthly: { amount: '$49.900', label: 'mensual' },
  yearly: { amount: '$490.000', label: 'anual' },
}

export default function CheckoutModal({ period, onClose }) {
  const navigate = useNavigate()
  const plan = PLANS[period]

  // Step: payment | processing | paid | login | register | claiming | done
  const [step, setStep] = useState('payment')
  const [processingMsg, setProcessingMsg] = useState('')
  const [error, setError] = useState(null)
  const [checkoutId, setCheckoutId] = useState(null)
  const timersRef = useRef([])

  // Payment fields (email for Wompi receipt only)
  const [payEmail, setPayEmail] = useState('')
  const [card, setCard] = useState({
    number: '', exp_month: '', exp_year: '', cvc: '', card_holder: '',
  })

  // Login fields
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Register fields
  const [regNombreNegocio, setRegNombreNegocio] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')

  useEffect(() => {
    return () => timersRef.current.forEach(clearTimeout)
  }, [])

  const formatCardNumber = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 16)
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ')
  }

  const handleCardChange = (field, value) => {
    if (field === 'number') {
      setCard(prev => ({ ...prev, number: formatCardNumber(value) }))
    } else if (field === 'exp_month') {
      setCard(prev => ({ ...prev, exp_month: value.replace(/\D/g, '').slice(0, 2) }))
    } else if (field === 'exp_year') {
      setCard(prev => ({ ...prev, exp_year: value.replace(/\D/g, '').slice(0, 2) }))
    } else if (field === 'cvc') {
      setCard(prev => ({ ...prev, cvc: value.replace(/\D/g, '').slice(0, 4) }))
    } else {
      setCard(prev => ({ ...prev, [field]: value }))
    }
  }

  // ─── Step 1: Pay (no auth) ────────────────────────────────────────
  const handlePay = async (e) => {
    e.preventDefault()
    setError(null)
    setStep('processing')
    setProcessingMsg('Procesando pago...')
    timersRef.current.forEach(clearTimeout)

    const t1 = setTimeout(() => setProcessingMsg('Verificando con el banco...'), 4000)
    const t2 = setTimeout(() => setProcessingMsg('Confirmando transacción...'), 10000)
    timersRef.current = [t1, t2]

    try {
      const res = await fetch(`${API_URL}/api/wompi/public-pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: payEmail,
          period,
          card: {
            number: card.number.replace(/\s/g, ''),
            exp_month: card.exp_month,
            exp_year: card.exp_year,
            cvc: card.cvc,
            card_holder: card.card_holder,
          },
        }),
      })
      const data = await res.json()
      timersRef.current.forEach(clearTimeout)

      if (data.success) {
        setCheckoutId(data.checkoutId)
        setStep('paid')
      } else {
        setError(data.error || 'Error al procesar el pago')
        setStep('payment')
      }
    } catch {
      timersRef.current.forEach(clearTimeout)
      setError('Error de conexión. Intenta de nuevo.')
      setStep('payment')
    }
  }

  // ─── Step 3: Claim checkout (after login or register) ─────────────
  const claimCheckout = async () => {
    const token = localStorage.getItem(TOKEN_KEY)
    const res = await fetch(`${API_URL}/api/wompi/claim-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ checkoutId }),
    })
    const data = await res.json()
    if (!data.success) {
      throw new Error(data.error || 'Error al activar la suscripción')
    }
  }

  // ─── Step 3A: Login + claim ───────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault()
    setError(null)
    setStep('claiming')
    setProcessingMsg('Iniciando sesión...')

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      })
      if (loginError) {
        setError(loginError.message)
        setStep('login')
        return
      }

      setProcessingMsg('Activando tu plan PRO...')
      await claimCheckout()
      setStep('done')
      setTimeout(() => navigate('/home'), 2000)
    } catch (err) {
      setError(err.message || 'Error al activar la suscripción')
      setStep('login')
    }
  }

  // ─── Step 3B: Register + claim ────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault()
    setError(null)
    setStep('claiming')
    setProcessingMsg('Creando tu cuenta...')

    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: regEmail,
        password: regPassword,
      })
      if (signUpError) {
        setError(signUpError.message)
        setStep('register')
        return
      }

      setProcessingMsg('Configurando tu negocio...')
      const userId = signUpData.user?.id || signUpData.session?.user?.id
      const { error: rpcError } = await supabase.rpc('register_negocio', {
        p_nombre_negocio: regNombreNegocio,
        p_nombre_usuario: null,
        p_email: regEmail,
        p_user_id: userId,
      })
      if (rpcError) {
        setError('Error al crear el negocio: ' + rpcError.message)
        setStep('register')
        return
      }

      setProcessingMsg('Activando tu plan PRO...')
      await claimCheckout()
      setStep('done')
      setTimeout(() => navigate('/home'), 2000)
    } catch (err) {
      setError(err.message || 'Error al activar la suscripción')
      setStep('register')
    }
  }

  // ─── Render: Processing / Claiming ────────────────────────────────
  if (step === 'processing' || step === 'claiming') {
    return (
      <div className="modal-overlay">
        <div className="checkout-modal">
          <div className="wompi-processing">
            <Loader size={48} className="spin" />
            <h3>{processingMsg}</h3>
            <p>No cierres esta ventana</p>
          </div>
        </div>
      </div>
    )
  }

  // ─── Render: Done ─────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="modal-overlay">
        <div className="checkout-modal">
          <div className="wompi-processing">
            <CheckCircle size={48} className="wompi-success-icon" />
            <h3>¡Plan PRO activado!</h3>
            <p>Entrando a la app...</p>
          </div>
        </div>
      </div>
    )
  }

  // ─── Render: Step 2 — Choose path (after payment) ─────────────────
  if (step === 'paid') {
    return (
      <div className="modal-overlay">
        <div className="checkout-modal">
          <div className="wompi-processing">
            <CheckCircle size={48} className="wompi-success-icon" />
            <h3>¡Pago exitoso!</h3>
            <p style={{ marginBottom: 24 }}>Ahora vincula tu plan PRO a un negocio</p>
          </div>

          <div className="checkout-choice-buttons">
            <button className="btn-primary wompi-pay-btn" onClick={() => setStep('register')}>
              <UserPlus size={18} /> Registrar mi negocio
            </button>
            <button className="btn-secondary wompi-pay-btn" onClick={() => setStep('login')}>
              <LogIn size={18} /> Ya tengo un negocio
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Render: Step 3A — Login (existing user) ──────────────────────
  if (step === 'login') {
    return (
      <div className="modal-overlay">
        <div className="checkout-modal">
          <button className="modal-close" onClick={() => setStep('paid')}><ArrowLeft size={20} /></button>

          <div className="checkout-header">
            <LogIn size={24} />
            <h2>Inicia sesión</h2>
            <span className="checkout-price">Vincula tu plan PRO</span>
          </div>

          {error && <div className="wompi-form-error">{error}</div>}

          <form onSubmit={handleLogin} autoComplete="on" className="checkout-form">
            <div className="checkout-section">
              <div className="form-group">
                <label>Correo electrónico</label>
                <input
                  type="email"
                  autoComplete="email"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  required
                />
              </div>
              <div className="form-group">
                <label>Contraseña</label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="Tu contraseña"
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn-primary wompi-pay-btn">
              <LogIn size={18} /> Iniciar sesión y activar PRO
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ─── Render: Step 3B — Register (new user) ────────────────────────
  if (step === 'register') {
    return (
      <div className="modal-overlay">
        <div className="checkout-modal">
          <button className="modal-close" onClick={() => setStep('paid')}><ArrowLeft size={20} /></button>

          <div className="checkout-header">
            <UserPlus size={24} />
            <h2>Registra tu negocio</h2>
            <span className="checkout-price">Crea tu cuenta y activa PRO</span>
          </div>

          {error && <div className="wompi-form-error">{error}</div>}

          <form onSubmit={handleRegister} autoComplete="on" className="checkout-form">
            <div className="checkout-section">
              <div className="form-group">
                <label>Nombre del negocio</label>
                <input
                  type="text"
                  value={regNombreNegocio}
                  onChange={e => setRegNombreNegocio(e.target.value)}
                  placeholder="Mi Lavadero"
                  required
                />
              </div>
              <div className="form-group">
                <label>Correo electrónico</label>
                <input
                  type="email"
                  autoComplete="email"
                  value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  required
                />
              </div>
              <div className="form-group">
                <label>Contraseña</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={regPassword}
                  onChange={e => setRegPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary wompi-pay-btn">
              <UserPlus size={18} /> Crear cuenta y activar PRO
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ─── Render: Step 1 — Payment form (default) ─────────────────────
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="checkout-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X size={20} /></button>

        <div className="checkout-header">
          <CreditCard size={24} />
          <h2>Comprar plan {plan.label}</h2>
          <span className="checkout-price">{plan.amount}/{plan.label}</span>
        </div>

        {error && <div className="wompi-form-error">{error}</div>}

        <form onSubmit={handlePay} autoComplete="on" className="checkout-form">
          <div className="checkout-section">
            <span className="checkout-section-label">Correo para el recibo</span>
            <div className="form-group">
              <label>Correo electrónico</label>
              <input
                type="email"
                autoComplete="email"
                value={payEmail}
                onChange={e => setPayEmail(e.target.value)}
                placeholder="tu@correo.com"
                required
              />
            </div>
          </div>

          <div className="checkout-section">
            <span className="checkout-section-label"><Lock size={14} /> Datos de pago</span>
            <div className="form-group">
              <label>Nombre en la tarjeta</label>
              <input
                type="text"
                autoComplete="cc-name"
                value={card.card_holder}
                onChange={e => handleCardChange('card_holder', e.target.value)}
                placeholder="Como aparece en la tarjeta"
                required
              />
            </div>
            <div className="form-group">
              <label>Número de tarjeta</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="cc-number"
                value={card.number}
                onChange={e => handleCardChange('number', e.target.value)}
                placeholder="4242 4242 4242 4242"
                required
              />
            </div>
            <div className="wompi-form-row">
              <div className="form-group">
                <label>Mes</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="cc-exp-month"
                  value={card.exp_month}
                  onChange={e => handleCardChange('exp_month', e.target.value)}
                  placeholder="MM"
                  required
                />
              </div>
              <div className="form-group">
                <label>Año</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="cc-exp-year"
                  value={card.exp_year}
                  onChange={e => handleCardChange('exp_year', e.target.value)}
                  placeholder="YY"
                  required
                />
              </div>
              <div className="form-group">
                <label>CVC</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  value={card.cvc}
                  onChange={e => handleCardChange('cvc', e.target.value)}
                  placeholder="123"
                  required
                />
              </div>
            </div>
          </div>

          <button type="submit" className="btn-primary wompi-pay-btn">
            <CreditCard size={18} /> Pagar {plan.amount}
          </button>

          <p className="wompi-note">
            <Lock size={12} /> Procesado de forma segura por Wompi
          </p>
        </form>
      </div>
    </div>
  )
}
