import { useState, useEffect } from 'react'
import { Clock, Droplets, CircleCheck, HandCoins } from 'lucide-react'

const estados = [
  { label: 'Espera', icon: Clock, timer: '00:12', className: 'espera' },
  { label: 'En proceso', icon: Droplets, timer: '05:34', className: 'lavando' },
  { label: 'Terminado', icon: CircleCheck, timer: '08:21', className: 'terminado' },
  { label: 'Entregado', icon: HandCoins, timer: null, className: 'entregado' },
]

export default function EstadoMockup() {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setActive(prev => (prev + 1) % 4), 2500)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="landing-estado-mockup">
      <div className="landing-estado-mockup-header">Estado</div>
      <div className="landing-estado-mockup-info">
        <span className="landing-estado-mockup-cliente">Carlos Ramírez · HKM42D</span>
        <span className="landing-estado-mockup-servicio">Lavado completo <strong>$45.000</strong></span>
      </div>
      <div className="landing-estado-mockup-list">
        {estados.map((e, i) => {
          const Icon = e.icon
          const isPast = i < active
          const isActive = i === active
          const cls = isActive ? 'active' : isPast ? 'past' : ''
          return (
            <div key={e.label} className={`landing-estado-mockup-btn landing-estado-mockup-btn--${e.className} ${cls}`}>
              <Icon size={16} strokeWidth={2} />
              <span className="landing-estado-mockup-label">{e.label}</span>
              {e.timer !== null && (
                <span className="landing-estado-mockup-timer">
                  {isActive || isPast ? e.timer : '00:00'}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
