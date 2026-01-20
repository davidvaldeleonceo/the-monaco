import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { Plus, X, TrendingUp, TrendingDown } from 'lucide-react'

export default function Balance() {
  const [transacciones, setTransacciones] = useState([])
  const [metodosPago, setMetodosPago] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [resumen, setResumen] = useState({ ingresos: 0, egresos: 0, balance: 0 })
  const [filtroMes, setFiltroMes] = useState(new Date().toISOString().slice(0, 7))

  const [formData, setFormData] = useState({
    tipo: 'INGRESO',
    valor: '',
    categoria: '',
    metodo_pago_id: '',
    placa_o_persona: '',
    descripcion: '',
    fecha: new Date().toISOString().split('T')[0]
  })

  const categorias = {
    INGRESO: ['MEMBRESIA', 'LAVADA', 'ADICIONAL', 'OTRO'],
    EGRESO: ['INSUMOS', 'SERVICIOS', 'ABONO A SUELDO', 'ARRIENDO', 'OTRO']
  }

  useEffect(() => {
    fetchData()
  }, [filtroMes])

  const fetchData = async () => {
    setLoading(true)

    const inicioMes = `${filtroMes}-01`
    const finMes = new Date(filtroMes + '-01')
    finMes.setMonth(finMes.getMonth() + 1)
    const finMesStr = finMes.toISOString().split('T')[0]

    const { data: transaccionesData } = await supabase
      .from('transacciones')
      .select(`
        *,
        metodo_pago:metodos_pago(nombre)
      `)
      .gte('fecha', inicioMes)
      .lt('fecha', finMesStr)
      .order('fecha', { ascending: false })

    const { data: metodosData } = await supabase
      .from('metodos_pago')
      .select('*')
      .eq('activo', true)

    const ingresos = transaccionesData?.filter(t => t.tipo === 'INGRESO').reduce((sum, t) => sum + Number(t.valor), 0) || 0
    const egresos = transaccionesData?.filter(t => t.tipo === 'EGRESO').reduce((sum, t) => sum + Number(t.valor), 0) || 0

    setTransacciones(transaccionesData || [])
    setMetodosPago(metodosData || [])
    setResumen({ ingresos, egresos, balance: ingresos - egresos })
    setLoading(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    await supabase.from('transacciones').insert([formData])

    setShowModal(false)
    setFormData({
      tipo: 'INGRESO',
      valor: '',
      categoria: '',
      metodo_pago_id: '',
      placa_o_persona: '',
      descripcion: '',
      fecha: new Date().toISOString().split('T')[0]
    })
    fetchData()
  }

  const formatMoney = (value) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value)
  }

  if (loading) {
    return <div className="loading">Cargando...</div>
  }

  return (
    <div className="balance-page">
      <div className="page-header">
        <h1 className="page-title">Balance</h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={20} />
          Nueva Transacción
        </button>
      </div>

      <div className="balance-resumen">
        <div className="resumen-card ingresos">
          <TrendingUp size={24} />
          <div>
            <span className="label">Ingresos</span>
            <span className="valor">{formatMoney(resumen.ingresos)}</span>
          </div>
        </div>
        <div className="resumen-card egresos">
          <TrendingDown size={24} />
          <div>
            <span className="label">Egresos</span>
            <span className="valor">{formatMoney(resumen.egresos)}</span>
          </div>
        </div>
        <div className={`resumen-card balance ${resumen.balance >= 0 ? 'positivo' : 'negativo'}`}>
          <TrendingUp size={24} />
          <div>
            <span className="label">Balance</span>
            <span className="valor">{formatMoney(resumen.balance)}</span>
          </div>
        </div>
      </div>

      <div className="filters">
        <input
          type="month"
          value={filtroMes}
          onChange={(e) => setFiltroMes(e.target.value)}
          className="filter-month"
        />
      </div>

      <div className="card">
        <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Categoría</th>
              <th>Descripción</th>
              <th>Método</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {transacciones.map((t) => (
              <tr key={t.id}>
                <td>{new Date(t.fecha).toLocaleDateString('es-CO')}</td>
                <td>
                  <span className={`tipo-badge ${t.tipo.toLowerCase()}`}>
                    {t.tipo}
                  </span>
                </td>
                <td>{t.categoria}</td>
                <td>{t.descripcion || t.placa_o_persona || '-'}</td>
                <td>{t.metodo_pago?.nombre}</td>
                <td className={t.tipo === 'INGRESO' ? 'valor-positivo' : 'valor-negativo'}>
                  {t.tipo === 'EGRESO' ? '-' : ''}{formatMoney(t.valor)}
                </td>
              </tr>
            ))}
            {transacciones.length === 0 && (
              <tr>
                <td colSpan="6" className="empty">No hay transacciones en este mes</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Nueva Transacción</h2>
              <button className="btn-close" onClick={() => setShowModal(false)}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Tipo</label>
                  <select
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value, categoria: '' })}
                    required
                  >
                    <option value="INGRESO">Ingreso</option>
                    <option value="EGRESO">Egreso</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Valor</label>
                  <input
                    type="number"
                    value={formData.valor}
                    onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Categoría</label>
                  <select
                    value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    required
                  >
                    <option value="">Seleccionar</option>
                    {categorias[formData.tipo].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Método de Pago</label>
                  <select
                    value={formData.metodo_pago_id}
                    onChange={(e) => setFormData({ ...formData, metodo_pago_id: e.target.value })}
                    required
                  >
                    <option value="">Seleccionar</option>
                    {metodosPago.map(m => (
                      <option key={m.id} value={m.id}>{m.nombre}</option>
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

                <div className="form-group">
                  <label>Placa o Persona</label>
                  <input
                    type="text"
                    value={formData.placa_o_persona}
                    onChange={(e) => setFormData({ ...formData, placa_o_persona: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Descripción</label>
                <textarea
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  rows="2"
                ></textarea>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
