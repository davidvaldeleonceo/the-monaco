import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function Reportes() {
  const [loading, setLoading] = useState(true)
  const [filtroMes, setFiltroMes] = useState(new Date().toISOString().slice(0, 7))
  const [reporte, setReporte] = useState({
    totalVentas: 0,
    lavadasIndividuales: 0,
    adicionalesMembresias: 0,
    totalEgresos: 0,
    balance: 0,
    totalLavadasIndividuales: 0,
    totalLavadasMembresia: 0,
    ticketPromedioSinMembresia: 0,
    ticketPromedioConMembresia: 0
  })

  useEffect(() => {
    fetchReporte()
  }, [filtroMes])

  const fetchReporte = async () => {
    setLoading(true)

    const inicioMes = `${filtroMes}-01`
    const finMes = new Date(filtroMes + '-01')
    finMes.setMonth(finMes.getMonth() + 1)
    const finMesStr = finMes.toISOString().split('T')[0]

    // Lavadas del mes
    const { data: lavadas } = await supabase
      .from('lavadas')
      .select(`*, tipo_lavado:tipos_lavado(nombre)`)
      .gte('fecha', inicioMes)
      .lt('fecha', finMesStr)

    // Transacciones del mes
    const { data: transacciones } = await supabase
      .from('transacciones')
      .select('*')
      .gte('fecha', inicioMes)
      .lt('fecha', finMesStr)

    const lavadasMembresia = lavadas?.filter(l => l.tipo_lavado?.nombre === 'MEMBRESIA') || []
    const lavadasIndividuales = lavadas?.filter(l => l.tipo_lavado?.nombre !== 'MEMBRESIA') || []

    const totalLavadasIndividuales = lavadasIndividuales.reduce((sum, l) => sum + Number(l.valor), 0)
    const ingresos = transacciones?.filter(t => t.tipo === 'INGRESO').reduce((sum, t) => sum + Number(t.valor), 0) || 0
    const egresos = transacciones?.filter(t => t.tipo === 'EGRESO').reduce((sum, t) => sum + Number(t.valor), 0) || 0

    setReporte({
      totalVentas: totalLavadasIndividuales + ingresos,
      lavadasIndividuales: totalLavadasIndividuales,
      adicionalesMembresias: ingresos,
      totalEgresos: egresos,
      balance: totalLavadasIndividuales + ingresos - egresos,
      totalLavadasIndividuales: lavadasIndividuales.length,
      totalLavadasMembresia: lavadasMembresia.length,
      ticketPromedioSinMembresia: lavadasIndividuales.length > 0 ? totalLavadasIndividuales / lavadasIndividuales.length : 0,
      ticketPromedioConMembresia: lavadas?.length > 0 ? (totalLavadasIndividuales + ingresos) / lavadas.length : 0
    })

    setLoading(false)
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
    <div className="reportes-page">
      <div className="page-header">
        <h1 className="page-title">Reportes</h1>
      </div>

      <div className="filters">
        <input
          type="month"
          value={filtroMes}
          onChange={(e) => setFiltroMes(e.target.value)}
          className="filter-month"
        />
      </div>

      <div className="reportes-grid">
        <div className="reporte-card">
          <h3>Resumen de Ventas</h3>
          <div className="reporte-items">
            <div className="reporte-item">
              <span>Total ventas (incluyendo otros ingresos)</span>
              <span className="valor">{formatMoney(reporte.totalVentas)}</span>
            </div>
            <div className="reporte-item">
              <span>Lavadas individuales</span>
              <span className="valor">{formatMoney(reporte.lavadasIndividuales)}</span>
            </div>
            <div className="reporte-item">
              <span>Membresías y otros ingresos</span>
              <span className="valor">{formatMoney(reporte.adicionalesMembresias)}</span>
            </div>
            <div className="reporte-item">
              <span>Total egresos</span>
              <span className="valor negativo">{formatMoney(reporte.totalEgresos)}</span>
            </div>
            <div className="reporte-item destacado">
              <span>Balance</span>
              <span className={`valor ${reporte.balance >= 0 ? 'positivo' : 'negativo'}`}>
                {formatMoney(reporte.balance)}
              </span>
            </div>
          </div>
        </div>

        <div className="reporte-card">
          <h3>Estadísticas de Lavadas</h3>
          <div className="reporte-items">
            <div className="reporte-item">
              <span>Total lavadas individuales</span>
              <span className="valor">{reporte.totalLavadasIndividuales}</span>
            </div>
            <div className="reporte-item">
              <span>Total lavadas con membresía</span>
              <span className="valor">{reporte.totalLavadasMembresia}</span>
            </div>
            <div className="reporte-item">
              <span>Ticket promedio sin membresía</span>
              <span className="valor">{formatMoney(reporte.ticketPromedioSinMembresia)}</span>
            </div>
            <div className="reporte-item">
              <span>Ticket promedio total</span>
              <span className="valor">{formatMoney(reporte.ticketPromedioConMembresia)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}