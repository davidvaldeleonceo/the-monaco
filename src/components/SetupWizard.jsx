import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useTenant } from './TenantContext'
import { Sparkles, CircleCheck, Plus, X, ChevronLeft, Droplets, CreditCard, Users, Wrench, Crown, Check } from 'lucide-react'

const TOTAL_STEPS = 7
const STEP_ICONS = [Sparkles, Droplets, CreditCard, Users, Wrench, Crown, CircleCheck]

const LAVADO_COMPONENTS = ['Lavado básico', 'Kit de arrastre', 'Cera', 'Restaurador de partes negras']
const MEMBRESIA_BENEFITS = ['Lavado gratis', 'Descuento en servicios', 'Descuento en adicionales']
const DEFAULT_LAVADOS = [
  { nombre: 'BÁSICO', precio: 0, incluye: ['Lavado básico'], _status: 'new', _tempId: 'def-1' },
  { nombre: 'LAVADO CON KIT DE ARRASTRE', precio: 0, incluye: ['Lavado básico', 'Kit de arrastre'], _status: 'new', _tempId: 'def-2' },
  { nombre: 'LAVADO FULL', precio: 0, incluye: ['Lavado básico', 'Kit de arrastre', 'Cera', 'Restaurador de partes negras'], _status: 'new', _tempId: 'def-3' },
]

// Format number with dot thousands separator (es-CO)
function formatPriceCO(val) {
  if (!val) return ''
  return Number(val).toLocaleString('es-CO')
}

// Parse formatted price string back to number
function parsePriceInput(str) {
  const raw = str.replace(/\./g, '').replace(/[^0-9]/g, '')
  return raw === '' ? 0 : parseInt(raw, 10)
}

function PriceInput({ value, onChange, placeholder = "0", onKeyDown }) {
  const display = value ? formatPriceCO(value) : ''
  return (
    <div className="setup-price-input">
      <span>$</span>
      <input
        type="text"
        inputMode="numeric"
        value={display}
        onChange={(e) => onChange(parsePriceInput(e.target.value))}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
      />
    </div>
  )
}

