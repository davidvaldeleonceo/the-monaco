import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { useData } from './DataContext'
import {
  TrendingUp, TrendingDown
} from 'lucide-react'
import { formatMoney } from '../utils/money'

const PERIODO_MAP = { d: 'dia', s: 'semana', m: 'mes', a: 'ano' }

function getDateRange(periodo) {
  const desde = new Date()
  desde.setHours(0, 0, 0, 0)
  if (periodo === 'semana') {
    const day = desde.getDay()
    desde.setDate(desde.getDate() - (day === 0 ? 6 : day - 1))
  } else if (periodo === 'mes') {
    desde.setDate(1)
  } else if (periodo === 'ano') {
    desde.setMonth(0, 1)
  }
  return desde
}

const formatSeg = (seg) => {
  if (!seg || seg <= 0) return '—'
  if (seg < 60) return `${seg}s`
  const min = Math.floor(seg / 60)
  const s = seg % 60
  return s > 0 ? `${min}m ${s}s` : `${min}m`
}

export default function Dashboard() {
  const { lavadas, lavadores, loading } = useData()
  const [allTransacciones, setAllTransacciones] = useState([])
  const [transLoading, setTransLoading] = useState(true)
  const [periodo, setPeriodo] = useState('d')
  const [expanded, setExpanded] = useState(null)

  const periodIdx = ['d', 's', 'm', 'a'].indexOf(periodo)

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

  const periodoKey = PERIODO_MAP[periodo]
  const desde = useMemo(() => getDateRange(periodoKey), [periodoKey])

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

  // Virtual income from lavada payments
  const pagosLavadasPeriodo = useMemo(() => {
    return lavadasPeriodo.flatMap(l => {
      const pagos = l.pagos || []
      return pagos.map((p, idx) => ({
        id: `lavada-${l.id}-${idx}`,
        tipo: 'INGRESO',
        categoria: 'SERVICIO',
        valor: p.valor || 0,
        metodo: p.nombre || 'Sin método',
        fecha: l.fecha,
      }))
    })
  }, [lavadasPeriodo])

  // === KPIs ===
  const stats = useMemo(() => {
    const ingresosTransacciones = transacciones
      .filter(t => t.tipo === 'INGRESO')
      .reduce((s, t) => s + Number(t.valor), 0)
    const ingresosPagos = pagosLavadasPeriodo.reduce((s, p) => s + Number(p.valor), 0)
    const ingresos = ingresosTransacciones + ingresosPagos
    const egresos = transacciones
      .filter(t => t.tipo === 'EGRESO')
      .reduce((s, t) => s + Number(t.valor), 0)
    const balance = ingresos - egresos

    // Total lavadas
    const totalLavadas = lavadasPeriodo.length

    // Desglose por tipo de servicio (for expanded)
    const porTipo = {}
    lavadasPeriodo.forEach(l => {
      const nombre = l.tipo_lavado?.nombre || 'Sin tipo'
      porTipo[nombre] = (porTipo[nombre] || 0) + 1
    })
    const desgloseTipos = Object.entries(porTipo)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    // Ticket promedio (excl membresías)
    const sinMem = lavadasPeriodo.filter(l => {
      const nombre = l.tipo_lavado?.nombre?.toUpperCase() || ''
      return nombre !== 'MEMBRESIA' && nombre !== 'MEMBRESÍA' && Number(l.valor) > 0
    })
    const ticketPromedio = sinMem.length > 0
      ? sinMem.reduce((s, l) => s + Number(l.valor), 0) / sinMem.length
      : 0
    const ticketMin = sinMem.length > 0 ? Math.min(...sinMem.map(l => Number(l.valor))) : 0
    const ticketMax = sinMem.length > 0 ? Math.max(...sinMem.map(l => Number(l.valor))) : 0

    // Ticket promedio por tipo (for expanded)
    const ticketPorTipo = {}
    sinMem.forEach(l => {
      const nombre = l.tipo_lavado?.nombre || 'Sin tipo'
      if (!ticketPorTipo[nombre]) ticketPorTipo[nombre] = { total: 0, count: 0 }
      ticketPorTipo[nombre].total += Number(l.valor)
      ticketPorTipo[nombre].count++
    })
    const desgloseTicket = Object.entries(ticketPorTipo)
      .map(([name, d]) => ({ name, promedio: Math.round(d.total / d.count), count: d.count }))
      .sort((a, b) => b.promedio - a.promedio)

    // Tiempos
    const conEspera = lavadasPeriodo.filter(l => l.duracion_espera > 0)
    const conLavado = lavadasPeriodo.filter(l => l.duracion_lavado > 0)
    const tiempoEspera = conEspera.length > 0
      ? { promedio: Math.round(conEspera.reduce((s, l) => s + l.duracion_espera, 0) / conEspera.length), max: Math.max(...conEspera.map(l => l.duracion_espera)), count: conEspera.length }
      : { promedio: 0, max: 0, count: 0 }
    const tiempoLavado = conLavado.length > 0
      ? { promedio: Math.round(conLavado.reduce((s, l) => s + l.duracion_lavado, 0) / conLavado.length), max: Math.max(...conLavado.map(l => l.duracion_lavado)), count: conLavado.length }
      : { promedio: 0, max: 0, count: 0 }

    // Lavador stats
    const lavadorMap = {}
    lavadasPeriodo.forEach(l => {
      const id = l.lavador_id || 'sin'
      const nombre = l.lavador?.nombre || 'Sin asignar'
      if (!lavadorMap[id]) lavadorMap[id] = { nombre, count: 0, total: 0 }
      lavadorMap[id].count++
      lavadorMap[id].total += Number(l.valor || 0)
    })
    const lavadorRanking = Object.values(lavadorMap)
      .sort((a, b) => b.count - a.count)

    // Balance desglose by ingresos/egresos categories (for expanded)
    const ingresosPorCat = {}
    pagosLavadasPeriodo.forEach(p => {
      ingresosPorCat['Servicios'] = (ingresosPorCat['Servicios'] || 0) + Number(p.valor)
    })
    transacciones.filter(t => t.tipo === 'INGRESO').forEach(t => {
      const cat = t.categoria || 'Otro'
      ingresosPorCat[cat] = (ingresosPorCat[cat] || 0) + Number(t.valor)
    })
    const egresosPorCat = {}
    transacciones.filter(t => t.tipo === 'EGRESO').forEach(t => {
      const cat = t.categoria || 'Otro'
      egresosPorCat[cat] = (egresosPorCat[cat] || 0) + Number(t.valor)
    })

    return {
      ingresos, egresos, balance,
      totalLavadas, desgloseTipos,
      ticketPromedio, ticketMin, ticketMax, desgloseTicket, cantidadTicket: sinMem.length,
      tiempoEspera, tiempoLavado,
      lavadorRanking,
      ingresosPorCat: Object.entries(ingresosPorCat).sort((a, b) => b[1] - a[1]),
      egresosPorCat: Object.entries(egresosPorCat).sort((a, b) => b[1] - a[1]),
    }
  }, [lavadasPeriodo, transacciones, pagosLavadasPeriodo])

  const toggle = (key) => setExpanded(prev => prev === key ? null : key)

  if (loading || transLoading) {
    return <div className="loading">Cargando...</div>
  }

  return (
    <div className="dash-v2">
      {/* Period Pills */}
      <div className="dash-v2-period">
        <div className="home-period-pills">
          <div className="home-period-bubble" style={{ transform: `translateX(${periodIdx * 100}%)` }} />
          {['d', 's', 'm', 'a'].map(p => (
            <button
              key={p}
              className={`home-period-pill ${periodo === p ? 'active' : ''}`}
              onClick={() => setPeriodo(p)}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Balance Card */}
      <div className={`dash-v2-card dash-v2-balance ${expanded === 'balance' ? 'expanded' : ''}`} onClick={() => toggle('balance')}>
        <span className="dash-v2-balance-title">Balance</span>
        <div className={`dash-v2-balance-value ${stats.balance >= 0 ? 'positive' : 'negative'}`}>
          {formatMoney(stats.balance)}
        </div>
        <div className="dash-v2-balance-row">
          <div className="dash-v2-balance-item">
            <TrendingUp size={16} className="positive" />
            <span className="dash-v2-balance-subvalue positive">{formatMoney(stats.ingresos)}</span>
          </div>
          <div className="dash-v2-balance-item">
            <TrendingDown size={16} className="negative" />
            <span className="dash-v2-balance-subvalue negative">{formatMoney(stats.egresos)}</span>
          </div>
        </div>
        {expanded === 'balance' && (
          <div className="dash-v2-expand">
            {stats.ingresosPorCat.length > 0 && (
              <>
                <p className="dash-v2-expand-title">Ingresos por categoría</p>
                {stats.ingresosPorCat.map(([cat, val]) => (
                  <div key={cat} className="dash-v2-expand-row">
                    <span>{cat}</span>
                    <span className="positive">{formatMoney(val)}</span>
                  </div>
                ))}
              </>
            )}
            {stats.egresosPorCat.length > 0 && (
              <>
                <p className="dash-v2-expand-title">Egresos por categoría</p>
                {stats.egresosPorCat.map(([cat, val]) => (
                  <div key={cat} className="dash-v2-expand-row">
                    <span>{cat}</span>
                    <span className="negative">{formatMoney(val)}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Two Column Grid */}
      <div className="dash-v2-grid">
        {/* LEFT COLUMN */}
        <div className="dash-v2-col">
          {/* Lavadas */}
          <div className={`dash-v2-card ${expanded === 'lavadas' ? 'expanded' : ''}`} onClick={() => toggle('lavadas')}>
            <span className="dash-v2-card-title">Lavadas</span>
            <span className="dash-v2-big-number">{stats.totalLavadas}</span>
            {expanded === 'lavadas' && (
              <div className="dash-v2-expand">
                <p className="dash-v2-expand-title">Por tipo de servicio</p>
                {stats.desgloseTipos.length === 0 ? (
                  <p className="dash-v2-expand-empty">Sin datos</p>
                ) : (
                  stats.desgloseTipos.map(t => (
                    <div key={t.name} className="dash-v2-expand-row">
                      <span>{t.name}</span>
                      <span className="dash-v2-expand-count">{t.count}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Tiempos */}
          <div className={`dash-v2-card ${expanded === 'tiempos' ? 'expanded' : ''}`} onClick={() => toggle('tiempos')}>
            <span className="dash-v2-card-title">Tiempos</span>
            <div className="dash-v2-tiempos-summary">
              <div className="dash-v2-tiempo-item">
                <span className="dash-v2-tiempo-label">Espera</span>
                <span className="dash-v2-tiempo-val">{formatSeg(stats.tiempoEspera.promedio)}</span>
              </div>
              <div className="dash-v2-tiempo-divider" />
              <div className="dash-v2-tiempo-item">
                <span className="dash-v2-tiempo-label">Lavado</span>
                <span className="dash-v2-tiempo-val">{formatSeg(stats.tiempoLavado.promedio)}</span>
              </div>
            </div>
            {expanded === 'tiempos' && (
              <div className="dash-v2-expand">
                <p className="dash-v2-expand-title">Tiempo de espera</p>
                <div className="dash-v2-expand-row"><span>Promedio</span><span>{formatSeg(stats.tiempoEspera.promedio)}</span></div>
                <div className="dash-v2-expand-row"><span>Máximo</span><span>{formatSeg(stats.tiempoEspera.max)}</span></div>
                <div className="dash-v2-expand-row"><span>Mediciones</span><span>{stats.tiempoEspera.count}</span></div>
                <p className="dash-v2-expand-title">Tiempo de lavado</p>
                <div className="dash-v2-expand-row"><span>Promedio</span><span>{formatSeg(stats.tiempoLavado.promedio)}</span></div>
                <div className="dash-v2-expand-row"><span>Máximo</span><span>{formatSeg(stats.tiempoLavado.max)}</span></div>
                <div className="dash-v2-expand-row"><span>Mediciones</span><span>{stats.tiempoLavado.count}</span></div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="dash-v2-col">
          {/* Ticket Promedio */}
          <div className={`dash-v2-card ${expanded === 'ticket' ? 'expanded' : ''}`} onClick={() => toggle('ticket')}>
            <span className="dash-v2-card-title">Ticket Prom.</span>
            <span className="dash-v2-big-number">{formatMoney(Math.round(stats.ticketPromedio))}</span>
            {expanded === 'ticket' && (
              <div className="dash-v2-expand">
                <div className="dash-v2-expand-row"><span>Mínimo</span><span>{formatMoney(stats.ticketMin)}</span></div>
                <div className="dash-v2-expand-row"><span>Máximo</span><span>{formatMoney(stats.ticketMax)}</span></div>
                <div className="dash-v2-expand-row"><span>Servicios</span><span>{stats.cantidadTicket}</span></div>
                {stats.desgloseTicket.length > 0 && (
                  <>
                    <p className="dash-v2-expand-title">Por tipo de servicio</p>
                    {stats.desgloseTicket.map(t => (
                      <div key={t.name} className="dash-v2-expand-row">
                        <span>{t.name} ({t.count})</span>
                        <span>{formatMoney(t.promedio)}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Carga por Trabajador */}
          <div className={`dash-v2-card ${expanded === 'trabajadores' ? 'expanded' : ''}`} onClick={() => toggle('trabajadores')}>
            <span className="dash-v2-card-title">Trabajadores</span>
            <div className="dash-v2-ranking">
              {stats.lavadorRanking.slice(0, 3).map((w, i) => (
                <div key={i} className="dash-v2-rank-item">
                  <span className="dash-v2-rank-pos">#{i + 1}</span>
                  <span className="dash-v2-rank-name">{w.nombre}</span>
                  <span className="dash-v2-rank-count">{w.count}</span>
                </div>
              ))}
              {stats.lavadorRanking.length === 0 && (
                <span className="dash-v2-empty-text">Sin datos</span>
              )}
            </div>
            {expanded === 'trabajadores' && stats.lavadorRanking.length > 0 && (
              <div className="dash-v2-expand">
                <p className="dash-v2-expand-title">Ranking completo</p>
                {stats.lavadorRanking.map((w, i) => {
                  const maxCount = stats.lavadorRanking[0]?.count || 1
                  return (
                    <div key={i} className="dash-v2-worker-detail">
                      <div className="dash-v2-expand-row">
                        <span>#{i + 1} {w.nombre}</span>
                        <span>{w.count} lavadas · {formatMoney(w.total)}</span>
                      </div>
                      <div className="dash-v2-bar-track">
                        <div
                          className="dash-v2-bar-fill"
                          style={{ width: `${(w.count / maxCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
