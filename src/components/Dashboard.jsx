import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useData } from './DataContext'
import { Droplets, DollarSign, TrendingUp, Users } from 'lucide-react'

export default function Dashboard() {
  const { lavadas, clientes, lavadores, loading, updateLavadaLocal } = useData()
  const [stats, setStats] = useState({
    lavadasMes: 0,
    ingresosMes: 0,
    balanceMes: 0,
    clientesActivos: 0
  })

  useEffect(() => {
    if (!loading) {
      calcularStats()
    }
  }, [lavadas, clientes, loading])

  const calcularStats = async () => {
    const inicioMes = new Date()
    inicioMes.setDate(1)
    inicioMes.setHours(0, 0, 0, 0)

    const lavadasMes = lavadas.filter(l => new Date(l.fecha) >= inicioMes).length
    const clientesActivos = clientes.filter(c => c.estado === 'Activo').length

    // Ingresos y egresos del mes
    const { data: ingresos } = await supabase
      .from('transacciones')
      .select('valor')
      .eq('tipo', 'INGRESO')
      .gte('fecha', inicioMes.toISOString().split('T')[0])

    const { data: egresos } = await supabase
      .from('transacciones')
      .select('valor')
      .eq('tipo', 'EGRESO')
      .gte('fecha', inicioMes.toISOString().split('T')[0])

    const totalIngresos = ingresos?.reduce((sum, t) => sum + Number(t.valor), 0) || 0
    const totalEgresos = egresos?.reduce((sum, t) => sum + Number(t.valor), 0) || 0

    setStats({
      lavadasMes,
      ingresosMes: totalIngresos,
      balanceMes: totalIngresos - totalEgresos,
      clientesActivos
    })
  }

  const handleEstadoChange = async (lavadaId, nuevoEstado) => {
    updateLavadaLocal(lavadaId, { estado: nuevoEstado })
    
    await supabase
      .from('lavadas')
      .update({ estado: nuevoEstado })
      .eq('id', lavadaId)
  }

  const formatMoney = (value) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value)
  }

  const getEstadoClass = (estado) => {
    const clases = {
      'EN ESPERA': 'estado-espera',
      'EN LAVADO': 'estado-lavado',
      'NOTIFICADO': 'estado-notificado',
      'ENTREGADO': 'estado-entregado'
    }
    return clases[estado] || ''
  }

  if (loading) {
    return <div className="loading">Cargando...</div>
  }

  const ultimasLavadas = lavadas.slice(0, 5)
  const topClientes = clientes.filter(c => c.estado === 'Activo').slice(0, 5)

  return (
    <div className="dashboard">
      <h1 className="page-title">Dashboard</h1>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon lavadas">
            <Droplets size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Lavadas del Mes</span>
            <span className="stat-value">{stats.lavadasMes}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon ingresos">
            <DollarSign size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Ingresos del Mes</span>
            <span className="stat-value">{formatMoney(stats.ingresosMes)}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon balance">
            <TrendingUp size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Balance Actual</span>
            <span className="stat-value">{formatMoney(stats.balanceMes)}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon clientes">
            <Users size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Clientes Activos</span>
            <span className="stat-value">{stats.clientesActivos}</span>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card ultimas-lavadas">
          <div className="card-header">
            <h2>Últimas Lavadas</h2>
            <a href="/lavadas" className="ver-todas">Ver todas</a>
          </div>
          <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Tipo</th>
                <th>Placa</th>
                <th>Estado</th>
                <th>Valor</th>
                <th>Lavador</th>
              </tr>
            </thead>
            <tbody>
              {ultimasLavadas.map((lavada) => (
                <tr key={lavada.id}>
                  <td>
                    <div className="cliente-cell">
                      <span className="cliente-nombre">
                        {lavada.cliente?.nombre || 'Cliente no encontrado'}
                      </span>
                      <span className="cliente-fecha">
                        {new Date(lavada.fecha).toLocaleDateString('es-CO')}
                      </span>
                    </div>
                  </td>
                  <td>{lavada.tipo_lavado?.nombre}</td>
                  <td>{lavada.placa}</td>
                  <td>
                    <select
                      value={lavada.estado}
                      onChange={(e) => handleEstadoChange(lavada.id, e.target.value)}
                      className={`estado-select ${getEstadoClass(lavada.estado)}`}
                    >
                      <option value="EN ESPERA">En Espera</option>
                      <option value="EN LAVADO">En Lavado</option>
                      <option value="NOTIFICADO">Notificado</option>
                      <option value="ENTREGADO">Entregado</option>
                    </select>
                  </td>
                  <td>{formatMoney(lavada.valor)}</td>
                  <td>{lavada.lavador?.nombre || '-'}</td>
                </tr>
              ))}
              {ultimasLavadas.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty">No hay lavadas registradas</td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>

        <div className="card top-clientes">
          <h2>Top Clientes</h2>
          <div className="clientes-list">
            {topClientes.map((cliente) => (
              <div key={cliente.id} className="cliente-item">
                <div className="cliente-avatar">
                  {cliente.nombre?.substring(0, 2).toUpperCase()}
                </div>
                <div className="cliente-info">
                  <span className="nombre">{cliente.nombre}</span>
                  <span className="membresia">
                    {cliente.membresia?.nombre || 'Sin membresía'} • {cliente.placa}
                  </span>
                </div>
              </div>
            ))}
            {topClientes.length === 0 && (
              <p className="empty">No hay clientes registrados</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}