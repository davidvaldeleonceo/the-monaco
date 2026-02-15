import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { useData } from './DataContext'
import {
  Droplets, DollarSign, TrendingDown, Wallet, Users, Receipt, CheckCircle, XCircle, UserPlus
} from 'lucide-react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts'
import { formatMoney, formatMoneyShort } from '../utils/money'
import { ESTADO_COLORS, ESTADO_LABELS, CHART_THEME } from '../config/constants'

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const PERIODO_LABELS = {
  dia: 'Día',
  semana: 'Semana',
  mes: 'Mes',
  ano: 'Año'
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="dash-tooltip">
      <p className="dash-tooltip-label">{label}</p>
      <p className="dash-tooltip-value">{formatMoney(payload[0].value)}</p>
    </div>
  )
}

function getDateRange(periodo) {
  const now = new Date()
  const desde = new Date()
  desde.setHours(0, 0, 0, 0)

  if (periodo === 'dia') {
    // just today
  } else if (periodo === 'semana') {
    const day = desde.getDay()
    desde.setDate(desde.getDate() - (day === 0 ? 6 : day - 1)) // lunes
  } else if (periodo === 'mes') {
    desde.setDate(1)
  } else if (periodo === 'ano') {
    desde.setMonth(0, 1)
  }

  return desde
}

