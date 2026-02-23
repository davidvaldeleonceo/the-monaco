import { useState } from 'react'
import { X, Zap, Crown, Star } from 'lucide-react'
import { useTenant } from './TenantContext'
import { API_URL, TOKEN_KEY } from '../config/constants'
import WompiWidget from './WompiWidget'

export default function UpgradeModal({ onClose, reason, initialPeriod }) {
  const { refresh, planStatus } = useTenant()
  const [startingTrial, setStartingTrial] = useState(false)
  const [paymentPeriod, setPaymentPeriod] = useState(initialPeriod || null)
  const [trialError, setTrialError] = useState(null)

  const handleStartTrial = async () => {
    setStartingTrial(true)
    setTrialError(null)
    try {
      const token = localStorage.getItem(TOKEN_KEY)
      const res = await fetch(`${API_URL}/api/wompi/start-trial`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
      const data = await res.json()
      if (data.success) {
        await refresh()
        onClose()
      } else {
        setTrialError(data.error || 'No se pudo iniciar el trial')
      }
    } catch {
      setTrialError('Error de conexión')
    } finally {
      setStartingTrial(false)
    }
  }

  if (paymentPeriod) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="upgrade-modal" onClick={e => e.stopPropagation()}>
          <button className="modal-close" onClick={() => setPaymentPeriod(null)}><X size={20} /></button>
          <h2>Completar pago</h2>
          <WompiWidget
            period={paymentPeriod}
            onSuccess={() => {
              refresh()
              onClose()
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="upgrade-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X size={20} /></button>

        <div className="upgrade-modal-header">
          <Crown size={40} className="upgrade-crown-icon" />
          <h2>Actualizar a Monaco PRO</h2>
          {reason && <p className="upgrade-reason">{reason}</p>}
        </div>

        <div className="plan-options">
          {planStatus === 'free' && (
            <div className="plan-option-card plan-option-trial" onClick={handleStartTrial}>
              <Zap size={24} />
              <h3>Prueba gratis</h3>
              <p className="plan-option-price">14 días</p>
              <p className="plan-option-desc">Acceso completo a todas las funciones PRO</p>
              {startingTrial && <span className="plan-option-loading">Activando...</span>}
              {trialError && <span className="plan-option-error">{trialError}</span>}
            </div>
          )}

          <div className="plan-option-card" onClick={() => setPaymentPeriod('monthly')}>
            <Star size={24} />
            <h3>Plan mensual</h3>
            <p className="plan-option-price">$49.900/mes</p>
            <p className="plan-option-desc">Facturado mensualmente</p>
          </div>

          <div className="plan-option-card plan-option-recommended" onClick={() => setPaymentPeriod('yearly')}>
            <Crown size={24} />
            <h3>Plan anual</h3>
            <p className="plan-option-price">$490.000/año</p>
            <p className="plan-option-desc">Ahorra 18% vs mensual</p>
            <span className="plan-option-badge">Mejor precio</span>
          </div>
        </div>
      </div>
    </div>
  )
}
