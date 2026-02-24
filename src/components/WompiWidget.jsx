import { useState, useEffect, useRef } from 'react'
import { API_URL, TOKEN_KEY } from '../config/constants'
import { CreditCard, Loader, Lock, CheckCircle, Building2, Smartphone, Info } from 'lucide-react'

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

const DOC_TYPES = [
  { value: 'CC', label: 'Cédula de Ciudadanía' },
  { value: 'CE', label: 'Cédula de Extranjería' },
  { value: 'NIT', label: 'NIT' },
  { value: 'PP', label: 'Pasaporte' },
]

export default function WompiWidget({ period, onSuccess }) {
  const [step, setStep] = useState('form') // form | processing | success | error | waiting_nequi | nequi_timeout
  const [error, setError] = useState(null)
  const [processingMsg, setProcessingMsg] = useState('Procesando pago...')
  const [method, setMethod] = useState('CARD')

  // Card state
  const [cardData, setCardData] = useState({
    number: '',
    exp_month: '',
    exp_year: '',
    cvc: '',
    card_holder: '',
  })

  // PSE state
  const [banks, setBanks] = useState([])
  const [banksLoading, setBanksLoading] = useState(false)
  const [banksError, setBanksError] = useState(null)
  const [pseData, setPseData] = useState({
    financial_institution_code: '',
    user_type: '0', // 0 = natural, 1 = jurídica
    user_legal_id_type: 'CC',
    user_legal_id: '',
  })

  // Nequi state
  const [nequiData, setNequiData] = useState({ phone_number: '' })

  // Waiting state (for Nequi polling)
  const [waitingTxId, setWaitingTxId] = useState(null)

  const timersRef = useRef([])
  const pollingRef = useRef(null)
  const submittingRef = useRef(false)

  // Fetch PSE banks on mount
  useEffect(() => {
    setBanksLoading(true)
    fetch(`${API_URL}/api/wompi/pse-banks`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setBanks(data)
        else setBanks([])
      })
      .catch(() => {
        setBanksError('No se pudieron cargar los bancos. Recarga la página.')
        setBanks([])
      })
      .finally(() => setBanksLoading(false))
  }, [])

  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout)
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [])

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

  // Nequi polling
  const startNequiPolling = (txId) => {
    setWaitingTxId(txId)
    setStep('waiting_nequi')

    let elapsed = 0
    const POLL_INTERVAL = 4000
    const MAX_WAIT = 180000 // 3 min

    pollingRef.current = setInterval(async () => {
      elapsed += POLL_INTERVAL
      if (elapsed >= MAX_WAIT) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
        setStep('nequi_timeout')
        submittingRef.current = false
        return
      }

      try {
        const result = await apiFetchAuth(`/api/wompi/check-transaction/${txId}`)
        if (!pollingRef.current) return // polling was stopped while fetch was in-flight
        if (result.status === 'APPROVED') {
          clearInterval(pollingRef.current)
          pollingRef.current = null
          setStep('success')
          submittingRef.current = false
          const t = setTimeout(() => onSuccess?.(), 2000)
          timersRef.current = [t]
        } else if (result.status === 'DECLINED' || result.status === 'ERROR' || result.status === 'VOIDED') {
          clearInterval(pollingRef.current)
          pollingRef.current = null
          setError('El pago fue rechazado. Intenta de nuevo.')
          setStep('form')
          submittingRef.current = false
        }
        // PENDING — keep polling
      } catch {
        // network error — keep polling
      }
    }, POLL_INTERVAL)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submittingRef.current) return
    submittingRef.current = true
    setStep('processing')
    setError(null)
    setProcessingMsg('Procesando pago...')

    timersRef.current.forEach(clearTimeout)

    const msgTimer = setTimeout(() => setProcessingMsg('Verificando con el banco...'), 4000)
    const msgTimer2 = setTimeout(() => setProcessingMsg('Confirmando transacción...'), 10000)
    timersRef.current = [msgTimer, msgTimer2]

    try {
      const body = { period, method }

      if (method === 'CARD') {
        body.card = {
          number: cardData.number.replace(/\s/g, ''),
          exp_month: cardData.exp_month,
          exp_year: cardData.exp_year,
          cvc: cardData.cvc,
          card_holder: cardData.card_holder,
        }
      } else if (method === 'PSE') {
        body.pse = { ...pseData, user_type: Number(pseData.user_type) }
      } else if (method === 'NEQUI') {
        body.nequi = { phone_number: nequiData.phone_number }
      }

      const result = await apiFetchAuth('/api/wompi/pay', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      timersRef.current.forEach(clearTimeout)

      if (result.success && result.status === 'APPROVED') {
        setStep('success')
        submittingRef.current = false
        const t = setTimeout(() => onSuccess?.(), 2000)
        timersRef.current = [t]
      } else if (result.success && result.status === 'PENDING' && result.method === 'PSE') {
        // Save txId for return polling, then redirect
        try {
          if (result.transactionId) localStorage.setItem('monaco_pse_tx_id', result.transactionId)
        } catch { /* localStorage unavailable */ }
        if (result.redirectUrl) {
          window.location.href = result.redirectUrl
          return // don't reset submittingRef — navigating away
        } else {
          setError('No se pudo obtener la URL de redirección del banco. Intenta de nuevo.')
          setStep('form')
          submittingRef.current = false
        }
      } else if (result.success && result.status === 'PENDING' && result.method === 'NEQUI') {
        startNequiPolling(result.transactionId)
        // submittingRef stays true until Nequi resolves or user cancels
      } else {
        setError(result.error || 'Error al procesar el pago')
        setStep('form')
        submittingRef.current = false
      }
    } catch {
      timersRef.current.forEach(clearTimeout)
      setError('Error de conexión. Intenta de nuevo.')
      setStep('form')
      submittingRef.current = false
    }
  }

  // ─── Render states ──────────────────────────────────────

  if (step === 'processing') {
    return (
      <div className="wompi-widget-container">
        <div className="wompi-processing">
          <Loader size={48} className="spin" />
          <h3>{processingMsg}</h3>
          <p>Espera mientras procesamos tu pago</p>
        </div>
      </div>
    )
  }

  if (step === 'waiting_nequi') {
    return (
      <div className="wompi-widget-container">
        <div className="wompi-processing">
          <Smartphone size={48} className="spin-slow" />
          <h3>Aprueba el pago en tu app Nequi</h3>
          <p>Abre la app Nequi en tu celular y acepta la solicitud de pago. Esperando confirmación...</p>
          <button
            type="button"
            className="btn-secondary"
            style={{ marginTop: '1rem' }}
            onClick={() => {
              if (pollingRef.current) clearInterval(pollingRef.current)
              pollingRef.current = null
              setError('Pago cancelado. Si ya aprobaste en Nequi, tu plan se activará en unos minutos.')
              setStep('form')
              submittingRef.current = false
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  if (step === 'nequi_timeout') {
    return (
      <div className="wompi-widget-container">
        <div className="wompi-processing wompi-nequi-timeout">
          <Info size={48} className="wompi-info-icon" />
          <h3>No recibimos confirmación de Nequi</h3>
          <p>Si aprobaste el pago en la app, tu plan se activará automáticamente en unos minutos.</p>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setError(null)
                setStep('form')
              }}
            >
              Intentar de nuevo
            </button>
          </div>
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
      {/* Method tabs */}
      <div className="wompi-method-tabs">
        <button
          type="button"
          className={`wompi-method-tab ${method === 'CARD' ? 'active' : ''}`}
          onClick={() => setMethod('CARD')}
        >
          <CreditCard size={16} /> Tarjeta
        </button>
        <button
          type="button"
          className={`wompi-method-tab ${method === 'PSE' ? 'active' : ''}`}
          onClick={() => setMethod('PSE')}
        >
          <Building2 size={16} /> PSE
        </button>
        <button
          type="button"
          className={`wompi-method-tab ${method === 'NEQUI' ? 'active' : ''}`}
          onClick={() => setMethod('NEQUI')}
        >
          <Smartphone size={16} /> Nequi
        </button>
      </div>

      <form className="wompi-card-form" onSubmit={handleSubmit} autoComplete="on">
        <div className="wompi-form-header">
          <Lock size={16} />
          <span>Pago seguro — {amount}/{label}</span>
        </div>

        {error && <div className="wompi-form-error">{error}</div>}

        {/* CARD form */}
        {method === 'CARD' && (
          <>
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
          </>
        )}

        {/* PSE form */}
        {method === 'PSE' && (
          <>
            {banksError && <div className="wompi-form-error">{banksError}</div>}
            <div className="form-group">
              <label>Banco</label>
              <select
                value={pseData.financial_institution_code}
                onChange={e => setPseData(prev => ({ ...prev, financial_institution_code: e.target.value }))}
                required
              >
                <option value="">{banksLoading ? 'Cargando bancos...' : 'Selecciona tu banco'}</option>
                {banks.map(b => (
                  <option key={b.financial_institution_code} value={b.financial_institution_code}>
                    {b.financial_institution_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Tipo de persona</label>
              <select
                value={pseData.user_type}
                onChange={e => setPseData(prev => ({ ...prev, user_type: e.target.value }))}
              >
                <option value="0">Persona Natural</option>
                <option value="1">Persona Jurídica</option>
              </select>
            </div>

            <div className="wompi-form-row">
              <div className="form-group">
                <label>Tipo documento</label>
                <select
                  value={pseData.user_legal_id_type}
                  onChange={e => setPseData(prev => ({ ...prev, user_legal_id_type: e.target.value }))}
                >
                  {DOC_TYPES.map(d => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Número de documento</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={pseData.user_legal_id}
                  onChange={e => setPseData(prev => ({ ...prev, user_legal_id: e.target.value.replace(/\D/g, '') }))}
                  placeholder="1234567890"
                  required
                />
              </div>
            </div>
          </>
        )}

        {/* Nequi form */}
        {method === 'NEQUI' && (
          <div className="form-group">
            <label>Número de celular Nequi</label>
            <input
              type="text"
              inputMode="numeric"
              value={nequiData.phone_number}
              onChange={e => setNequiData({ phone_number: e.target.value.replace(/\D/g, '').slice(0, 10) })}
              placeholder="3001234567"
              required
              pattern="\d{10}"
              title="Ingresa 10 dígitos"
            />
          </div>
        )}

        <button type="submit" className="btn-primary wompi-pay-btn">
          {method === 'CARD' && <><CreditCard size={18} /> Pagar {amount}</>}
          {method === 'PSE' && <><Building2 size={18} /> Pagar con PSE {amount}</>}
          {method === 'NEQUI' && <><Smartphone size={18} /> Pagar con Nequi {amount}</>}
        </button>

        <p className="wompi-note">
          <Lock size={12} /> Procesado de forma segura por Wompi
        </p>
      </form>
    </div>
  )
}
