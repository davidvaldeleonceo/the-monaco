import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Timer, Users, DollarSign, BarChart3, Check, MessageCircle, Crown, Star } from 'lucide-react'
import CheckoutModal from './CheckoutModal'

const features = [
  {
    icon: Timer,
    title: 'Turnos en tiempo real',
    desc: 'Ve desde cualquier lugar qué motos están en espera, lavándose o listas para entregar.',
  },
  {
    icon: Users,
    title: 'Clientes que vuelven solos',
    desc: 'Membresías, descuentos y cashback para que tus clientes regresen sin que tengas que llamarlos.',
  },
  {
    icon: DollarSign,
    title: 'Pagos sin discusiones',
    desc: 'Cada lavada queda registrada. A fin de mes, las cuentas salen solas.',
  },
  {
    icon: BarChart3,
    title: 'Números claros sin estar ahí',
    desc: 'Revisa cuánto entró, cuánto se gastó y cuánto queda — desde tu celular, donde estés.',
  },
]

const planFeatures = [
  'Turnos y lavadas ilimitadas',
  'Clientes y membresías',
  'Pagos a trabajadores',
  'Reportes y balance',
  'Múltiples usuarios y roles',
  'Acceso desde cualquier dispositivo',
  'Soporte por WhatsApp',
]

const testimonials = [
  {
    quote: 'Antes si no iba al lavadero un día, nadie sabía qué cobrar ni a quién. Ahora todo queda registrado solo.',
    name: 'Carlos M.',
    city: 'Medellín',
  },
  {
    quote: 'Ya no peleo con los muchachos por la plata. Cada lavada queda ahí y las cuentas salen claras.',
    name: 'Andrea R.',
    city: 'Bogotá',
  },
  {
    quote: 'Pude abrir un segundo punto porque ya no necesito estar encima del primero. Monaco lo controla.',
    name: 'Luis P.',
    city: 'Cali',
  },
]

export default function LandingPage() {
  const [checkoutPeriod, setCheckoutPeriod] = useState(null)

  return (
    <div className="landing-page">
      {/* Navbar */}
      <nav className="landing-nav">
        <div className="landing-nav-logo">
          <span className="landing-logo-text">monaco</span>
          <span className="landing-logo-badge">PRO</span>
        </div>
        <div className="landing-nav-links">
          <Link to="/login" className="landing-nav-link">Ingresar</Link>
          <Link to="/registro" className="landing-nav-btn">Empezar gratis</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="landing-hero">
        <h1>Tu lavadero funcionando bien, estés o no estés</h1>
        <p>Controla turnos, pagos y clientes desde el celular. Deja de ser el único que sabe cómo funciona tu negocio.</p>
        <div className="landing-hero-buttons">
          <Link to="/registro" className="landing-cta-primary">Prueba gratis 14 días</Link>
          <a href="#pricing" className="landing-cta-secondary" onClick={(e) => { e.preventDefault(); document.getElementById('pricing').scrollIntoView({ behavior: 'smooth' }) }}>Comprar ahora</a>
        </div>
        <span className="landing-hero-note">Sin tarjeta de crédito para la prueba</span>
      </section>

      {/* Features */}
      <section className="landing-features">
        <h2>Tu negocio organizado sin depender de ti</h2>
        <div className="landing-features-grid">
          {features.map((f) => (
            <div key={f.title} className="landing-feature-card">
              <f.icon size={32} strokeWidth={1.5} />
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="landing-pricing" id="pricing">
        <h2>Elige tu plan</h2>
        <ul className="landing-plan-list landing-plan-list-shared">
          {planFeatures.map((feat) => (
            <li key={feat}>
              <Check size={18} strokeWidth={2} />
              <span>{feat}</span>
            </li>
          ))}
        </ul>
        <div className="landing-pricing-grid">
          <div className="landing-pricing-card">
            <Star size={28} className="landing-pricing-icon" />
            <h3>Mensual</h3>
            <div className="landing-price-row">
              <span className="landing-price">$49.900</span>
              <span className="landing-price-period">/mes</span>
            </div>
            <p className="landing-price-desc">Facturado mensualmente</p>
            <button className="landing-cta-primary" onClick={() => setCheckoutPeriod('monthly')}>Comprar mensual</button>
          </div>
          <div className="landing-pricing-card landing-pricing-card-recommended">
            <span className="landing-pricing-badge">Mejor precio</span>
            <Crown size={28} className="landing-pricing-icon" />
            <h3>Anual</h3>
            <div className="landing-price-row">
              <span className="landing-price">$490.000</span>
              <span className="landing-price-period">/año</span>
            </div>
            <p className="landing-price-desc">Ahorra 18% vs mensual</p>
            <button className="landing-cta-secondary" onClick={() => setCheckoutPeriod('yearly')}>Comprar anual</button>
          </div>
        </div>
        <Link to="/registro" className="landing-pricing-free">O prueba gratis 14 días — sin tarjeta</Link>
      </section>

      {/* Testimonials */}
      <section className="landing-testimonials">
        <h2>Lavaderos que ya usan Monaco PRO</h2>
        <div className="landing-testimonials-grid">
          {testimonials.map((t) => (
            <div key={t.name} className="landing-testimonial-card">
              <p>"{t.quote}"</p>
              <span className="landing-testimonial-author">— {t.name}, {t.city}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <p>&copy; 2026 Monaco PRO — Hecho en Colombia</p>
        <p>
          <MessageCircle size={16} strokeWidth={1.5} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          ¿Preguntas? <a href="https://wa.me/573144016349" target="_blank" rel="noopener noreferrer">Escríbenos por WhatsApp</a>
        </p>
      </footer>

      {/* Checkout Modal */}
      {checkoutPeriod && <CheckoutModal period={checkoutPeriod} onClose={() => setCheckoutPeriod(null)} />}
    </div>
  )
}
