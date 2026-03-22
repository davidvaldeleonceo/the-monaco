import { useState } from 'react'
import { X, Crown, Star } from 'lucide-react'
import { useTenant } from '../context/TenantContext'
import WompiWidget from './WompiWidget'

export default function UpgradeModal({ onClose, reason, initialPeriod }) {
  const { refresh } = useTenant()
  const [paymentPeriod, setPaymentPeriod] = useState(initialPeriod || null)

  if (paymentPeriod) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="upgrade-modal" onClick={e => e.stopPropagation()}>
          <button className="modal-close" onClick={() => setPaymentPeriod(null)}><X size={20} /></button>
          <h2>Completar pago</h2>
          <WompiWidget
            period={paymentPeriod}
            onPaymentConfirmed={() => refresh()}
            onSuccess={() => onClose()}
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
