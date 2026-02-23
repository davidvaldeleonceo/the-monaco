import { useState, useEffect, useRef } from 'react'
import { API_URL, TOKEN_KEY } from '../config/constants'
import { CreditCard, Loader, Lock, CheckCircle } from 'lucide-react'

async function apiFetchAuth(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY)
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  })
  return res.json()
}

export default function WompiWidget({ period, onSuccess }) {
  const [step, setStep] = useState('form') // form | processing | success | error
  const [error, setError] = useState(null)
  const [processingMsg, setProcessingMsg] = useState('Procesando pago...')
  const [cardData, setCardData] = useState({
    number: '',
    exp_month: '',
    exp_year: '',
    cvc: '',
    card_holder: '',
  })

  const formatCardNumber = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 16)
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ')
  }

  const handleCardChange = (field, value) => {
    if (field === 'number') {
      setCardData(prev => ({ ...prev, number: formatCardNumber(value) }))
    } else if (field === 'exp_month') {
      setCardData(prev => ({ ...prev, exp_month: value.replace(/\D/g, '').slice(0, 2) }))
    } else if (field === 'exp_year') {
      setCardData(prev => ({ ...prev, exp_year: value.replace(/\D/g, '').slice(0, 2) }))
    } else if (field === 'cvc') {
      setCardData(prev => ({ ...prev, cvc: value.replace(/\D/g, '').slice(0, 4) }))
    } else {
      setCardData(prev => ({ ...prev, [field]: value }))
    }
  }

  const timersRef = useRef([])

  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout)
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStep('processing')
    setError(null)
    setProcessingMsg('Procesando pago...')

    // Clear previous timers
    timersRef.current.forEach(clearTimeout)

    // Update processing message after a few seconds
    const msgTimer = setTimeout(() => setProcessingMsg('Verificando con el banco...'), 4000)
    const msgTimer2 = setTimeout(() => setProcessingMsg('Confirmando transacción...'), 10000)
    timersRef.current = [msgTimer, msgTimer2]

    try {
      const result = await apiFetchAuth('/api/wompi/pay', {
        method: 'POST',
        body: JSON.stringify({
          period,
          card: {
            number: cardData.number.replace(/\s/g, ''),
            exp_month: cardData.exp_month,
            exp_year: cardData.exp_year,
            cvc: cardData.cvc,
            card_holder: cardData.card_holder,
          },
        }),
      })

      timersRef.current.forEach(clearTimeout)

      if (result.success) {
        setStep('success')
        const successTimer = setTimeout(() => onSuccess?.(), 2000)
        timersRef.current = [successTimer]
      } else {
        setError(result.error || 'Error al procesar el pago')
        setStep('form')
      }
    } catch {
      timersRef.current.forEach(clearTimeout)
      setError('Error de conexión. Intenta de nuevo.')
      setStep('form')
    }
  }

  if (step === 'processing') {
    return (
      <div className="wompi-widget-container">
        <div className="wompi-processing">
          <Loader size={48} className="spin" />
          <h3>{processingMsg}</h3>
          <p>No cierres esta ventana</p>
        </div>
      </div>
    )
  }

  if (step === 'success') {
    return (
      <div className="wompi-widget-container">
        <div className="wompi-processing">
          <CheckCircle size={48} className="wompi-success-icon" />
          <h3>¡Pago exitoso!</h3>
          <p>Tu plan PRO está activo.</p>
        </div>
      </div>
    )
  }

  const amount = period === 'monthly' ? '$49.900' : '$490.000'
  const label = period === 'monthly' ? 'mensual' : 'anual'

  return (
    <div className="wompi-widget-container">
      <form className="wompi-card-form" onSubmit={handleSubmit} autoComplete="on">
        <div className="wompi-form-header">
          <Lock size={16} />
          <span>Pago seguro — {amount}/{label}</span>
        </div>

        {error && <div className="wompi-form-error">{error}</div>}

        <div className="form-group">
          <label>Nombre en la tarjeta</label>
          <input
            type="text"
            autoComplete="cc-name"
            value={cardData.card_holder}
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
            value={cardData.number}
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
              value={cardData.exp_month}
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
              value={cardData.exp_year}
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
              value={cardData.cvc}
              onChange={e => handleCardChange('cvc', e.target.value)}
              placeholder="123"
              required
            />
          </div>
        </div>

        <button type="submit" className="btn-primary wompi-pay-btn">
          <CreditCard size={18} /> Pagar {amount}
        </button>

        <p className="wompi-note">
          <Lock size={12} /> Procesado de forma segura por Wompi
        </p>
      </form>
    </div>
  )
}
