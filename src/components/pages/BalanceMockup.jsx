import { useState, useEffect } from 'react'

const tabs = [
  { key: 'balance', label: 'Balance' },
  { key: 'ingresos', label: 'Ingresos' },
  { key: 'egresos', label: 'Egresos' },
]

const data = {
  balance: [
    { nombre: 'NEQUI', valor: 500000 },
    { nombre: 'QR\nnegocio', valor: 245000 },
    { nombre: 'EFECTIVO', valor: -22000 },
  ],
  ingresos: [
    { nombre: 'NEQUI', valor: 500000 },
    { nombre: 'QR\nnegocio', valor: 245000 },
    { nombre: 'EFECTIVO', valor: 75000 },
  ],
  egresos: [
    { nombre: 'INSUMOS', valor: 14000 },
    { nombre: 'ABONO\nA SUELDO', valor: 20000 },
    { nombre: 'PAGO\nTRABAJADOR', valor: 63000 },
  ],
}

const fmt = (v) => '$ ' + Math.abs(v).toLocaleString('es-CO')

export default function BalanceMockup() {
  const [tab, setTab] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTab(prev => (prev + 1) % 3), 3000)
    return () => clearInterval(id)
  }, [])

  const key = tabs[tab].key
  const bars = data[key]
  const maxVal = Math.max(...bars.map(b => Math.abs(b.valor)))
  const total = bars.reduce((s, b) => s + Math.abs(b.valor), 0)
  const isEgresos = key === 'egresos'

  // The bar with the highest percentage gets the percentage label
  const maxIdx = bars.reduce((mi, b, i, arr) =>
    Math.abs(b.valor) > Math.abs(arr[mi].valor) ? i : mi, 0)

  return (
    <div className="landing-balance-mockup">
      <div className="landing-balance-mockup-pills">
        {tabs.map((t, i) => (
          <button
            key={t.key}
            className={`landing-balance-mockup-pill ${tab === i ? 'active' : ''} ${tab === i && isEgresos ? 'egresos' : ''}`}
            onClick={() => setTab(i)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="landing-balance-mockup-chart">
        {bars.map((b, i) => {
          const absVal = Math.abs(b.valor)
          const hPx = Math.max((absVal / maxVal) * 140, 12)
          const pct = ((absVal / total) * 100).toFixed(1)
          const isNeg = b.valor < 0
          const isMax = i === maxIdx
          const faded = !isMax && tab !== 0

          return (
            <div key={b.nombre + key} className="landing-balance-mockup-col">
              <span className="landing-balance-mockup-val">{fmt(b.valor)}</span>
              <div className="landing-balance-mockup-bar-wrap">
                <div
                  className={`landing-balance-mockup-vbar ${isNeg || isEgresos ? 'red' : 'blue'} ${faded ? 'faded' : ''}`}
                  style={{ height: `${hPx}px` }}
                >
                  {isMax && tab !== 0 && (
                    <span className="landing-balance-mockup-pct">{pct}%</span>
                  )}
                </div>
              </div>
              <span className="landing-balance-mockup-name">{b.nombre}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
