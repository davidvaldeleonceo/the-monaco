import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { Plus, X, Check } from 'lucide-react'

export default function Tareas() {
  const [tareas, setTareas] = useState([])
  const [lavadores, setLavadores] = useState([])
  const [tareasAsignadas, setTareasAsignadas] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [semanaActual, setSemanaActual] = useState(getInicioSemana())

  const [formData, setFormData] = useState({
    tarea_id: '',
    lavador_id: '',
    fecha: new Date().toISOString().split('T')[0]
  })

  function getInicioSemana() {
    const hoy = new Date()
    const dia = hoy.getDay()
    const diff = hoy.getDate() - dia + (dia === 0 ? -6 : 1)
    return new Date(hoy.setDate(diff)).toISOString().split('T')[0]
  }

  function getDiasSemana() {
    const dias = []
    const inicio = new Date(semanaActual)
    for (let i = 0; i < 7; i++) {
      const fecha = new Date(inicio)
      fecha.setDate(inicio.getDate() + i)
      dias.push({
        fecha: fecha.toISOString().split('T')[0],
        nombre: fecha.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' })
      })
    }
    return dias
  }

  useEffect(() => {
    fetchData()
  }, [semanaActual])

  const fetchData = async () => {
    setLoading(true)

    const finSemana = new Date(semanaActual)
    finSemana.setDate(finSemana.getDate() + 7)

    const { data: tareasData } = await supabase
      .from('tareas')
      .select('*')
      .eq('activo', true)
      .order('nombre')

    const { data: lavadoresData } = await supabase
      .from('lavadores')
      .select('*')
      .eq('activo', true)

    const { data: asignadasData } = await supabase
      .from('tareas_asignadas')
      .select(`
        *,
        tarea:tareas(nombre, frecuencia),
        lavador:lavadores(nombre)
      `)
      .gte('fecha', semanaActual)
      .lt('fecha', finSemana.toISOString().split('T')[0])

    setTareas(tareasData || [])
    setLavadores(lavadoresData || [])
    setTareasAsignadas(asignadasData || [])
    setLoading(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    await supabase.from('tareas_asignadas').insert([formData])

    setShowModal(false)
    setFormData({
      tarea_id: '',
      lavador_id: '',
      fecha: new Date().toISOString().split('T')[0]
    })
    fetchData()
  }

  const toggleCompletada = async (id, completada) => {
    await supabase
      .from('tareas_asignadas')
      .update({ completada: !completada })
      .eq('id', id)
    fetchData()
  }

  const cambiarSemana = (direccion) => {
    const fecha = new Date(semanaActual)
    fecha.setDate(fecha.getDate() + (direccion * 7))
    setSemanaActual(fecha.toISOString().split('T')[0])
  }

  const getTareasDelDia = (fecha) => {
    return tareasAsignadas.filter(t => t.fecha === fecha)
  }

  if (loading) {
    return <div className="loading">Cargando...</div>
  }

  const diasSemana = getDiasSemana()

  return (
    <div className="tareas-page">
      <div className="page-header">
        <h1 className="page-title">Control de Tareas</h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={20} />
          Asignar Tarea
        </button>
      </div>

      <div className="semana-navegacion">
        <button className="btn-secondary" onClick={() => cambiarSemana(-1)}>← Anterior</button>
        <span className="semana-actual">
          Semana del {new Date(semanaActual).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}
        </span>
        <button className="btn-secondary" onClick={() => cambiarSemana(1)}>Siguiente →</button>
      </div>

      <div className="calendario-semana">
        {diasSemana.map(dia => (
          <div key={dia.fecha} className="dia-columna">
            <div className="dia-header">{dia.nombre}</div>
            <div className="dia-tareas">
              {getTareasDelDia(dia.fecha).map(tarea => (
                <div
                  key={tarea.id}
                  className={`tarea-item ${tarea.completada ? 'completada' : ''}`}
                  onClick={() => toggleCompletada(tarea.id, tarea.completada)}
                >
                  <div className="tarea-check">
                    {tarea.completada && <Check size={16} />}
                  </div>
                  <div className="tarea-info">
                    <span className="tarea-nombre">{tarea.tarea?.nombre}</span>
                    <span className="tarea-lavador">{tarea.lavador?.nombre}</span>
                  </div>
                </div>
              ))}
              {getTareasDelDia(dia.fecha).length === 0 && (
                <span className="sin-tareas">Sin tareas</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="card tareas-lista">
        <h2>Tareas Predefinidas</h2>
        <div className="tareas-predefinidas">
          {tareas.map(tarea => (
            <div key={tarea.id} className="tarea-predefinida">
              <span className="nombre">{tarea.nombre}</span>
              <span className={`frecuencia ${tarea.frecuencia.toLowerCase()}`}>{tarea.frecuencia}</span>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Asignar Tarea</h2>
              <button className="btn-close" onClick={() => setShowModal(false)}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Tarea</label>
                <select
                  value={formData.tarea_id}
                  onChange={(e) => setFormData({ ...formData, tarea_id: e.target.value })}
                  required
                >
                  <option value="">Seleccionar tarea</option>
                  {tareas.map(t => (
                    <option key={t.id} value={t.id}>{t.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Lavador</label>
                <select
                  value={formData.lavador_id}
                  onChange={(e) => setFormData({ ...formData, lavador_id: e.target.value })}
                  required
                >
                  <option value="">Seleccionar lavador</option>
                  {lavadores.map(l => (
                    <option key={l.id} value={l.id}>{l.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Fecha</label>
                <input
                  type="date"
                  value={formData.fecha}
                  onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                  required
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Asignar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}