import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Timer, Users, DollarSign, BarChart3, Check, MessageCircle, Crown, Star } from 'lucide-react'
import CheckoutModal from './CheckoutModal'

const features = [
  {
    icon: Timer,
    title: 'Turnos en tiempo real',
    desc: 'Controla el estado de cada moto: en espera, lavando, terminada y entregada.',
  },
  {
    icon: Users,
    title: 'Clientes y membresías',
    desc: 'Registra clientes por placa, asigna membresías con descuentos y cashback.',
  },
  {
    icon: DollarSign,
    title: 'Pagos a trabajadores',
    desc: 'Calcula pagos automáticos por porcentaje, por lavada o sueldo fijo.',
  },
  {
    icon: BarChart3,
    title: 'Reportes y balance',
    desc: 'Visualiza ingresos, gastos y rendimiento diario al instante.',
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
    quote: 'Antes llevaba todo en un cuaderno y se me perdían clientes. Con Monaco controlo todo desde el celular.',
    name: 'Carlos M.',
    city: 'Medellín',
  },
  {
    quote: 'Lo mejor es el control de pagos a los lavadores. Ya no hay discusiones a fin de mes.',
    name: 'Andrea R.',
    city: 'Bogotá',
  },
  {
    quote: 'Mis clientes con membresía vuelven más seguido. El cashback funciona muy bien.',
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
        <h1>Gestiona tu lavadero de motos desde el celular</h1>
        <p>Control de turnos, clientes, pagos a trabajadores y reportes en tiempo real. Todo en una sola app.</p>
        <div className="landing-hero-buttons">
          <Link to="/registro" className="landing-cta-primary">Prueba gratis 14 días</Link>
          <a href="#pricing" className="landing-cta-secondary" onClick={(e) => { e.preventDefault(); document.getElementById('pricing').scrollIntoView({ behavior: 'smooth' }) }}>Comprar ahora</a>
        </div>
        <span className="landing-hero-note">Sin tarjeta de crédito para la prueba</span>
      </section>

      {/* Features */}
      <section className="landing-features">
        <h2>Todo lo que necesitas para tu lavadero</h2>
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
