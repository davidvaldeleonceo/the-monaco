import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Timer, Users, DollarSign, BarChart3, Check, MessageCircle,
  Crown, Star, ClipboardList, Eye, Bot, ChevronRight,
  Smartphone, TrendingUp, Shield
} from 'lucide-react'
import CheckoutModal from '../payment/CheckoutModal'
import EstadoMockup from './EstadoMockup'
import PagoMockup from './PagoMockup'
// import IaMockup from './IaMockup' // AI hidden — cost too high
import BalanceMockup from './BalanceMockup'
import VideoWidget from './VideoWidget'
import { API_URL } from '../../config/constants'

const scrollTo = (id) => {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

const steps = [
  {
    icon: ClipboardList,
    number: '1',
    title: 'Registra servicios',
    desc: 'Tu trabajador registra cada servicio con un tap. Tú ves todo en tiempo real desde cualquier lugar.',
  },
  {
    icon: Eye,
    number: '2',
    title: 'Controla sin estar ahí',
    desc: 'Pagos, turnos y clientes quedan registrados automáticamente. Sin cuadernos ni llamadas.',
  },
  {
    icon: BarChart3,
    number: '3',
    title: 'Revisa tus números',
    desc: 'Reportes claros de cuánto entró, cuánto se pagó y cuánto queda — desde tu celular.',
  },
]

const features = [
  {
    icon: Timer,
    title: 'Turnos en tiempo real',
    desc: 'Ve qué vehículos están en espera, en proceso o listos para entregar. Desde tu celular, donde estés.',
    details: ['Estado de cada servicio en vivo', 'Historial completo de turnos', 'Acceso desde cualquier dispositivo'],
    placeholder: 'Screenshot del Home mostrando turnos activos con estados: en espera (amarillo), en proceso (azul), lista (verde)',
  },
  {
    icon: DollarSign,
    title: 'Pagos sin discusiones',
    desc: 'Cada lavada queda registrada. A fin de quincena, las cuentas salen solas. Sin peleas ni cuadernos.',
    details: ['Cálculo automático por trabajador', 'Balance en tiempo real', 'Historial de pagos completo'],
    placeholder: 'Screenshot de la sección Pagos con balance de un trabajador, lista de lavadas realizadas y total a pagar',
  },
  {
    icon: BarChart3,
    title: 'Números claros sin estar ahí',
    desc: 'Revisa cuánto entró, cuánto se gastó y cuánto queda. Gráficas claras, sin complicaciones.',
    details: ['Gráficas de ingresos vs gastos', 'Balance diario, semanal y mensual', 'Filtros por periodo'],
    placeholder: 'Screenshot de Reportes con gráfica de barras de ingresos, balance del periodo y métricas principales',
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
    quote: 'Antes si no iba al negocio un día, nadie sabía qué cobrar ni a quién. Ahora todo queda registrado solo.',
    name: 'Carlos M.',
    city: 'Medellín',
    rating: 5,
  },
  {
    quote: 'Ya no peleo con los muchachos por la plata. Cada lavada queda ahí y las cuentas salen claras.',
    name: 'Andrea R.',
    city: 'Bogotá',
    rating: 5,
  },
  {
    quote: 'Pude abrir un segundo punto porque ya no necesito estar encima del primero. Monaco lo controla.',
    name: 'Luis P.',
    city: 'Cali',
    rating: 5,
  },
  {
    quote: 'La IA es una chimba. Le pregunto cómo voy y me dice todo al instante. Ya no tengo que revisar reportes.',
    name: 'Jorge D.',
    city: 'Barranquilla',
    rating: 5,
  },
  {
    quote: 'Mis clientes con membresía vuelven solos. El negocio se paga solo desde que uso Monaco.',
    name: 'Sofía T.',
    city: 'Bucaramanga',
    rating: 5,
  },
  {
    quote: 'Lo más fácil que he usado. En 5 minutos mis trabajadores ya sabían manejar la app.',
    name: 'Diego R.',
    city: 'Pereira',
    rating: 5,
  },
]

export default function LandingPage() {
  const [checkoutPeriod, setCheckoutPeriod] = useState(null)
  const [initialCheckoutId, setInitialCheckoutId] = useState(null)
  const [claimMode, setClaimMode] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const [pseError, setPseError] = useState(null)

  useEffect(() => {
    if (searchParams.get('checkout_pse') === '1') {
      const storedCheckoutId = localStorage.getItem('monaco_checkout_id')
      const storedPeriod = localStorage.getItem('monaco_checkout_period')
      if (storedCheckoutId && storedPeriod) {
        setCheckoutPeriod(storedPeriod)
        setInitialCheckoutId(storedCheckoutId)
      } else {
        setPseError('No pudimos recuperar los datos de tu pago. Si completaste el pago, tu plan se activará automáticamente. Si necesitas ayuda, contáctanos por WhatsApp.')
      }
      setSearchParams({}, { replace: true })
      return
    }

    const claimId = searchParams.get('claim')
    if (claimId) {
      fetch(`${API_URL}/api/wompi/public-check-transaction/${claimId}`)
        .then(r => r.json())
        .then(data => {
          if (data.status === 'APPROVED' && !data.claimed) {
            setCheckoutPeriod(data.period || 'monthly')
            setInitialCheckoutId(claimId)
            setClaimMode(true)
          } else if (data.claimed) {
            setPseError('Este pago ya fue utilizado para activar un plan.')
          } else {
            setPseError('Este pago no está aprobado. Si necesitas ayuda, contáctanos por WhatsApp.')
          }
        })
        .catch(() => setPseError('Error al verificar el pago.'))
      setSearchParams({}, { replace: true })
      return
    }

    const storedId = localStorage.getItem('monaco_checkout_id')
    const storedPeriod = localStorage.getItem('monaco_checkout_period')
    if (storedId && storedPeriod) {
      fetch(`${API_URL}/api/wompi/public-check-transaction/${storedId}`)
        .then(r => r.json())
        .then(data => {
          if (data.status === 'APPROVED' && !data.claimed) {
            setCheckoutPeriod(storedPeriod)
            setInitialCheckoutId(storedId)
            setClaimMode(true)
          } else {
            localStorage.removeItem('monaco_checkout_id')
            localStorage.removeItem('monaco_checkout_period')
          }
        })
        .catch(() => {})
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps


  return (
    <div className="landing-page">
      {/* Nav */}
      <nav className="landing-nav">
        <div className="landing-nav-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} role="button" style={{ cursor: 'pointer' }}>
          <span className="landing-logo-text">monaco</span>
          <span className="landing-logo-badge">PRO</span>
        </div>
        <div className="landing-nav-menu">
          <a href="#como-funciona" onClick={(e) => { e.preventDefault(); scrollTo('como-funciona') }}>Cómo funciona</a>
          <a href="#funciones" onClick={(e) => { e.preventDefault(); scrollTo('funciones') }}>Funciones</a>
          <a href="#precios" onClick={(e) => { e.preventDefault(); scrollTo('precios') }}>Precios</a>
          <a href="#testimonios" onClick={(e) => { e.preventDefault(); scrollTo('testimonios') }}>Testimonios</a>
        </div>
        <div className="landing-nav-links">
          <Link to="/login" className="landing-nav-link">Ingresar</Link>
          <Link to="/registro" className="landing-nav-btn">
            Comienza gratis
          </Link>
        </div>
      </nav>

      {/* PSE Error Banner */}
      {pseError && (
        <div className="wompi-form-error" style={{ margin: '1rem auto', maxWidth: 600, textAlign: 'center' }}>
          {pseError}{' '}
          <a href="https://wa.me/573144016349" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
            WhatsApp
          </a>
        </div>
      )}

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-hero-content">
          <h1>Tu negocio funcionando bien, estés o no estés</h1>
          <p className="landing-hero-desc">Controla turnos, pagos y clientes desde el celular. Deja de ser el único que sabe cómo funciona tu negocio.</p>
          <img src="/img/hero-phone-mobile.png" alt="Monaco PRO en acción" className="landing-hero-img-mobile" />
          <div className="landing-hero-buttons">
            <Link to="/registro" className="landing-cta-primary">
              Comienza gratis
            </Link>
            <a href="#precios" className="landing-cta-secondary" onClick={(e) => { e.preventDefault(); scrollTo('precios') }}>
              Comprar ahora
            </a>
          </div>
          <span className="landing-hero-note">Sin tarjeta de crédito</span>
        </div>
        <div className="landing-hero-visual">
          <img src="/img/hero-phone.png" alt="Monaco PRO - App en acción" className="landing-hero-img" />
        </div>
      </section>

      {/* Social Proof */}
      <section className="landing-proof">
        <div className="landing-proof-item">
          <TrendingUp size={20} />
          <span><strong>50+</strong> negocios en Colombia</span>
        </div>
        <div className="landing-proof-divider" />
        <div className="landing-proof-item">
          <Star size={20} />
          <span><strong>4.9</strong> satisfacción</span>
        </div>
        <div className="landing-proof-divider" />
        <div className="landing-proof-item">
          <Shield size={20} />
          <span><strong>100%</strong> en la nube</span>
        </div>
      </section>

      {/* How it Works */}
      <section className="landing-steps" id="como-funciona">
        <h2>Cómo funciona</h2>
        <p className="landing-section-subtitle">En 3 pasos tu negocio queda organizado</p>
        <div className="landing-steps-grid">
          <div className="landing-step-card landing-step-card--carousel">
            <div className="landing-step-carousel landing-step-carousel--5">
              <img src="/img/step-3.png" alt="Registro de lavada" className="landing-step-carousel-img" />
              <img src="/img/step-4.png" alt="Registro de lavada" className="landing-step-carousel-img" />
              <img src="/img/step-5.png" alt="Registro de lavada" className="landing-step-carousel-img" />
              <img src="/img/step-6.png" alt="Registro de lavada" className="landing-step-carousel-img" />
              <img src="/img/step-7.png" alt="Registro de lavada" className="landing-step-carousel-img" />
            </div>
            <h3>{steps[0].title}</h3>
            <p>{steps[0].desc}</p>
          </div>
          <div className="landing-step-card landing-step-card--carousel">
            <div className="landing-step-carousel landing-step-carousel--4">
              <img src="/img/step-8.png" alt="Control de estados" className="landing-step-carousel-img" />
              <img src="/img/step-9.png" alt="Control de pagos" className="landing-step-carousel-img" />
              <img src="/img/step-10.png" alt="Control de turnos" className="landing-step-carousel-img" />
              <img src="/img/step-11.png" alt="Control de clientes" className="landing-step-carousel-img" />
            </div>
            <h3>{steps[1].title}</h3>
            <p>{steps[1].desc}</p>
          </div>
          <div className="landing-step-card landing-step-card--carousel">
            <div className="landing-step-carousel landing-step-carousel--3">
              <img src="/img/step-18.jpg" alt="Reportes de ingresos" className="landing-step-carousel-img" />
              <img src="/img/step-19.jpg" alt="Balance del periodo" className="landing-step-carousel-img" />
              <img src="/img/step-20.jpg" alt="Métricas principales" className="landing-step-carousel-img" />
            </div>
            <h3>{steps[2].title}</h3>
            <p>{steps[2].desc}</p>
          </div>
        </div>
      </section>

      {/* Features Showcase */}
      <section className="landing-showcases" id="funciones">
        <h2>Todo lo que necesita tu negocio</h2>
        <p className="landing-section-subtitle">Las herramientas que te permiten manejar tu negocio sin estar ahí</p>
        {features.map((f, i) => (
          <div key={f.title} className={`landing-showcase ${i % 2 === 1 ? 'landing-showcase-reverse' : ''}`}>
            <div className="landing-showcase-text">
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
              <ul>
                {f.details.map((d) => (
                  <li key={d}><Check size={16} strokeWidth={2.5} /> {d}</li>
                ))}
              </ul>
            </div>
            <div className="landing-showcase-visual">
              {i === 0 ? (
                <EstadoMockup />
              ) : i === 1 ? (
                <PagoMockup />
              ) : (
                <BalanceMockup />
              )}
            </div>
          </div>
        ))}
      </section>

      {/* Pricing */}
      <section className="landing-pricing" id="precios">
        <h2>Elige tu plan</h2>
        <p className="landing-section-subtitle">Todo incluido. Sin costos ocultos.</p>
        <ul className="landing-plan-list">
          {planFeatures.map((feat) => (
            <li key={feat}>
              <Check size={18} strokeWidth={2.5} />
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
            <button className="landing-cta-primary landing-cta-primary-alt" onClick={() => setCheckoutPeriod('yearly')}>Comprar anual</button>
          </div>
        </div>
        <Link to="/registro" className="landing-pricing-free">
          Comienza con el plan gratuito →
        </Link>
      </section>

      {/* Testimonials */}
      <section className="landing-testimonials" id="testimonios">
        <h2>Negocios que ya usan Monaco PRO</h2>
        <p className="landing-section-subtitle">Dueños de negocios en Colombia que dejaron el cuaderno y las llamadas</p>
        <div className="landing-testimonials-grid">
          {testimonials.map((t) => (
            <div key={t.name} className="landing-testimonial-card">
              <div className="landing-testimonial-stars">
                {Array.from({ length: t.rating }, (_, j) => (
                  <Star key={j} size={14} fill="var(--accent-orange, #f59e0b)" stroke="var(--accent-orange, #f59e0b)" />
                ))}
              </div>
              <p>"{t.quote}"</p>
              <span className="landing-testimonial-author">— {t.name}, {t.city}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Final */}
      <section className="landing-cta-final">
        <h2>Empieza a controlar tu negocio hoy</h2>
        <p>Registra tu negocio en menos de 2 minutos. Sin tarjeta de crédito.</p>
        <div className="landing-hero-buttons">
          <Link to="/registro" className="landing-cta-primary">
            Comienza gratis
          </Link>
          <a href="#precios" className="landing-cta-secondary" onClick={(e) => { e.preventDefault(); scrollTo('precios') }}>
            Ver planes PRO
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-content">
          <div className="landing-footer-brand">
            <div className="landing-nav-logo">
              <span className="landing-logo-text">monaco</span>
              <span className="landing-logo-badge">PRO</span>
            </div>
            <p>El sistema para tu negocio que funciona sin ti.</p>
          </div>
          <div className="landing-footer-links">
            <a href="https://wa.me/573144016349" target="_blank" rel="noopener noreferrer">
              <MessageCircle size={16} /> WhatsApp
            </a>
          </div>
        </div>
        <div className="landing-footer-bottom">
          <p>&copy; 2026 Monaco PRO — Hecho en Colombia</p>
        </div>
      </footer>

      {/* Video Widget */}
      <VideoWidget />

      {/* Checkout Modal */}
      {checkoutPeriod && (
        <CheckoutModal
          period={checkoutPeriod}
          onClose={() => { setCheckoutPeriod(null); setInitialCheckoutId(null); setClaimMode(false) }}
          initialCheckoutId={initialCheckoutId}
          claimMode={claimMode}
        />
      )}
    </div>
  )
}
