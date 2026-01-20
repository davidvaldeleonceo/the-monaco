import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { Plus, X } from 'lucide-react'

export default function PagoTrabajadores() {
  const [pagos, setPagos] = useState([])
  const [lavadores, setLavadores] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filtroMes, setFiltroMes] = useState(new Date().toISOString().slice(0, 7))

  const [formData, setFormData] = useState({
    lavador_id: '',
    fecha: new Date().toISOString().split('T')[0],
    lavadas_cantidad: 0,
    kit_cantidad: 0,
    cera_cantidad: 0,
    basico: 0,
    total: 0,
    descuentos: 0,
    total_pagar: 0
  })

  useEffect(() => {
    fetchData()
  }, [filtroMes])

  const fetchData = async () => {
    setLoading(true)

    const inicioMes = `${filtroMes}-01`
    const finMes = new Date(filtroMes + '-01')
    finMes.setMonth(finMes.getMonth() + 1)
    const finMesStr = finMes.toISOString().split('T')[0]

    const { data: pagosData } = await supabase
      .from('pago_trabajadores')
      .select(`
        *,
        lavador:lavadores(nombre)
      `)
      .gte('fecha', inicioMes)
      .lt('fecha', finMesStr)
      .order('fecha', { ascending: false })

    const { data: lavadoresData } = await supabase
      .from('lavadores')
      .select('*')
      .eq('activo', true)

    setPagos(pagosData || [])
    setLavadores(lavadoresData || [])
    setLoading(false)
  }

  const calcularTotal = (data) => {
    const total = Number(data.basico) + (data.lavadas_cantidad * 5000) + (data.kit_cantidad * 3000) + (data.cera_cantidad * 2000)
    const totalPagar = total - Number(data.descuentos)
    return { total, total_pagar: totalPagar }
  }

  const handleChange = (field, value) => {
    const newData = { ...formData, [field]: value }
    const { total, total_pagar } = calcularTotal(newData)
    setFormData({ ...newData, total, total_pagar })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    await supabase.from('pago_trabajadores').insert([formData])

    setShowModal(false)
    setFormData({
      lavador_id: '',
      fecha: new Date().toISOString().split('T')[0],
      lavadas_cantidad: 0,
      kit_cantidad: 0,
      cera_cantidad: 0,
      basico: 0,
      total: 0,
      descuentos: 0,
      total_pagar: 0
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

  const getTotalPagado = () => {
    return pagos.reduce((sum, p) => sum + Number(p.total_pagar), 0)
  }

  if (loading) {
    return <div className="loading">Cargando...</div>
  }

  return (
    <div className="pagos-page">
      <div className="page-header">
        <h1 className="page-title">Pago Trabajadores</h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={20} />
          Nuevo Pago
        </button>
      </div>

      <div className="filters">
        <input
          type="month"
          value={filtroMes}
          onChange={(e) => setFiltroMes(e.target.value)}
          className="filter-month"
        />
        <div className="total-pagado">
          Total pagado: <strong>{formatMoney(getTotalPagado())}</strong>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Trabajador</th>
              <th>Lavadas</th>
              <th>Kit</th>
              <th>Cera</th>
              <th>Básico</th>
              <th>Total</th>
              <th>Descuentos</th>
              <th>A Pagar</th>
            </tr>
          </thead>
          <tbody>
            {pagos.map((pago) => (
              <tr key={pago.id}>
                <td>{new Date(pago.fecha).toLocaleDateString('es-CO')}</td>
                <td>{pago.lavador?.nombre}</td>
                <td>{pago.lavadas_cantidad}</td>
                <td>{pago.kit_cantidad}</td>
                <td>{pago.cera_cantidad}</td>
                <td>{formatMoney(pago.basico)}</td>
                <td>{formatMoney(pago.total)}</td>
                <td className="valor-negativo">{formatMoney(pago.descuentos)}</td>
                <td className="valor-positivo"><strong>{formatMoney(pago.total_pagar)}</strong></td>
              </tr>
            ))}
            {pagos.length === 0 && (
              <tr>
                <td colSpan="9" className="empty">No hay pagos registrados este mes</td>
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
              <h2>Nuevo Pago</h2>
              <button className="btn-close" onClick={() => setShowModal(false)}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Trabajador</label>
                  <select
                    value={formData.lavador_id}
                    onChange={(e) => handleChange('lavador_id', e.target.value)}
                    required
                  >
                    <option value="">Seleccionar</option>
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
                    onChange={(e) => handleChange('fecha', e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Cantidad Lavadas</label>
                  <input
                    type="number"
                    value={formData.lavadas_cantidad}
                    onChange={(e) => handleChange('lavadas_cantidad', Number(e.target.value))}
                  />
                </div>

                <div className="form-group">
                  <label>Cantidad Kit</label>
                  <input
                    type="number"
                    value={formData.kit_cantidad}
                    onChange={(e) => handleChange('kit_cantidad', Number(e.target.value))}
                  />
                </div>

                <div className="form-group">
                  <label>Cantidad Cera</label>
                  <input
                    type="number"
                    value={formData.cera_cantidad}
                    onChange={(e) => handleChange('cera_cantidad', Number(e.target.value))}
                  />
                </div>

                <div className="form-group">
                  <label>Básico</label>
                  <input
                    type="number"
                    value={formData.basico}
                    onChange={(e) => handleChange('basico', Number(e.target.value))}
                  />
                </div>

                <div className="form-group">
                  <label>Descuentos</label>
                  <input
                    type="number"
                    value={formData.descuentos}
                    onChange={(e) => handleChange('descuentos', Number(e.target.value))}
                  />
                </div>

                <div className="form-group">
                  <label>Total</label>
                  <input type="text" value={formatMoney(formData.total)} disabled />
                </div>

                <div className="form-group">
                  <label>Total a Pagar</label>
                  <input type="text" value={formatMoney(formData.total_pagar)} disabled className="total-pagar" />
                </div>
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