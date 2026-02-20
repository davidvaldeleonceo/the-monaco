import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useData } from './DataContext'
import { Plus, X, Pencil, Trash2, ListChecks, CheckCircle2, Users, ClipboardList } from 'lucide-react'
import ConfirmDeleteModal from './common/ConfirmDeleteModal'

const DIAS_NOMBRES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function getInicioSemana(ref) {
  const d = ref ? new Date(ref) : new Date()
  const dia = d.getDay()
  const diff = d.getDate() - (dia === 0 ? 6 : dia - 1)
  const lunes = new Date(d)
  lunes.setDate(diff)
  lunes.setHours(0, 0, 0, 0)
  return lunes
}

function fechaLocalStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatHora(timestamptz) {
  if (!timestamptz) return ''
  const d = new Date(timestamptz)
  return d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export default function Tareas() {
  const { lavadores, negocioId } = useData()

  const [tareas, setTareas] = useState([])
  const [completadas, setCompletadas] = useState([])
  const [semanaActual, setSemanaActual] = useState(getInicioSemana())

  // Modal CRUD tarea predefinida
  const [showModalTarea, setShowModalTarea] = useState(false)
  const [editandoTarea, setEditandoTarea] = useState(null)
  const [formTarea, setFormTarea] = useState({
    nombre: '',
    frecuencia: 'DIARIA',
    dias_semana: [0, 1, 2, 3, 4, 5, 6]
  })

  const [pendingDeleteTareaId, setPendingDeleteTareaId] = useState(null)

  // Modal completar todas
  const [showModalCompletar, setShowModalCompletar] = useState(false)
  const [diaCompletar, setDiaCompletar] = useState(null)
  const [lavadorCompletar, setLavadorCompletar] = useState('')

  // Generar días de la semana
  function getDiasSemana() {
    const dias = []
    for (let i = 0; i < 7; i++) {
      const fecha = new Date(semanaActual)
      fecha.setDate(semanaActual.getDate() + i)
      dias.push({
        fecha: fechaLocalStr(fecha),
        diaSemana: fecha.getDay(),
        nombre: fecha.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' })
      })
    }
    return dias
  }

  useEffect(() => {
    fetchTareas()
    fetchCompletadas()
  }, [semanaActual])

  const fetchTareas = async () => {
    const { data } = await supabase
      .from('tareas')
      .select('*')
      .eq('activo', true)
      .order('nombre')
    setTareas(data || [])
  }

  const fetchCompletadas = async () => {
    const finSemana = new Date(semanaActual)
    finSemana.setDate(finSemana.getDate() + 6)

    const { data } = await supabase
      .from('tareas_completadas')
      .select('*, lavador:lavadores(nombre)')
      .gte('fecha', fechaLocalStr(semanaActual))
      .lte('fecha', fechaLocalStr(finSemana))

    setCompletadas(data || [])
  }

  // Helpers
  const getTareasDelDia = (diaSemana) => {
    return tareas.filter(t => t.dias_semana && t.dias_semana.includes(diaSemana))
  }

  const getCompletada = (tareaId, fecha) => {
    return completadas.find(c => c.tarea_id === tareaId && c.fecha === fecha)
  }

  const toggleTarea = async (tareaId, fecha) => {
    const existente = getCompletada(tareaId, fecha)
    if (existente) {
      await supabase.from('tareas_completadas').delete().eq('id', existente.id)
    } else {
      await supabase.from('tareas_completadas').insert([{
        tarea_id: tareaId,
        fecha,
        completada: true,
        hora_completada: new Date().toISOString(),
        negocio_id: negocioId
      }])
    }
    fetchCompletadas()
  }

  const asignarLavador = async (completadaId, lavadorId) => {
    await supabase
      .from('tareas_completadas')
      .update({ lavador_id: lavadorId || null })
      .eq('id', completadaId)
    fetchCompletadas()
  }

  const completarTodasDelDia = async () => {
    if (!diaCompletar || !lavadorCompletar) return
    const { fecha, diaSemana } = diaCompletar
    const tareasDelDia = getTareasDelDia(diaSemana)
    const pendientes = tareasDelDia.filter(t => !getCompletada(t.id, fecha))

    if (pendientes.length === 0) {
      setShowModalCompletar(false)
      return
    }

    const inserts = pendientes.map(t => ({
      tarea_id: t.id,
      fecha,
      lavador_id: lavadorCompletar,
      completada: true,
      hora_completada: new Date().toISOString(),
      negocio_id: negocioId
    }))

    await supabase.from('tareas_completadas').insert(inserts)
    setShowModalCompletar(false)
    setLavadorCompletar('')
    fetchCompletadas()
  }

  // CRUD tareas predefinidas
  const abrirModalNuevaTarea = () => {
    setEditandoTarea(null)
    setFormTarea({ nombre: '', frecuencia: 'DIARIA', dias_semana: [0, 1, 2, 3, 4, 5, 6] })
    setShowModalTarea(true)
  }

  const abrirModalEditarTarea = (tarea) => {
    setEditandoTarea(tarea)
    setFormTarea({
      nombre: tarea.nombre,
      frecuencia: tarea.frecuencia || 'DIARIA',
      dias_semana: tarea.dias_semana || [0, 1, 2, 3, 4, 5, 6]
    })
    setShowModalTarea(true)
  }

  const handleGuardarTarea = async (e) => {
    e.preventDefault()
    const payload = {
      nombre: formTarea.nombre,
      frecuencia: formTarea.frecuencia,
      dias_semana: formTarea.frecuencia === 'DIARIA' ? [0, 1, 2, 3, 4, 5, 6] : formTarea.dias_semana
    }

    if (editandoTarea) {
      const { error } = await supabase.from('tareas').update(payload).eq('id', editandoTarea.id)
      if (error) { console.error('Error actualizando tarea:', error); return }
    } else {
      const { error } = await supabase.from('tareas').insert([{ ...payload, activo: true, negocio_id: negocioId }])
      if (error) { console.error('Error creando tarea:', error); return }
    }

    setShowModalTarea(false)
    fetchTareas()
  }

  const requestEliminarTarea = (id) => {
    setPendingDeleteTareaId(id)
  }

  const executeEliminarTarea = async () => {
    const id = pendingDeleteTareaId
    if (!id) return
    await supabase.from('tareas').update({ activo: false }).eq('id', id)
    fetchTareas()
    setPendingDeleteTareaId(null)
  }

  const toggleDiaSemana = (dia) => {
    setFormTarea(prev => ({
      ...prev,
      dias_semana: prev.dias_semana.includes(dia)
        ? prev.dias_semana.filter(d => d !== dia)
        : [...prev.dias_semana, dia].sort()
    }))
  }

  // Navegación semanas
  const cambiarSemana = (dir) => {
    const nueva = new Date(semanaActual)
    nueva.setDate(nueva.getDate() + dir * 7)
    setSemanaActual(nueva)
  }

  // Stats
  const diasSemana = getDiasSemana()

  const totalTareasSemana = diasSemana.reduce((acc, dia) => acc + getTareasDelDia(dia.diaSemana).length, 0)

  const totalCompletadas = diasSemana.reduce((acc, dia) => {
    const tareasDelDia = getTareasDelDia(dia.diaSemana)
    return acc + tareasDelDia.filter(t => getCompletada(t.id, dia.fecha)).length
  }, 0)

  const porcentajeTotal = totalTareasSemana > 0 ? Math.round((totalCompletadas / totalTareasSemana) * 100) : 0

  // Trabajador más activo
  const conteoLavadores = {}
  completadas.forEach(c => {
    if (c.lavador_id) {
      conteoLavadores[c.lavador_id] = (conteoLavadores[c.lavador_id] || 0) + 1
    }
  })
  const lavadorMasActivoId = Object.keys(conteoLavadores).sort((a, b) => conteoLavadores[b] - conteoLavadores[a])[0]
  const lavadorMasActivo = lavadores.find(l => l.id === lavadorMasActivoId)

  // Progreso por día
  const getProgresoDia = (dia) => {
    const tareasDelDia = getTareasDelDia(dia.diaSemana)
    if (tareasDelDia.length === 0) return { completadas: 0, total: 0, porcentaje: 0 }
    const comp = tareasDelDia.filter(t => getCompletada(t.id, dia.fecha)).length
    return { completadas: comp, total: tareasDelDia.length, porcentaje: Math.round((comp / tareasDelDia.length) * 100) }
  }

  const getProgresoColor = (pct) => {
    if (pct <= 40) return 'var(--accent-red)'
    if (pct <= 70) return 'var(--accent-yellow)'
    return 'var(--accent-green)'
  }

  const hoyStr = fechaLocalStr(new Date())

  return (
    <div className="tareas-page">
      <div className="page-header">
        <h1 className="page-title">Control de Tareas</h1>
        <button className="btn-primary" onClick={abrirModalNuevaTarea}>
          <Plus size={20} />
          Nueva Tarea
        </button>
      </div>

      <div className="filters">
        <div className="semana-navegacion">
          <button className="btn-secondary" onClick={() => cambiarSemana(-1)}>←</button>
          <span className="semana-actual">
            Semana del {semanaActual.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}
          </span>
          <button className="btn-secondary" onClick={() => cambiarSemana(1)}>→</button>
        </div>
      </div>

      <div className="pagos-stats">
        <div className="pago-stat-card balance positivo">
          <div className="pago-stat-left">
            <ClipboardList size={20} />
            <span>Total Tareas</span>
          </div>
          <span className="pago-stat-valor">{totalTareasSemana}</span>
        </div>
        <div className="pago-stat-card ingresos">
          <div className="pago-stat-left">
            <CheckCircle2 size={20} />
            <span>Completadas</span>
          </div>
          <span className="pago-stat-valor">{totalCompletadas}/{totalTareasSemana} ({porcentajeTotal}%)</span>
        </div>
        <div className="pago-stat-card egresos">
          <div className="pago-stat-left">
            <Users size={20} />
            <span>Más Activo</span>
          </div>
          <span className="pago-stat-valor">{lavadorMasActivo ? lavadorMasActivo.nombre : '—'}</span>
        </div>
      </div>

      {/* Calendario con scroll horizontal */}
      <div className="tareas-calendario-wrapper">
          <div className="calendario-semana">
            {diasSemana.map(dia => {
              const tareasDelDia = getTareasDelDia(dia.diaSemana)
              const progreso = getProgresoDia(dia)
              const esHoy = dia.fecha === hoyStr

              return (
                <div key={dia.fecha} className={`dia-columna ${esHoy ? 'dia-hoy' : ''}`}>
                  <div className="dia-header">{dia.nombre}</div>
                  <div className="dia-tareas">
                    {tareasDelDia.map(tarea => {
                      const comp = getCompletada(tarea.id, dia.fecha)
                      return (
                        <div key={tarea.id} className={`tarea-item ${comp ? 'completada' : ''}`}>
                          <div
                            className="tarea-check"
                            onClick={() => toggleTarea(tarea.id, dia.fecha)}
                          >
                            {comp && <CheckCircle2 size={16} />}
                          </div>
                          <div className="tarea-info">
                            <span className="tarea-nombre">{tarea.nombre}</span>
                            {comp ? (
                              <div className="tarea-completada-info">
                                <select
                                  className="tarea-lavador-select"
                                  value={comp.lavador_id || ''}
                                  onChange={(e) => asignarLavador(comp.id, e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <option value="">Sin asignar</option>
                                  {lavadores.map(l => (
                                    <option key={l.id} value={l.id}>{l.nombre}</option>
                                  ))}
                                </select>
                                <span className="tarea-timestamp">{formatHora(comp.hora_completada)}</span>
                              </div>
                            ) : (
                              <span className="tarea-sin-asignar">Sin asignar</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    {tareasDelDia.length === 0 && (
                      <span className="sin-tareas">Sin tareas</span>
                    )}
                  </div>
                  {tareasDelDia.length > 0 && (
                    <div className="dia-footer">
                      <button
                        className="btn-completar-todas"
                        onClick={() => {
                          setDiaCompletar(dia)
                          setLavadorCompletar('')
                          setShowModalCompletar(true)
                        }}
                      >
                        <ListChecks size={14} />
                        Completar todas
                      </button>
                      <div className="dia-progreso">
                        <div
                          className="dia-progreso-fill"
                          style={{
                            width: `${progreso.porcentaje}%`,
                            backgroundColor: getProgresoColor(progreso.porcentaje)
                          }}
                        />
                      </div>
                      <span className="dia-progreso-text">{progreso.porcentaje}%</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Tareas Predefinidas */}
        <div className="card">
            <div className="card-header-row">
              <h2>Tareas Predefinidas</h2>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Frecuencia</th>
                    <th>Días</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tareas.map(tarea => (
                    <tr key={tarea.id}>
                      <td>{tarea.nombre}</td>
                      <td>
                        <span className={`frecuencia ${(tarea.frecuencia || '').toLowerCase()}`}>
                          {tarea.frecuencia === 'DIARIA' ? 'Diaria' : 'Semanal'}
                        </span>
                      </td>
                      <td>
                        {tarea.dias_semana && tarea.dias_semana.map(d => DIAS_NOMBRES[d]).join(', ')}
                      </td>
                      <td>
                        <div className="acciones-btns">
                          <button className="btn-icon" onClick={() => abrirModalEditarTarea(tarea)} title="Editar">
                            <Pencil size={16} />
                          </button>
                          <button className="btn-icon btn-icon-danger" onClick={() => requestEliminarTarea(tarea.id)} title="Eliminar">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {tareas.length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No hay tareas definidas</td></tr>
                  )}
                </tbody>
              </table>
            </div>
        </div>

      {/* Modal Tarea Predefinida */}
      {showModalTarea && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>{editandoTarea ? 'Editar Tarea' : 'Nueva Tarea'}</h2>
              <button className="btn-close" onClick={() => setShowModalTarea(false)}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleGuardarTarea}>
              <div className="form-group">
                <label>Nombre</label>
                <input
                  type="text"
                  value={formTarea.nombre}
                  onChange={(e) => setFormTarea({ ...formTarea, nombre: e.target.value })}
                  required
                  placeholder="Nombre de la tarea"
                />
              </div>
              <div className="form-group">
                <label>Frecuencia</label>
                <select
                  value={formTarea.frecuencia}
                  onChange={(e) => {
                    const freq = e.target.value
                    setFormTarea({
                      ...formTarea,
                      frecuencia: freq,
                      dias_semana: freq === 'DIARIA' ? [0, 1, 2, 3, 4, 5, 6] : formTarea.dias_semana
                    })
                  }}
                >
                  <option value="DIARIA">Diaria</option>
                  <option value="SEMANAL">Semanal</option>
                </select>
              </div>
              {formTarea.frecuencia === 'SEMANAL' && (
                <div className="form-group">
                  <label>Días de la semana</label>
                  <div className="dias-checks">
                    {DIAS_NOMBRES.map((nombre, idx) => (
                      <label key={idx} className={`dia-check-label ${formTarea.dias_semana.includes(idx) ? 'activo' : ''}`}>
                        <input
                          type="checkbox"
                          checked={formTarea.dias_semana.includes(idx)}
                          onChange={() => toggleDiaSemana(idx)}
                        />
                        {nombre}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowModalTarea(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  {editandoTarea ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Completar Todas */}
      {showModalCompletar && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Completar todas — {diaCompletar?.nombre}</h2>
              <button className="btn-close" onClick={() => setShowModalCompletar(false)}>
                <X size={24} />
              </button>
            </div>
            <div className="form-group" style={{ padding: '1rem' }}>
              <label>Asignar trabajador</label>
              <select
                value={lavadorCompletar}
                onChange={(e) => setLavadorCompletar(e.target.value)}
              >
                <option value="">Seleccionar trabajador</option>
                {lavadores.map(l => (
                  <option key={l.id} value={l.id}>{l.nombre}</option>
                ))}
              </select>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowModalCompletar(false)}>
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={completarTodasDelDia}
                disabled={!lavadorCompletar}
              >
                Completar Pendientes
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={!!pendingDeleteTareaId}
        onClose={() => setPendingDeleteTareaId(null)}
        onConfirm={executeEliminarTarea}
        message="Se eliminará esta tarea predefinida. Ingresa tu contraseña para confirmar."
      />
    </div>
  )
}
