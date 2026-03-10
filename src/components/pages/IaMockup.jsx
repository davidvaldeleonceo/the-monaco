import { useState } from 'react'

const tabs = [
  { key: 'voz', label: 'Voz', img: '/img/step-23.png' },
  { key: 'texto', label: 'Texto', img: '/img/step-22.png' },
]

export default function IaMockup() {
  const [active, setActive] = useState(0)

  return (
    <div className="landing-ia-mockup">
      <div className="landing-ia-toggle">
        <div
          className="landing-ia-toggle-indicator"
          style={{ transform: `translateX(${active * 100}%)` }}
        />
        {tabs.map((t, i) => (
          <button
            key={t.key}
            className={`landing-ia-toggle-btn ${active === i ? 'active' : ''}`}
            onClick={() => setActive(i)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="landing-ia-mockup-imgs">
        {tabs.map((t, i) => (
          <img
            key={t.key}
            src={t.img}
            alt={`IA Monaco - ${t.label}`}
            className={`landing-showcase-img landing-ia-mockup-img ${active === i ? 'active' : ''}`}
          />
        ))}
      </div>
    </div>
  )
}