export default function Dashboard() {
  const { lavadas, clientes, lavadores, tiposLavado, loading } = useData()
  const [allTransacciones, setAllTransacciones] = useState([])
  const [transLoading, setTransLoading] = useState(true)
  const [periodo, setPeriodo] = useState('dia')

  useEffect(() => {
    const fetchTransacciones = async () => {
      const inicioAno = new Date()
      inicioAno.setMonth(0, 1)
      inicioAno.setHours(0, 0, 0, 0)
      const { data } = await supabase
        .from('transacciones')
        .select('*')
        .gte('fecha', inicioAno.toISOString().split('T')[0])
      setAllTransacciones(data || [])
      setTransLoading(false)
    }
    if (!loading) fetchTransacciones()
  }, [loading])

  const desde = useMemo(() => getDateRange(periodo), [periodo])

  // Filter lavadas and transacciones by period
  const lavadasPeriodo = useMemo(() => {
    return lavadas.filter(l => {
      const f = new Date(l.fecha)
      f.setHours(0, 0, 0, 0)
      return f >= desde
    })
  }, [lavadas, desde])

  const transacciones = useMemo(() => {
    const desdeStr = desde.toISOString().split('T')[0]
    return allTransacciones.filter(t => t.fecha >= desdeStr)
  }, [allTransacciones, desde])

  // Generate virtual INGRESO entries from lavadas.pagos (same logic as Balance.jsx)
  const pagosLavadasPeriodo = useMemo(() => {
    return lavadasPeriodo.flatMap(l => {
      const pagos = l.pagos || []
      if (pagos.length === 0) return []
      return pagos.map((p, idx) => ({
        id: `lavada-${l.id}-${idx}`,
        tipo: 'INGRESO',
        categoria: 'SERVICIO',
        valor: p.valor || 0,
        fecha: l.fecha,
        _esLavada: true
      }))
    })
  }, [lavadasPeriodo])

  // --- KPIs ---
  const kpis = useMemo(() => {
    // Combine transacciones reales + pagos virtuales de servicios
    const ingresosTransacciones = transacciones
      .filter(t => t.tipo === 'INGRESO')
      .reduce((s, t) => s + Number(t.valor), 0)

    const ingresosPagosLavadas = pagosLavadasPeriodo
      .reduce((s, p) => s + Number(p.valor), 0)

    const ingresos = ingresosTransacciones + ingresosPagosLavadas

    const egresos = transacciones
      .filter(t => t.tipo === 'EGRESO')
      .reduce((s, t) => s + Number(t.valor), 0)

    // Pendiente por colectar: sum(max(0, valor - sum(pagos))) for ALL services in period
    const porRecolectar = lavadasPeriodo.reduce((s, l) => {
      const totalValor = Number(l.valor || 0)
      const sumaPagos = (l.pagos || []).reduce((sp, p) => sp + Number(p.valor || 0), 0)
      return s + Math.max(0, totalValor - sumaPagos)
    }, 0)

    const clientesActivos = new Set(
      lavadasPeriodo.map(l => l.cliente_id).filter(Boolean)
    ).size

    const sinMem = lavadasPeriodo.filter(l => {
      const nombre = l.tipo_lavado?.nombre?.toUpperCase() || ''
      return nombre !== 'MEMBRESIA' && nombre !== 'MEMBRESÍA' && Number(l.valor) > 0
    })
    const ticketPromedio = sinMem.length > 0
      ? sinMem.reduce((s, l) => s + Number(l.valor), 0) / sinMem.length
      : 0

    // New clients in period
    const clientesNuevos = clientes.filter(c => {
      if (!c.created_at) return false
      const f = new Date(c.created_at)
      f.setHours(0, 0, 0, 0)
      return f >= desde
    }).length

    // Payment status counts
    let pagados = 0, sinPagar = 0, parcial = 0
    lavadasPeriodo.forEach(l => {
      const totalValor = Number(l.valor || 0)
      const sumaPagos = (l.pagos || []).reduce((sp, p) => sp + Number(p.valor || 0), 0)
      if (totalValor === 0 || sumaPagos >= totalValor) pagados++
      else if (sumaPagos > 0) parcial++
      else sinPagar++
    })

    return {
      lavadas: lavadasPeriodo.length,
      ingresos,
      egresos,
      porRecolectar,
      clientesActivos,
      ticketPromedio,
      pagados,
      sinPagar,
      parcial,
      clientesNuevos
    }
  }, [lavadasPeriodo, transacciones, pagosLavadasPeriodo, clientes, desde])

  // --- Charts ---

  // Donut: motos por estado in period
  const estadoData = useMemo(() => {
    const counts = {}
    lavadasPeriodo.forEach(l => {
      counts[l.estado] = (counts[l.estado] || 0) + 1
    })
    return Object.entries(counts).map(([name, value]) => ({
      name: ESTADO_LABELS[name] || name,
      value,
      color: ESTADO_COLORS[name] || '#666'
    }))
  }, [lavadasPeriodo])

  // Horizontal bars: lavadas por lavador in period
  const lavadorData = useMemo(() => {
    const counts = {}
    lavadasPeriodo.forEach(l => {
      const nombre = l.lavador?.nombre || 'Sin asignar'
      counts[nombre] = (counts[nombre] || 0) + 1
    })
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
  }, [lavadasPeriodo])

  // Generate virtual entries from ALL lavadas (not just period-filtered) for chart use
  const allPagosLavadas = useMemo(() => {
    return lavadas.flatMap(l => {
      const pagos = l.pagos || []
      if (pagos.length === 0) return []
      const fechaStr = l.fecha?.split('T')[0] || ''
      return pagos.map((p, idx) => ({
        tipo: 'INGRESO',
        valor: p.valor || 0,
        fecha: fechaStr
      }))
    })
  }, [lavadas])

  // Combined income sources for charts
  const allIngresos = useMemo(() => {
    const fromTrans = allTransacciones.filter(t => t.tipo === 'INGRESO')
    return [...fromTrans, ...allPagosLavadas]
  }, [allTransacciones, allPagosLavadas])

  // Vertical bars: ingresos breakdown by sub-periods
  const ingresosBarData = useMemo(() => {
    const result = []

    if (periodo === 'dia') {
      const desdeStr = desde.toISOString().split('T')[0]
      const total = allIngresos
        .filter(t => t.fecha === desdeStr || t.fecha?.startsWith(desdeStr))
        .reduce((s, t) => s + Number(t.valor), 0)
      return [{ name: 'Hoy', value: total }]
    } else if (periodo === 'semana') {
      for (let i = 0; i < 7; i++) {
        const d = new Date(desde)
        d.setDate(d.getDate() + i)
        const dStr = d.toISOString().split('T')[0]
        const total = allIngresos
          .filter(t => t.fecha === dStr || t.fecha?.startsWith(dStr))
          .reduce((s, t) => s + Number(t.valor), 0)
        result.push({ name: DAY_LABELS[d.getDay()], value: total })
      }
    } else if (periodo === 'mes') {
      const now = new Date()
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      for (let w = 0; w < 5; w++) {
        const startDay = w * 7 + 1
        const endDay = Math.min((w + 1) * 7, lastDay)
        if (startDay > lastDay) break
        const startStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`
        const endStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`
        const total = allIngresos
          .filter(t => {
            const f = t.fecha?.split('T')[0] || t.fecha
            return f >= startStr && f <= endStr
          })
          .reduce((s, t) => s + Number(t.valor), 0)
        result.push({ name: `S${w + 1}`, value: total })
      }
    } else if (periodo === 'ano') {
      const year = new Date().getFullYear()
      for (let m = 0; m < 12; m++) {
        const prefix = `${year}-${String(m + 1).padStart(2, '0')}`
        const total = allIngresos
          .filter(t => {
            const f = t.fecha?.split('T')[0] || t.fecha
            return f?.startsWith(prefix)
          })
          .reduce((s, t) => s + Number(t.valor), 0)
        result.push({ name: MONTH_LABELS[m], value: total })
      }
    }

    return result
  }, [periodo, desde, allIngresos])

  // --- Lists ---

  const topClientes = useMemo(() => {
    const counts = {}
    lavadasPeriodo.forEach(l => {
      const id = l.cliente_id
      if (!id) return
      if (!counts[id]) counts[id] = { nombre: l.cliente?.nombre || '?', count: 0, total: 0 }
      counts[id].count++
      counts[id].total += Number(l.valor || 0)
    })
    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 5)
  }, [lavadasPeriodo])

  const topServicios = useMemo(() => {
    const counts = {}
    lavadasPeriodo.forEach(l => {
      const nombre = l.tipo_lavado?.nombre || 'Sin tipo'
      counts[nombre] = (counts[nombre] || 0) + 1
    })
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [lavadasPeriodo])

  const tiempoEspera = useMemo(() => {
    const conEspera = lavadasPeriodo.filter(l => l.duracion_espera > 0)
    if (conEspera.length === 0) return { promedio: 0, max: 0, count: 0 }
    const total = conEspera.reduce((s, l) => s + l.duracion_espera, 0)
    const max = Math.max(...conEspera.map(l => l.duracion_espera))
    return {
      promedio: Math.round(total / conEspera.length),
      max,
      count: conEspera.length
    }
  }, [lavadasPeriodo])

  const formatSeg = (seg) => {
    if (seg < 60) return `${seg}s`
    const min = Math.floor(seg / 60)
    const s = seg % 60
    return s > 0 ? `${min}m ${s}s` : `${min}m`
  }

  if (loading || transLoading) {
    return <div className="loading">Cargando...</div>
  }

  const totalEstado = estadoData.reduce((s, d) => s + d.value, 0)

  const periodoLabel = PERIODO_LABELS[periodo]
  const ingresosChartTitle = periodo === 'dia' ? 'Ingresos del Día'
    : periodo === 'semana' ? 'Ingresos de la Semana'
    : periodo === 'mes' ? 'Ingresos del Mes'
    : 'Ingresos del Año'

  return (
    <div className="dash">
      <div className="dash-header">
        <h1 className="page-title">Dashboard</h1>
        <div className="dash-periodo-tabs">
          {['dia', 'semana', 'mes', 'ano'].map(p => (
            <button
              key={p}
              className={`dash-periodo-tab ${periodo === p ? 'active' : ''}`}
              onClick={() => setPeriodo(p)}
            >
              {PERIODO_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* FILA 1: KPIs */}
      <div className="dash-kpis">
        <div className="dash-kpi">
          <div className="dash-kpi-icon green"><Droplets size={18} /></div>
          <div className="dash-kpi-info">
            <span className="dash-kpi-label">Servicios</span>
            <span className="dash-kpi-value">{kpis.lavadas}</span>
          </div>
        </div>
        <div className="dash-kpi">
          <div className="dash-kpi-icon blue"><DollarSign size={18} /></div>
          <div className="dash-kpi-info">
            <span className="dash-kpi-label">Ingresos</span>
            <span className="dash-kpi-value">{formatMoney(kpis.ingresos)}</span>
          </div>
        </div>
        <div className="dash-kpi">
          <div className="dash-kpi-icon red"><TrendingDown size={18} /></div>
          <div className="dash-kpi-info">
            <span className="dash-kpi-label">Egresos</span>
            <span className="dash-kpi-value">{formatMoney(kpis.egresos)}</span>
          </div>
        </div>
        <div className="dash-kpi">
          <div className="dash-kpi-icon yellow"><Wallet size={18} /></div>
          <div className="dash-kpi-info">
            <span className="dash-kpi-label">Por Recolectar</span>
            <span className="dash-kpi-value">{formatMoney(kpis.porRecolectar)}</span>
          </div>
        </div>
        <div className="dash-kpi">
          <div className="dash-kpi-icon purple"><Users size={18} /></div>
          <div className="dash-kpi-info">
            <span className="dash-kpi-label">Clientes Activos</span>
            <span className="dash-kpi-value">{kpis.clientesActivos}</span>
          </div>
        </div>
        <div className="dash-kpi">
          <div className="dash-kpi-icon green"><Receipt size={18} /></div>
          <div className="dash-kpi-info">
            <span className="dash-kpi-label">Ticket Promedio</span>
            <span className="dash-kpi-value">{formatMoney(Math.round(kpis.ticketPromedio))}</span>
          </div>
        </div>
        <div className="dash-kpi">
          <div className="dash-kpi-icon green"><CheckCircle size={18} /></div>
          <div className="dash-kpi-info">
            <span className="dash-kpi-label">Pagados</span>
            <span className="dash-kpi-value">{kpis.pagados}</span>
          </div>
        </div>
        <div className="dash-kpi">
          <div className="dash-kpi-icon red"><XCircle size={18} /></div>
          <div className="dash-kpi-info">
            <span className="dash-kpi-label">Sin Pagar</span>
            <span className="dash-kpi-value">{kpis.sinPagar}{kpis.parcial > 0 ? ` (${kpis.parcial} parcial)` : ''}</span>
          </div>
        </div>
        <div className="dash-kpi">
          <div className="dash-kpi-icon blue"><UserPlus size={18} /></div>
          <div className="dash-kpi-info">
            <span className="dash-kpi-label">Clientes Nuevos</span>
            <span className="dash-kpi-value">{kpis.clientesNuevos}</span>
          </div>
        </div>
      </div>

      {/* FILA 2: Charts */}
      <div className="dash-charts">
        <div className="dash-chart-card">
          <h3 className="dash-chart-title">Motos por Estado</h3>
          {totalEstado === 0 ? (
            <div className="dash-chart-empty">Sin motos</div>
          ) : (
            <div className="dash-chart-donut-wrap">
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie
                    data={estadoData}
                    cx="50%"
                    cy="50%"
                    innerRadius="45%"
                    outerRadius="75%"
                    dataKey="value"
                    stroke="none"
                  >
                    {estadoData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="dash-donut-legend">
                {estadoData.map((d, i) => (
                  <div key={i} className="dash-donut-legend-item">
                    <span className="dash-donut-dot" style={{ background: d.color }} />
                    <span className="dash-donut-label">{d.name}</span>
                    <span className="dash-donut-count">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="dash-chart-card">
          <h3 className="dash-chart-title">Servicios por Lavador</h3>
          {lavadorData.length === 0 ? (
            <div className="dash-chart-empty">Sin datos</div>
          ) : (
            <div className="dash-chart-body">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={lavadorData} layout="vertical" margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={80}
                    tick={{ fill: CHART_THEME.axis, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{ background: CHART_THEME.tooltipBg, border: `1px solid ${CHART_THEME.tooltipBorder}`, borderRadius: 8, color: '#fff' }}
                    cursor={{ fill: CHART_THEME.cursorFill }}
                    formatter={(v) => [v, 'Servicios']}
                  />
                  <Bar dataKey="value" fill="#62B6CB" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="dash-chart-card">
          <h3 className="dash-chart-title">{ingresosChartTitle}</h3>
          <div className="dash-chart-body">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={ingresosBarData} margin={{ left: 0, right: 5, top: 5, bottom: 5 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fill: CHART_THEME.axis, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: CHART_THEME.axis, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={formatMoneyShort}
                  width={45}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }} />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={periodo === 'ano' ? 16 : 24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* FILA 3: Lists */}
      <div className="dash-lists">
        <div className="dash-list-card">
          <h3 className="dash-list-title">Top 5 Clientes</h3>
          {topClientes.length === 0 ? (
            <div className="dash-chart-empty">Sin datos</div>
          ) : (
            <div className="dash-list-items">
              {topClientes.map((c, i) => (
                <div key={i} className="dash-list-item">
                  <span className="dash-list-rank">#{i + 1}</span>
                  <span className="dash-list-name">{c.nombre}</span>
                  <span className="dash-list-detail">{c.count} servicios</span>
                  <span className="dash-list-value">{formatMoney(c.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dash-list-card">
          <h3 className="dash-list-title">Servicios Más Vendidos</h3>
          {topServicios.length === 0 ? (
            <div className="dash-chart-empty">Sin datos</div>
          ) : (
            <div className="dash-list-items">
              {topServicios.map((s, i) => (
                <div key={i} className="dash-list-item">
                  <span className="dash-list-rank">#{i + 1}</span>
                  <span className="dash-list-name">{s.name}</span>
                  <span className="dash-list-detail">{s.count} ventas</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dash-list-card">
          <h3 className="dash-list-title">Tiempo de Espera</h3>
          {tiempoEspera.count === 0 ? (
            <div className="dash-chart-empty">Sin datos de espera</div>
          ) : (
            <div className="dash-wait-stats">
              <div className="dash-wait-row">
                <span className="dash-wait-label">Promedio</span>
                <span className="dash-wait-value">{formatSeg(tiempoEspera.promedio)}</span>
              </div>
              <div className="dash-wait-row">
                <span className="dash-wait-label">Máximo</span>
                <span className="dash-wait-value">{formatSeg(tiempoEspera.max)}</span>
              </div>
              <div className="dash-wait-row">
                <span className="dash-wait-label">Motos atendidas</span>
                <span className="dash-wait-value">{tiempoEspera.count}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
