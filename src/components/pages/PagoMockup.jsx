import { useState, useEffect } from 'react'
import { Banknote, ArrowRightLeft, CircleAlert, CircleCheck } from 'lucide-react'

export default function PagoMockup() {
  const [complete, setComplete] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setComplete(prev => !prev), 3000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className={`landing-pago-mockup ${complete ? 'landing-pago-mockup--complete' : ''}`}>
      <div className="landing-pago-mockup-header">Registrar Pago</div>

      <div className="landing-pago-mockup-worker">
        <span className="landing-pago-mockup-name">Juan Pérez</span>
        <span className="landing-pago-mockup-meta">15 lavadas · Porcentaje 40%</span>
      </div>

      <div className="landing-pago-mockup-total-line">
        <span>Total a pagar</span>
        <strong>$180.000</strong>
      </div>

      <div className="landing-pago-mockup-abonos">
        <div className="landing-pago-mockup-abonos-title">Abonos</div>
        <div className="landing-pago-mockup-abono-row">
          <span className="landing-pago-mockup-metodo">
            <Banknote size={14} /> Efectivo
          </span>
          <span className="landing-pago-mockup-monto">$120.000</span>
        </div>
        <div className="landing-pago-mockup-abono-row">
          <span className="landing-pago-mockup-metodo">
            <ArrowRightLeft size={14} /> Transferencia
          </span>
          <span className="landing-pago-mockup-monto landing-pago-mockup-monto--animated">
            {complete ? '$60.000' : '$40.000'}
          </span>
        </div>
        <div className="landing-pago-mockup-abono-total">
          <span>Total abonado</span>
          <strong>{complete ? '$180.000' : '$160.000'}</strong>
        </div>
      </div>

      <div className={`landing-pago-mockup-saldo ${complete ? 'landing-pago-mockup-saldo--complete' : 'landing-pago-mockup-saldo--pending'}`}>
        {complete ? <CircleCheck size={16} /> : <CircleAlert size={16} />}
        <span>{complete ? 'Pago completo' : 'Pendiente'}</span>
        <strong>{complete ? '$0' : '$20.000'}</strong>
      </div>
    </div>
  )
}