function StepIndicator({ step }) {
  const steps = [1, 2, 3, 4, 5]
  return (
    <div className="setup-step-indicator">
      {steps.map((s, i) => {
        const Icon = STEP_ICONS[s]
        const isCompleted = step > s
        const isCurrent = step === s
        return (
          <div key={s} className="setup-dot-group">
            {i > 0 && <div className={`setup-dot-line ${step > s ? 'completed' : ''}`} />}
            <div className={`setup-dot ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}>
              {isCompleted ? <Check size={14} /> : <Icon size={14} />}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StepHeader({ step, title, subtitle }) {
  const Icon = STEP_ICONS[step]
  return (
    <div className="setup-step-header">
      <div className="setup-step-icon-circle">
        <Icon size={24} />
      </div>
      <h1>{title}</h1>
      <p className="subtitle">{subtitle}</p>
    </div>
  )
}

export default function SetupWizard() {
  const { negocioNombre, markSetupDone } = useTenant()
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState('forward')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Seeded data loaded from DB
  const [tiposLavado, setTiposLavado] = useState([])
  const [metodosPago, setMetodosPago] = useState([])
  const [serviciosAdicionales, setServiciosAdicionales] = useState([])
  const [tiposMembresia, setTiposMembresia] = useState([])

  // Local working copies
  const [localLavados, setLocalLavados] = useState([])
  const [localMetodos, setLocalMetodos] = useState([])
  const [localTrabajadores, setLocalTrabajadores] = useState([])
  const [localAdicionales, setLocalAdicionales] = useState([])
  const [localMembresias, setLocalMembresias] = useState([])

  // Track which steps were modified
  const [dirty, setDirty] = useState({})

  // Input states
  const [newLavadoNombre, setNewLavadoNombre] = useState('')
  const [newMetodo, setNewMetodo] = useState('')
  const [newTrabajador, setNewTrabajador] = useState('')
  const [newAdicionalNombre, setNewAdicionalNombre] = useState('')
  const [newAdicionalPrecio, setNewAdicionalPrecio] = useState(0)
  const [newMembresiaNombre, setNewMembresiaNombre] = useState('')
  const [newMembresiaPrecio, setNewMembresiaPrecio] = useState(0)
  const [newMembresiaDuracion, setNewMembresiaDuracion] = useState('')

  // Fetch seeded data on mount
  useEffect(() => {
    async function fetchData() {
      const [lavados, metodos, adicionales, membresias] = await Promise.all([
        supabase.from('tipos_lavado').select('*').eq('activo', true),
        supabase.from('metodos_pago').select('*').eq('activo', true),
        supabase.from('servicios_adicionales').select('*').eq('activo', true),
        supabase.from('tipos_membresia').select('*').eq('activo', true),
      ])
      const lav = lavados.data || []
      const met = metodos.data || []
      const adi = adicionales.data || []
      const mem = membresias.data || []

      setTiposLavado(lav)
      setMetodosPago(met)
      setServiciosAdicionales(adi)
      setTiposMembresia(mem)

      if (lav.length === 0) {
        setLocalLavados(DEFAULT_LAVADOS.map(d => ({ ...d })))
        setDirty(prev => ({ ...prev, lavados: true }))
      } else {
        setLocalLavados(lav.map(l => ({ ...l, _status: 'existing', incluye: [] })))
      }

      // Replace TRANSFERENCIA with BRE-B (starts unselected)
      const hasTransferencia = met.some(m => m.nombre.toUpperCase() === 'TRANSFERENCIA')
      const processedMet = met.map(m => {
        if (m.nombre.toUpperCase() === 'TRANSFERENCIA') {
          return { ...m, _status: 'existing', _active: false, _hidden: true }
        }
        return { ...m, _status: 'existing', _active: true }
      })
      if (hasTransferencia) {
        processedMet.push({ _status: 'new', _tempId: 'breb', nombre: 'BRE-B', _active: false })
      }
      setLocalMetodos(processedMet)
      setLocalAdicionales(adi.map(a => ({ ...a, _status: 'existing' })))
      // Default: single "MENSUAL" membership — replace seeded ones
      const defaultMembresia = {
        _status: 'new',
        _tempId: 'default-mensual',
        nombre: 'MENSUAL',
        precio: 50000,
        duracion_dias: 1,
        beneficios: ['Lavado gratis'],
      }
      setLocalMembresias([
        ...mem.map(m => ({ ...m, _status: 'deleted' })),
        defaultMembresia,
      ])
      if (mem.length > 0) setDirty(prev => ({ ...prev, membresias: true }))
    }
    fetchData()
  }, [])

  const markDirty = (stepName) => {
    setDirty(prev => ({ ...prev, [stepName]: true }))
  }

  const progress = (step / (TOTAL_STEPS - 1)) * 100

  // --- Step navigation ---
  const next = () => {
    setDirection('forward')
    setStep(s => Math.min(s + 1, TOTAL_STEPS - 1))
  }
  const back = () => {
    setDirection('backward')
    setStep(s => Math.max(s - 1, 0))
  }

  // --- Save all changes ---
  const saveAll = async () => {
    setSaving(true)
    setError(null)
    try {
      // Lavados
      if (dirty.lavados) {
        for (const l of localLavados) {
          if (l._status === 'new') {
            await supabase.from('tipos_lavado').insert({ nombre: l.nombre, precio: l.precio })
          } else if (l._status === 'edited') {
            await supabase.from('tipos_lavado').update({ precio: l.precio }).eq('id', l.id)
          } else if (l._status === 'deleted') {
            await supabase.from('tipos_lavado').update({ activo: false }).eq('id', l.id)
          }
        }
      }

      // Metodos de pago
      if (dirty.metodos) {
        for (const m of localMetodos) {
          if (m._status === 'new' && m._active) {
            await supabase.from('metodos_pago').insert({ nombre: m.nombre })
          } else if (m._status === 'existing' && !m._active) {
            await supabase.from('metodos_pago').update({ activo: false }).eq('id', m.id)
          }
        }
      }

      // Trabajadores
      if (dirty.trabajadores && localTrabajadores.length > 0) {
        for (const t of localTrabajadores) {
          await supabase.from('lavadores').insert({ nombre: t.nombre })
        }
      }

      // Servicios adicionales
      if (dirty.adicionales) {
        for (const a of localAdicionales) {
          if (a._status === 'new') {
            await supabase.from('servicios_adicionales').insert({ nombre: a.nombre, precio: a.precio })
          } else if (a._status === 'edited') {
            await supabase.from('servicios_adicionales').update({ nombre: a.nombre, precio: a.precio }).eq('id', a.id)
          } else if (a._status === 'deleted') {
            await supabase.from('servicios_adicionales').update({ activo: false }).eq('id', a.id)
          }
        }
      }

      // Membresias
      if (dirty.membresias) {
        for (const m of localMembresias) {
          if (m._status === 'new') {
            await supabase.from('tipos_membresia').insert({ nombre: m.nombre, precio: m.precio, duracion_dias: m.duracion_dias })
          } else if (m._status === 'edited') {
            await supabase.from('tipos_membresia').update({ nombre: m.nombre, precio: m.precio, duracion_dias: m.duracion_dias }).eq('id', m.id)
          } else if (m._status === 'deleted') {
            await supabase.from('tipos_membresia').update({ activo: false }).eq('id', m.id)
          }
        }
      }

      // Mark setup complete
      await supabase.rpc('complete_setup')
      markSetupDone()
    } catch (err) {
      setError('Error guardando configuración. Intenta de nuevo.')
      setSaving(false)
    }
  }

  // --- Render step content ---
  const renderStepContent = () => {
    // STEP 0: Welcome
    if (step === 0) {
      return (
        <>
          <Sparkles size={56} className="setup-icon" />
          <h1>Tu lavadero está casi listo!</h1>
          <p className="subtitle">Configuremos lo esencial en menos de 2 minutos. Puedes omitir cualquier paso.</p>
          <div className="setup-actions">
            <button className="setup-btn-primary" onClick={next}>Comenzar</button>
          </div>
        </>
      )
    }

    // STEP 1: Tipos de lavado
    if (step === 1) {
      const visibleLavados = localLavados.filter(l => l._status !== 'deleted')
      const getKey = (l) => l.id || l._tempId

      const addLavado = () => {
        if (!newLavadoNombre.trim()) return
        setLocalLavados(prev => [...prev, {
          _status: 'new',
          _tempId: Date.now(),
          nombre: newLavadoNombre.trim().toUpperCase(),
          precio: 0,
          incluye: [],
        }])
        setNewLavadoNombre('')
        markDirty('lavados')
      }

      const updateLavadoPrecio = (key, precio) => {
        setLocalLavados(prev => prev.map(l => {
          if (getKey(l) !== key || l._status === 'deleted') return l
          return { ...l, precio, _status: l._status === 'new' ? 'new' : 'edited' }
        }))
        markDirty('lavados')
      }

      const updateLavadoNombre = (key, nombre) => {
        setLocalLavados(prev => prev.map(l => {
          if (getKey(l) !== key || l._status === 'deleted') return l
          return { ...l, nombre, _status: l._status === 'new' ? 'new' : 'edited' }
        }))
        markDirty('lavados')
      }

      const toggleInclude = (key, component) => {
        setLocalLavados(prev => prev.map(l => {
          if (getKey(l) !== key || l._status === 'deleted') return l
          const incluye = l.incluye || []
          const newIncluye = incluye.includes(component)
            ? incluye.filter(c => c !== component)
            : [...incluye, component]
          return { ...l, incluye: newIncluye, _status: l._status === 'new' ? 'new' : 'edited' }
        }))
        markDirty('lavados')
      }

      const removeLavado = (key) => {
        setLocalLavados(prev => prev.map(l => {
          if (getKey(l) !== key) return l
          return { ...l, _status: 'deleted' }
        }))
        markDirty('lavados')
      }

      return (
        <>
          <button className="setup-btn-back" onClick={back}><ChevronLeft size={16} /> Volver</button>
          <StepHeader step={1} title="Servicios de lavado" subtitle="Configura tus servicios, selecciona qué incluye cada uno y asigna el precio." />

          <div className="setup-lavado-list">
            {visibleLavados.map(l => {
              const key = getKey(l)
              return (
                <div key={key} className="setup-lavado-card">
                  <div className="setup-lavado-top">
                    <input
                      type="text"
                      className="setup-inline-input"
                      value={l.nombre}
                      onChange={(e) => updateLavadoNombre(key, e.target.value)}
                    />
                    <div className="setup-list-item-actions">
                      <PriceInput value={l.precio} onChange={(val) => updateLavadoPrecio(key, val)} />
                      <button className="setup-remove-btn" onClick={() => removeLavado(key)}>
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="setup-lavado-includes">
                    <span className="setup-includes-label">Incluye:</span>
                    <div className="setup-includes-pills">
                      {LAVADO_COMPONENTS.map(comp => (
                        <button
                          key={comp}
                          className={`setup-include-pill ${(l.incluye || []).includes(comp) ? 'active' : ''}`}
                          onClick={() => toggleInclude(key, comp)}
                        >
                          {comp}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="setup-add-row">
            <input
              type="text"
              placeholder="Nombre del servicio"
              value={newLavadoNombre}
              onChange={(e) => setNewLavadoNombre(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addLavado()}
            />
            <button className="setup-add-btn-inline" onClick={addLavado}><Plus size={18} /></button>
          </div>

          <div className="setup-actions">
            <button className="setup-btn-secondary" onClick={next}>Omitir</button>
            <button className="setup-btn-primary" onClick={next}>Siguiente</button>
          </div>
        </>
      )
    }

    // STEP 2: Métodos de pago
    if (step === 2) {
      const visibleMetodos = localMetodos.filter(m => !m._hidden)

      const toggleMetodo = (key) => {
        setLocalMetodos(prev => prev.map(m => {
          if ((m.id || m._tempId) !== key) return m
          return { ...m, _active: !m._active }
        }))
        markDirty('metodos')
      }

      const addMetodo = () => {
        if (!newMetodo.trim()) return
        setLocalMetodos(prev => [...prev, {
          _status: 'new',
          _tempId: Date.now(),
          nombre: newMetodo.trim().toUpperCase(),
          _active: true,
        }])
        setNewMetodo('')
        markDirty('metodos')
      }

      const activeCount = visibleMetodos.filter(m => m._active).length

      const handleNext = () => {
        if (activeCount < 1) return
        next()
      }

      return (
        <>
          <button className="setup-btn-back" onClick={back}><ChevronLeft size={16} /> Volver</button>
          <StepHeader step={2} title="Métodos de pago" subtitle="Selecciona cómo te pagan tus clientes." />

          <div className="setup-chips">
            {visibleMetodos.map(m => {
              const key = m.id || m._tempId
              return (
                <button
                  key={key}
                  className={`setup-chip ${m._active ? 'active' : ''}`}
                  onClick={() => toggleMetodo(key)}
                >
                  {m.nombre}
                </button>
              )
            })}
          </div>

          <div className="setup-add-row">
            <input
              type="text"
              placeholder="Agregar método personalizado"
              value={newMetodo}
              onChange={(e) => setNewMetodo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addMetodo()}
            />
            <button className="setup-add-btn-inline" onClick={addMetodo}><Plus size={18} /></button>
          </div>

          {activeCount < 1 && <p className="setup-error">Debes tener al menos 1 método de pago activo.</p>}

          <div className="setup-actions">
            <button className="setup-btn-primary" onClick={handleNext} disabled={activeCount < 1}>Siguiente</button>
          </div>
        </>
      )
    }

    // STEP 3: Trabajadores
    if (step === 3) {
      const addTrabajador = () => {
        if (!newTrabajador.trim()) return
        setLocalTrabajadores(prev => [...prev, { nombre: newTrabajador.trim(), _tempId: Date.now() }])
        setNewTrabajador('')
        markDirty('trabajadores')
      }

      const removeTrabajador = (tempId) => {
        setLocalTrabajadores(prev => prev.filter(t => t._tempId !== tempId))
        markDirty('trabajadores')
      }

      return (
        <>
          <button className="setup-btn-back" onClick={back}><ChevronLeft size={16} /> Volver</button>
          <StepHeader step={3} title="Trabajadores" subtitle="Agrega quiénes trabajan en tu lavadero. Podrás configurar sus pagos después en Configuración." />

          <div className="setup-chips">
            {localTrabajadores.map(t => (
              <span key={t._tempId} className="setup-chip active">
                {t.nombre}
                <button className="setup-chip-remove" onClick={() => removeTrabajador(t._tempId)}>
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>

          <div className="setup-add-row">
            <input
              type="text"
              placeholder="Nombre del trabajador"
              value={newTrabajador}
              onChange={(e) => setNewTrabajador(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTrabajador()}
            />
            <button className="setup-add-btn-inline" onClick={addTrabajador}><Plus size={18} /></button>
          </div>

          <div className="setup-actions">
            <button className="setup-btn-secondary" onClick={next}>Omitir</button>
            <button className="setup-btn-primary" onClick={next}>Siguiente</button>
          </div>
        </>
      )
    }

    // STEP 4: Servicios adicionales
    if (step === 4) {
      const visibleAdicionales = localAdicionales.filter(a => a._status !== 'deleted')
      const getKey = (a) => a.id || a._tempId

      const addAdicional = () => {
        if (!newAdicionalNombre.trim()) return
        setLocalAdicionales(prev => [...prev, {
          _status: 'new',
          _tempId: Date.now(),
          nombre: newAdicionalNombre.trim(),
          precio: newAdicionalPrecio,
        }])
        setNewAdicionalNombre('')
        setNewAdicionalPrecio(0)
        markDirty('adicionales')
      }

      const updateAdicional = (key, field, value) => {
        setLocalAdicionales(prev => prev.map(a => {
          if (getKey(a) !== key || a._status === 'deleted') return a
          return { ...a, [field]: value, _status: a._status === 'new' ? 'new' : 'edited' }
        }))
        markDirty('adicionales')
      }

      const removeAdicional = (key) => {
        setLocalAdicionales(prev => prev.map(a => {
          if (getKey(a) !== key) return a
          return { ...a, _status: 'deleted' }
        }))
        markDirty('adicionales')
      }

      return (
        <>
          <button className="setup-btn-back" onClick={back}><ChevronLeft size={16} /> Volver</button>
          <StepHeader step={4} title="Servicios adicionales" subtitle="Estos precios aplican solo cuando el servicio no está incluido en el lavado. Puedes modificarlos después en Configuración." />

          <div className="setup-list">
            {visibleAdicionales.map(a => {
              const key = getKey(a)
              return (
                <div key={key} className="setup-list-item">
                  <div className="setup-list-item-info">
                    <input
                      type="text"
                      className="setup-inline-input"
                      value={a.nombre}
                      onChange={(e) => updateAdicional(key, 'nombre', e.target.value)}
                    />
                  </div>
                  <div className="setup-list-item-actions">
                    <PriceInput value={a.precio} onChange={(val) => updateAdicional(key, 'precio', val)} />
                    <button className="setup-remove-btn" onClick={() => removeAdicional(key)}>
                      <X size={16} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="setup-add-row">
            <input
              type="text"
              placeholder="Nombre del servicio"
              value={newAdicionalNombre}
              onChange={(e) => setNewAdicionalNombre(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addAdicional()}
            />
            <PriceInput
              value={newAdicionalPrecio}
              onChange={setNewAdicionalPrecio}
              placeholder="Precio"
              onKeyDown={(e) => e.key === 'Enter' && addAdicional()}
            />
            <button className="setup-add-btn-inline" onClick={addAdicional}><Plus size={18} /></button>
          </div>

          <div className="setup-actions">
            <button className="setup-btn-secondary" onClick={next}>Omitir</button>
            <button className="setup-btn-primary" onClick={next}>Siguiente</button>
          </div>
        </>
      )
    }

    // STEP 5: Membresías
    if (step === 5) {
      const visibleMembresias = localMembresias.filter(m => m._status !== 'deleted')
      const getKey = (m) => m.id || m._tempId

      const addMembresia = () => {
        if (!newMembresiaNombre.trim()) return
        setLocalMembresias(prev => [...prev, {
          _status: 'new',
          _tempId: Date.now(),
          nombre: newMembresiaNombre.trim().toUpperCase(),
          precio: newMembresiaPrecio,
          duracion_dias: Number(newMembresiaDuracion) || 1,
          beneficios: [],
        }])
        setNewMembresiaNombre('')
        setNewMembresiaPrecio(0)
        setNewMembresiaDuracion('')
        markDirty('membresias')
      }

      const updateMembresia = (key, field, value) => {
        setLocalMembresias(prev => prev.map(m => {
          if (getKey(m) !== key || m._status === 'deleted') return m
          const val = field === 'duracion_dias' ? (Number(value) || 0) : value
          return { ...m, [field]: val, _status: m._status === 'new' ? 'new' : 'edited' }
        }))
        markDirty('membresias')
      }

      const toggleBeneficio = (key, beneficio) => {
        setLocalMembresias(prev => prev.map(m => {
          if (getKey(m) !== key || m._status === 'deleted') return m
          const beneficios = m.beneficios || []
          const newBeneficios = beneficios.includes(beneficio)
            ? beneficios.filter(b => b !== beneficio)
            : [...beneficios, beneficio]
          return { ...m, beneficios: newBeneficios, _status: m._status === 'new' ? 'new' : 'edited' }
        }))
        markDirty('membresias')
      }

      const removeMembresia = (key) => {
        setLocalMembresias(prev => prev.map(m => {
          if (getKey(m) !== key) return m
          return { ...m, _status: 'deleted' }
        }))
        markDirty('membresias')
      }

      return (
        <>
          <button className="setup-btn-back" onClick={back}><ChevronLeft size={16} /> Volver</button>
          <StepHeader step={5} title="Membresías" subtitle="Si ofreces planes de membresía, este es el momento de agregarlos. Si no, puedes omitir este paso." />

          <div className="setup-info-note">
            Los clientes con membresía activa tendrán precio $0 en todos los servicios automáticamente.
          </div>

          <div className="setup-lavado-list">
            {visibleMembresias.map(m => {
              const key = getKey(m)
              return (
                <div key={key} className="setup-membresia-card">
                  <div className="setup-lavado-top">
                    <input
                      type="text"
                      className="setup-inline-input"
                      value={m.nombre}
                      onChange={(e) => updateMembresia(key, 'nombre', e.target.value)}
                    />
                    <div className="setup-list-item-actions">
                      <PriceInput value={m.precio} onChange={(val) => updateMembresia(key, 'precio', val)} />
                      <div className="setup-duration-input">
                        <input
                          type="number"
                          value={m.duracion_dias}
                          onChange={(e) => updateMembresia(key, 'duracion_dias', e.target.value)}
                          min="1"
                          placeholder="Meses"
                        />
                        <span>meses</span>
                      </div>
                      <button className="setup-remove-btn" onClick={() => removeMembresia(key)}>
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="setup-lavado-includes">
                    <span className="setup-includes-label">Beneficios:</span>
                    <div className="setup-includes-pills">
                      {MEMBRESIA_BENEFITS.map(ben => (
                        <button
                          key={ben}
                          className={`setup-include-pill ${(m.beneficios || []).includes(ben) ? 'active' : ''}`}
                          onClick={() => toggleBeneficio(key, ben)}
                        >
                          {ben}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="setup-add-row">
            <input
              type="text"
              placeholder="Nombre"
              value={newMembresiaNombre}
              onChange={(e) => setNewMembresiaNombre(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addMembresia()}
            />
            <PriceInput
              value={newMembresiaPrecio}
              onChange={setNewMembresiaPrecio}
              placeholder="Precio"
              onKeyDown={(e) => e.key === 'Enter' && addMembresia()}
            />
            <div className="setup-duration-input">
              <input
                type="number"
                placeholder="Meses"
                value={newMembresiaDuracion}
                onChange={(e) => setNewMembresiaDuracion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addMembresia()}
                min="1"
              />
            </div>
            <button className="setup-add-btn-inline" onClick={addMembresia}><Plus size={18} /></button>
          </div>

          <div className="setup-actions">
            <button className="setup-btn-secondary" onClick={next}>Omitir</button>
            <button className="setup-btn-primary" onClick={next}>Siguiente</button>
          </div>
        </>
      )
    }

    // STEP 6: Done!
    if (step === 6) {
      const lavadosCount = localLavados.filter(l => l._status !== 'deleted').length
      const metodosCount = localMetodos.filter(m => m._active).length
      const trabajadoresCount = localTrabajadores.length
      const adicionalesCount = localAdicionales.filter(a => a._status !== 'deleted').length
      const membresiasCount = localMembresias.filter(m => m._status !== 'deleted').length

      return (
        <>
          <CircleCheck size={56} className="setup-icon setup-icon-success" />
          <h1>Todo listo!</h1>
          <p className="subtitle">Tu lavadero {negocioNombre} está configurado.</p>

          <div className="setup-summary">
            <div className="setup-summary-item"><CircleCheck size={18} /> {lavadosCount} servicios de lavado</div>
            <div className="setup-summary-item"><CircleCheck size={18} /> {metodosCount} métodos de pago</div>
            <div className="setup-summary-item"><CircleCheck size={18} /> {trabajadoresCount} trabajador{trabajadoresCount !== 1 ? 'es' : ''}</div>
            <div className="setup-summary-item"><CircleCheck size={18} /> {adicionalesCount} servicios adicionales</div>
            <div className="setup-summary-item"><CircleCheck size={18} /> {membresiasCount} membresías</div>
          </div>

          <p className="subtitle">Puedes modificar todo en Configuración cuando quieras.</p>

          {error && <p className="setup-error">{error}</p>}

          <div className="setup-actions">
            <button className="setup-btn-back" onClick={back}><ChevronLeft size={16} /> Volver</button>
            <button className="setup-btn-primary" onClick={saveAll} disabled={saving}>
              {saving ? 'Guardando...' : 'Ir a mi lavadero'}
            </button>
          </div>
        </>
      )
    }

    return null
  }

  return (
    <div className="setup-wizard">
      <div className="setup-progress-track">
        <div className="setup-progress-fill" style={{ width: `${progress}%` }} />
      </div>
      {step >= 1 && step <= 5 && <StepIndicator step={step} />}
      <div
        key={step}
        className={`setup-step ${direction === 'forward' ? 'slide-in-left' : 'slide-in-right'} ${(step === 0 || step === 6) ? 'setup-step-center' : ''}`}
      >
        {renderStepContent()}
      </div>
    </div>
  )
}
