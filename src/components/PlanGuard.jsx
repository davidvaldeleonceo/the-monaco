import { useState } from 'react'
import { Lock } from 'lucide-react'
import { useTenant } from './TenantContext'
import UpgradeModal from './UpgradeModal'

export default function PlanGuard({ feature, children }) {
  const { isPro } = useTenant()
  const [showUpgrade, setShowUpgrade] = useState(false)

  if (isPro) return children

  return (
    <div className="plan-restricted">
      <Lock size={48} />
      <h2>Función PRO</h2>
      <p>{feature} está disponible en el plan PRO.</p>
      <button className="btn-primary" onClick={() => setShowUpgrade(true)}>
        Ver opciones
      </button>
      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
    </div>
  )
}
