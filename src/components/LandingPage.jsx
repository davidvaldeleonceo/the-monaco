import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Timer, Users, DollarSign, BarChart3, Check, MessageCircle,
  Crown, Star, ClipboardList, Eye, Bot, UserCog, ChevronRight,
  Smartphone, TrendingUp, Shield
} from 'lucide-react'
import CheckoutModal from './CheckoutModal'
import { API_URL } from '../config/constants'

const scrollTo = (id) => {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

const steps = [
  {
    icon: ClipboardList,
    number: '1',
    title: 'Registra lavadas',
    desc: 'Tu trabajador registra cada moto con un tap. Tú ves todo en tiempo real desde cualquier lugar.',
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
    desc: 'Ve qué motos están en espera, lavándose o listas para entregar. Desde tu celular, donde estés.',
    details: ['Estado de cada moto en vivo', 'Historial completo de turnos', 'Acceso desde cualquier dispositivo'],
    placeholder: 'Screenshot del Home mostrando turnos activos con estados: en espera (amarillo), lavando (azul), lista (verde)',
  },
  {
    icon: DollarSign,
    title: 'Pagos sin discusiones',
    desc: 'Cada lavada queda registrada. A fin de quincena, las cuentas salen solas. Sin peleas ni cuadernos.',
    details: ['Cálculo automático por trabajador', 'Balance en tiempo real', 'Historial de pagos completo'],
    placeholder: 'Screenshot de la sección Pagos con balance de un trabajador, lista de lavadas realizadas y total a pagar',
  },
  {
    icon: Users,
    title: 'Clientes que vuelven solos',
    desc: 'Membresías y descuentos para que tus clientes regresen sin que tengas que llamarlos.',
    details: ['Membresías con descuento automático', 'Historial por cliente', 'Clientes frecuentes identificados'],
    placeholder: 'Screenshot de Clientes con lista de clientes, membresías activas y etiqueta de cliente frecuente',
  },
  {
    icon: BarChart3,
    title: 'Números claros sin estar ahí',
    desc: 'Revisa cuánto entró, cuánto se gastó y cuánto queda. Gráficas claras, sin complicaciones.',
    details: ['Gráficas de ingresos vs gastos', 'Balance diario, semanal y mensual', 'Filtros por periodo'],
    placeholder: 'Screenshot de Reportes con gráfica de barras de ingresos, balance del periodo y métricas principales',
  },
  {
    icon: Bot,
    title: 'IA que entiende tu negocio',
    desc: 'Pregúntale a Monaco: ¿cómo voy hoy? ¿cuál es mi mejor lavador? ¿cuánto llevo esta semana?',
    details: ['Respuestas instantáneas sobre tu negocio', 'Entrada por voz o texto', 'Análisis y recomendaciones'],
    placeholder: 'Screenshot del chat de IA Monaco con una conversación preguntando "cómo voy hoy" y la respuesta con resumen del día',
  },
  {
    icon: UserCog,
    title: 'Cada quien ve lo que necesita',
    desc: 'Admin, trabajador o viewer. Configura roles para que cada persona acceda solo a lo suyo.',
    details: ['3 roles diferentes', 'Permisos por sección', 'Múltiples usuarios por negocio'],
    placeholder: 'Screenshot de Configuración mostrando la lista de usuarios del negocio con sus roles asignados',
  },
]

const planFeatures = [
  'Turnos y lavadas ilimitadas',
  'Clientes y membresías',
  'Pagos a trabajadores',
  'Reportes y balance',
  'IA Monaco incluida',
  'Múltiples usuarios y roles',
  'Acceso desde cualquier dispositivo',
  'Soporte por WhatsApp',
]

const testimonials = [
  {
    quote: 'Antes si no iba al lavadero un día, nadie sabía qué cobrar ni a quién. Ahora todo queda registrado solo.',
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
    quote: 'Mis clientes con membresía vuelven solos. El lavadero se paga solo desde que uso Monaco.',
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
        <div className="landing-nav-logo">
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
          <Link to="/registro" className="landing-nav-btn">Empezar gratis</Link>
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
          <h1>Tu lavadero funcionando bien, estés o no estés</h1>
          <p>Controla turnos, pagos y clientes desde el celular. Deja de ser el único que sabe cómo funciona tu negocio.</p>
          <div className="landing-hero-buttons">
            <Link to="/registro" className="landing-cta-primary">
              Prueba gratis 7 días <ChevronRight size={18} />
            </Link>
            <a href="#precios" className="landing-cta-secondary" onClick={(e) => { e.preventDefault(); scrollTo('precios') }}>
              Comprar ahora
            </a>
          </div>
          <span className="landing-hero-note">Sin tarjeta de crédito para la prueba</span>
        </div>
        <div className="landing-hero-visual">
          <div className="landing-phone-mockup">
            <div className="landing-phone-notch" />
            <div className="landing-phone-screen">
              <div className="landing-img-placeholder">
                <Smartphone size={32} />
                <span>Screenshot del Home de Monaco mostrando el dashboard con turnos activos, lavadas del día y balance general</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="landing-proof">
        <div className="landing-proof-item">
          <TrendingUp size={20} />
          <span><strong>50+</strong> lavaderos en Colombia</span>
        </div>
        <div className="landing-proof-divider" />
        <div className="landing-proof-item">
          <Star size={20} />
          <span><strong>4.9</strong> satisfacción</span>
        </div>
        <div className="landing-proof-divider" />
        <div className="landing-proof-item">
          <Shield size={20} />
          <span><strong>7 días</strong> gratis</span>
        </div>
      </section>

      {/* How it Works */}
      <section className="landing-steps" id="como-funciona">
        <h2>Cómo funciona</h2>
        <p className="landing-section-subtitle">En 3 pasos tu lavadero queda organizado</p>
        <div className="landing-steps-grid">
          {steps.map((s) => (
            <div key={s.number} className="landing-step-card">
              <div className="landing-step-number">{s.number}</div>
              <s.icon size={28} strokeWidth={1.5} />
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features Showcase */}
      <section className="landing-showcases" id="funciones">
        <h2>Todo lo que necesita tu lavadero</h2>
        <p className="landing-section-subtitle">Las herramientas que te permiten manejar tu negocio sin estar ahí</p>
        {features.map((f, i) => (
          <div key={f.title} className={`landing-showcase ${i % 2 === 1 ? 'landing-showcase-reverse' : ''}`}>
            <div className="landing-showcase-text">
              <div className="landing-showcase-icon-wrap">
                <f.icon size={24} strokeWidth={1.5} />
              </div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
              <ul>
                {f.details.map((d) => (
                  <li key={d}><Check size={16} strokeWidth={2.5} /> {d}</li>
                ))}
              </ul>
            </div>
            <div className="landing-showcase-visual">
              <div className="landing-img-placeholder">
                <Smartphone size={28} />
                <span>{f.placeholder}</span>
              </div>
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
        <Link to="/registro" className="landing-pricing-free">O prueba gratis 7 días — sin tarjeta</Link>
      </section>

      {/* Testimonials */}
      <section className="landing-testimonials" id="testimonios">
        <h2>Lavaderos que ya usan Monaco PRO</h2>
        <p className="landing-section-subtitle">Dueños de lavaderos en Colombia que dejaron el cuaderno y las llamadas</p>
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
        <h2>Empieza a controlar tu lavadero hoy</h2>
        <p>7 días gratis. Sin tarjeta. Cancela cuando quieras.</p>
        <div className="landing-hero-buttons">
          <Link to="/registro" className="landing-cta-primary">
            Empezar gratis <ChevronRight size={18} />
          </Link>
          <a href="#precios" className="landing-cta-secondary" onClick={(e) => { e.preventDefault(); scrollTo('precios') }}>
            Comprar ahora
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
            <p>El sistema para lavaderos que funciona sin ti.</p>
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
