import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useTenant } from './TenantContext'
import { Sparkles, CircleCheck, Plus, X, ChevronLeft } from 'lucide-react'

const PROTECTED_LAVADO_NAMES = ['sin membresia', 'sin membresía', 'membresia', 'membresía']
const PROTECTED_MEMBRESIA_NAME = 'sin membresia'
const TOTAL_STEPS = 7

function isProtectedLavado(nombre) {
  return PROTECTED_LAVADO_NAMES.includes(nombre.toLowerCase().trim())
}

function isProtectedMembresia(nombre) {
  return nombre.toLowerCase().trim() === PROTECTED_MEMBRESIA_NAME
}

export default function SetupWizard() {
  const { negocioNombre, markSetupDone } = useTenant()
  const [step, setStep] = useState(0)
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
  const [newLavadoPrecio, setNewLavadoPrecio] = useState('')
  const [newMetodo, setNewMetodo] = useState('')
  const [newTrabajador, setNewTrabajador] = useState('')
  const [newAdicionalNombre, setNewAdicionalNombre] = useState('')
  const [newAdicionalPrecio, setNewAdicionalPrecio] = useState('')
  const [newMembresiaNombre, setNewMembresiaNombre] = useState('')
  const [newMembresiaPrecio, setNewMembresiaPrecio] = useState('')
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

      setLocalLavados(lav.map(l => ({ ...l, _status: 'existing' })))
      setLocalMetodos(met.map(m => ({ ...m, _status: 'existing', _active: true })))
      setLocalAdicionales(adi.map(a => ({ ...a, _status: 'existing' })))
      setLocalMembresias(mem.map(m => ({ ...m, _status: 'existing' })))
    }
    fetchData()
  }, [])

  const markDirty = (stepName) => {
    setDirty(prev => ({ ...prev, [stepName]: true }))
  }

  const progress = (step / (TOTAL_STEPS - 1)) * 100

  // --- Step navigation ---
  const next = () => setStep(s => Math.min(s + 1, TOTAL_STEPS - 1))
  const back = () => setStep(s => Math.max(s - 1, 0))

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

  // --- Helpers ---
  const formatPrice = (v) => {
    const n = Number(v)
    return isNaN(n) ? '$0' : '$' + n.toLocaleString('es-CO')
  }

  // ============================================================
  // STEP 0: Welcome
  // ============================================================
  if (step === 0) {
    return (
      <div className="setup-wizard">
        <div className="setup-progress" style={{ width: `${progress}%` }} />
        <div className="setup-step setup-step-center">
          <Sparkles size={56} className="setup-icon" />
          <h1>Tu lavadero está casi listo!</h1>
          <p className="subtitle">Configuremos lo esencial en menos de 2 minutos. Puedes omitir cualquier paso.</p>
          <div className="setup-actions">
            <button className="setup-btn-primary" onClick={next}>Comenzar</button>
          </div>
        </div>
      </div>
    )
  }

  // ============================================================
  // STEP 1: Tipos de lavado
  // ============================================================
  if (step === 1) {
    const visibleLavados = localLavados.filter(l => l._status !== 'deleted')

    const addLavado = () => {
      if (!newLavadoNombre.trim()) return
      setLocalLavados(prev => [...prev, {
        _status: 'new',
        _tempId: Date.now(),
        nombre: newLavadoNombre.trim().toUpperCase(),
        precio: Number(newLavadoPrecio) || 0,
      }])
      setNewLavadoNombre('')
      setNewLavadoPrecio('')
      markDirty('lavados')
    }

    const updateLavadoPrecio = (index, precio) => {
      setLocalLavados(prev => prev.map((l, i) => {
        if (i !== index) return l
        const status = l._status === 'new' ? 'new' : 'edited'
        return { ...l, precio: Number(precio) || 0, _status: status }
      }))
      markDirty('lavados')
    }

    const removeLavado = (index) => {
      setLocalLavados(prev => prev.map((l, i) => {
        if (i !== index) return l
        if (l._status === 'new') return { ...l, _status: 'deleted' }
        return { ...l, _status: 'deleted' }
      }))
      markDirty('lavados')
    }

    return (
      <div className="setup-wizard">
        <div className="setup-progress" style={{ width: `${progress}%` }} />
        <div className="setup-step">
          <button className="setup-btn-back" onClick={back}><ChevronLeft size={16} /> Volver</button>
          <h1>Servicios de lavado</h1>
          <p className="subtitle">Estos son tus servicios por defecto. Puedes editar precios o agregar nuevos.</p>

          <div className="setup-list">
            {visibleLavados.map((l, i) => {
              const prot = isProtectedLavado(l.nombre)
              return (
                <div key={l.id || l._tempId} className={`setup-list-item ${prot ? 'protected' : ''}`}>
                  <div className="setup-list-item-info">
                    <span className="setup-list-item-name">
                      {l.nombre}
                      {prot && <span className="setup-badge">Requerido</span>}
                    </span>
                  </div>
                  <div className="setup-list-item-actions">
                    <div className="setup-price-input">
                      <span>$</span>
                      <input
                        type="number"
                        value={l.precio}
                        onChange={(e) => updateLavadoPrecio(i, e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    {!prot && (
                      <button className="setup-remove-btn" onClick={() => removeLavado(i)}>
                        <X size={16} />
                      </button>
                    )}
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
            <div className="setup-price-input">
              <span>$</span>
              <input
                type="number"
                placeholder="Precio"
                value={newLavadoPrecio}
                onChange={(e) => setNewLavadoPrecio(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addLavado()}
              />
            </div>
            <button className="setup-add-btn-inline" onClick={addLavado}><Plus size={18} /></button>
          </div>

          <div className="setup-actions">
            <button className="setup-btn-secondary" onClick={next}>Omitir</button>
            <button className="setup-btn-primary" onClick={next}>Siguiente</button>
          </div>
        </div>
      </div>
    )
  }

  // ============================================================
  // STEP 2: Métodos de pago
  // ============================================================
  if (step === 2) {
    const toggleMetodo = (index) => {
      setLocalMetodos(prev => prev.map((m, i) => {
        if (i !== index) return m
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

    const activeCount = localMetodos.filter(m => m._active).length

    const handleNext = () => {
      if (activeCount < 1) return
      next()
    }

    return (
      <div className="setup-wizard">
        <div className="setup-progress" style={{ width: `${progress}%` }} />
        <div className="setup-step">
          <button className="setup-btn-back" onClick={back}><ChevronLeft size={16} /> Volver</button>
          <h1>Métodos de pago</h1>
          <p className="subtitle">Selecciona cómo te pagan tus clientes.</p>

          <div className="setup-chips">
            {localMetodos.map((m, i) => (
              <button
                key={m.id || m._tempId}
                className={`setup-chip ${m._active ? 'active' : ''}`}
                onClick={() => toggleMetodo(i)}
              >
                {m.nombre}
              </button>
            ))}
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
            <button className="setup-btn-secondary" onClick={next}>Omitir</button>
            <button className="setup-btn-primary" onClick={handleNext} disabled={activeCount < 1}>Siguiente</button>
          </div>
        </div>
      </div>
    )
  }

  // ============================================================
  // STEP 3: Trabajadores
  // ============================================================
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
      <div className="setup-wizard">
        <div className="setup-progress" style={{ width: `${progress}%` }} />
        <div className="setup-step">
          <button className="setup-btn-back" onClick={back}><ChevronLeft size={16} /> Volver</button>
          <h1>Trabajadores</h1>
          <p className="subtitle">Agrega quiénes trabajan en tu lavadero. Podrás configurar sus pagos después en Configuración.</p>

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
        </div>
      </div>
    )
  }

  // ============================================================
  // STEP 4: Servicios adicionales
  // ============================================================
  if (step === 4) {
    const visibleAdicionales = localAdicionales.filter(a => a._status !== 'deleted')

    const addAdicional = () => {
      if (!newAdicionalNombre.trim()) return
      setLocalAdicionales(prev => [...prev, {
        _status: 'new',
        _tempId: Date.now(),
        nombre: newAdicionalNombre.trim(),
        precio: Number(newAdicionalPrecio) || 0,
      }])
      setNewAdicionalNombre('')
      setNewAdicionalPrecio('')
      markDirty('adicionales')
    }

    const updateAdicional = (index, field, value) => {
      setLocalAdicionales(prev => prev.map((a, i) => {
        if (i !== index) return a
        const status = a._status === 'new' ? 'new' : 'edited'
        return { ...a, [field]: field === 'precio' ? (Number(value) || 0) : value, _status: status }
      }))
      markDirty('adicionales')
    }

    const removeAdicional = (index) => {
      setLocalAdicionales(prev => prev.map((a, i) => {
        if (i !== index) return a
        return { ...a, _status: 'deleted' }
      }))
      markDirty('adicionales')
    }

    return (
      <div className="setup-wizard">
        <div className="setup-progress" style={{ width: `${progress}%` }} />
        <div className="setup-step">
          <button className="setup-btn-back" onClick={back}><ChevronLeft size={16} /> Volver</button>
          <h1>Servicios adicionales</h1>
          <p className="subtitle">Servicios extra que puedes ofrecer con cada lavada.</p>

          <div className="setup-list">
            {visibleAdicionales.map((a, i) => (
              <div key={a.id || a._tempId} className="setup-list-item">
                <div className="setup-list-item-info">
                  <input
                    type="text"
                    className="setup-inline-input"
                    value={a.nombre}
                    onChange={(e) => updateAdicional(i, 'nombre', e.target.value)}
                  />
                </div>
                <div className="setup-list-item-actions">
                  <div className="setup-price-input">
                    <span>$</span>
                    <input
                      type="number"
                      value={a.precio}
                      onChange={(e) => updateAdicional(i, 'precio', e.target.value)}
                    />
                  </div>
                  <button className="setup-remove-btn" onClick={() => removeAdicional(i)}>
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="setup-add-row">
            <input
              type="text"
              placeholder="Nombre del servicio"
              value={newAdicionalNombre}
              onChange={(e) => setNewAdicionalNombre(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addAdicional()}
            />
            <div className="setup-price-input">
              <span>$</span>
              <input
                type="number"
                placeholder="Precio"
                value={newAdicionalPrecio}
                onChange={(e) => setNewAdicionalPrecio(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addAdicional()}
              />
            </div>
            <button className="setup-add-btn-inline" onClick={addAdicional}><Plus size={18} /></button>
          </div>

          <div className="setup-actions">
            <button className="setup-btn-secondary" onClick={next}>Omitir</button>
            <button className="setup-btn-primary" onClick={next}>Siguiente</button>
          </div>
        </div>
      </div>
    )
  }

  // ============================================================
  // STEP 5: Membresías
  // ============================================================
  if (step === 5) {
    const visibleMembresias = localMembresias.filter(m => m._status !== 'deleted')

    const addMembresia = () => {
      if (!newMembresiaNombre.trim()) return
      setLocalMembresias(prev => [...prev, {
        _status: 'new',
        _tempId: Date.now(),
        nombre: newMembresiaNombre.trim().toUpperCase(),
        precio: Number(newMembresiaPrecio) || 0,
        duracion_dias: Number(newMembresiaDuracion) || 1,
      }])
      setNewMembresiaNombre('')
      setNewMembresiaPrecio('')
      setNewMembresiaDuracion('')
      markDirty('membresias')
    }

    const updateMembresia = (index, field, value) => {
      setLocalMembresias(prev => prev.map((m, i) => {
        if (i !== index) return m
        const status = m._status === 'new' ? 'new' : 'edited'
        const val = (field === 'precio' || field === 'duracion_dias') ? (Number(value) || 0) : value
        return { ...m, [field]: val, _status: status }
      }))
      markDirty('membresias')
    }

    const removeMembresia = (index) => {
      setLocalMembresias(prev => prev.map((m, i) => {
        if (i !== index) return m
        return { ...m, _status: 'deleted' }
      }))
      markDirty('membresias')
    }

    return (
      <div className="setup-wizard">
        <div className="setup-progress" style={{ width: `${progress}%` }} />
        <div className="setup-step">
          <button className="setup-btn-back" onClick={back}><ChevronLeft size={16} /> Volver</button>
          <h1>Membresías</h1>
          <p className="subtitle">Configura los planes de membresía que ofreces.</p>

          <div className="setup-list">
            {visibleMembresias.map((m, i) => {
              const prot = isProtectedMembresia(m.nombre)
              return (
                <div key={m.id || m._tempId} className={`setup-list-item ${prot ? 'protected' : ''}`}>
                  <div className="setup-list-item-info">
                    {prot ? (
                      <span className="setup-list-item-name">
                        {m.nombre}
                        <span className="setup-badge">Por defecto</span>
                      </span>
                    ) : (
                      <input
                        type="text"
                        className="setup-inline-input"
                        value={m.nombre}
                        onChange={(e) => updateMembresia(i, 'nombre', e.target.value)}
                      />
                    )}
                  </div>
                  <div className="setup-list-item-actions">
                    {!prot && (
                      <>
                        <div className="setup-price-input">
                          <span>$</span>
                          <input
                            type="number"
                            value={m.precio}
                            onChange={(e) => updateMembresia(i, 'precio', e.target.value)}
                          />
                        </div>
                        <div className="setup-duration-input">
                          <input
                            type="number"
                            value={m.duracion_dias}
                            onChange={(e) => updateMembresia(i, 'duracion_dias', e.target.value)}
                            min="1"
                          />
                          <span>meses</span>
                        </div>
                        <button className="setup-remove-btn" onClick={() => removeMembresia(i)}>
                          <X size={16} />
                        </button>
                      </>
                    )}
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
            <div className="setup-price-input">
              <span>$</span>
              <input
                type="number"
                placeholder="Precio"
                value={newMembresiaPrecio}
                onChange={(e) => setNewMembresiaPrecio(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addMembresia()}
              />
            </div>
            <div className="setup-duration-input">
              <input
                type="number"
                placeholder="Meses"
                value={newMembresiaDuracion}
                onChange={(e) => setNewMembresiaDuracion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addMembresia()}
                min="1"
              />
              <span>meses</span>
            </div>
            <button className="setup-add-btn-inline" onClick={addMembresia}><Plus size={18} /></button>
          </div>

          <div className="setup-actions">
            <button className="setup-btn-secondary" onClick={next}>Omitir</button>
            <button className="setup-btn-primary" onClick={next}>Siguiente</button>
          </div>
        </div>
      </div>
    )
  }

  // ============================================================
  // STEP 6: Done!
  // ============================================================
  if (step === 6) {
    const lavadosCount = localLavados.filter(l => l._status !== 'deleted').length
    const metodosCount = localMetodos.filter(m => m._active).length
    const trabajadoresCount = localTrabajadores.length
    const adicionalesCount = localAdicionales.filter(a => a._status !== 'deleted').length
    const membresiasCount = localMembresias.filter(m => m._status !== 'deleted').length

    return (
      <div className="setup-wizard">
        <div className="setup-progress" style={{ width: '100%' }} />
        <div className="setup-step setup-step-center">
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
        </div>
      </div>
    )
  }

  return null
}
