import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { useTenant } from './TenantContext'
import { FileText, FileSpreadsheet } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { registerLocale } from 'react-datepicker'
import es from 'date-fns/locale/es'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts'

registerLocale('es', es)

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const COLORES = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

function fechaLocalStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function fmtFecha(date) {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
}
const fmt = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v)
const fmtCorto = (v) => { if (v >= 1e6) return `$${(v/1e6).toFixed(1)}M`; if (v >= 1e3) return `$${(v/1e3).toFixed(0)}K`; return `$${v}` }
const pct = (v, t) => t > 0 ? `${((v / t) * 100).toFixed(1)}%` : '0%'
const pctNum = (v, t) => t > 0 ? ((v / t) * 100).toFixed(1) : 0

const ChartTooltip = ({ active, payload, label, formatter }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.stroke || p.fill }}>
          {p.name}: {formatter ? formatter(p.value) : p.value}
        </p>
      ))}
    </div>
  )
}
const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return <div className="chart-tooltip"><p style={{ color: d.payload.fill }}>{d.name}: {fmt(d.value)} ({d.payload.porcentaje}%)</p></div>
}

export default function Reportes() {
  const { negocioNombre } = useTenant()
  const hoyInit = new Date(); hoyInit.setHours(0,0,0,0)

  const [fechaDesde, setFechaDesde] = useState(new Date(hoyInit.getFullYear(), hoyInit.getMonth(), 1))
  const [fechaHasta, setFechaHasta] = useState(new Date(hoyInit.getFullYear(), hoyInit.getMonth() + 1, 0))
  const [filtroRapido, setFiltroRapido] = useState('mes')
  const [tabActivo, setTabActivo] = useState(0)
  const [data, setData] = useState(null)
  const [cargando, setCargando] = useState(false)
  const chartsRef = useRef(null)

  useEffect(() => { if (fechaDesde && fechaHasta) fetchAll() }, [fechaDesde, fechaHasta])

  const aplicarFiltroRapido = (tipo) => {
    setFiltroRapido(tipo)
    const hoy = new Date(); hoy.setHours(0,0,0,0)
    switch (tipo) {
      case 'hoy': setFechaDesde(hoy); setFechaHasta(hoy); break
      case 'semana': {
        const ini = new Date(hoy); const d = hoy.getDay()
        ini.setDate(hoy.getDate() - (d === 0 ? 6 : d - 1))
        const fin = new Date(ini); fin.setDate(ini.getDate() + 6)
        setFechaDesde(ini); setFechaHasta(fin); break
      }
      case 'mes': setFechaDesde(new Date(hoy.getFullYear(), hoy.getMonth(), 1)); setFechaHasta(new Date(hoy.getFullYear(), hoy.getMonth()+1, 0)); break
      case 'año': setFechaDesde(new Date(hoy.getFullYear(), 0, 1)); setFechaHasta(new Date(hoy.getFullYear(), 11, 31)); break
      default: break
    }
  }

  const getTitulo = () => {
    if (!fechaDesde || !fechaHasta) return 'REPORTE'
    if (fechaDesde.getMonth() === fechaHasta.getMonth() && fechaDesde.getFullYear() === fechaHasta.getFullYear())
      return `REPORTE ${MESES[fechaDesde.getMonth()].toUpperCase()} ${fechaDesde.getFullYear()}`
    return `REPORTE ${fmtFecha(fechaDesde)} - ${fmtFecha(fechaHasta)}`
  }
  const getRangoStr = () => (!fechaDesde || !fechaHasta) ? '' : `DESDE: ${fmtFecha(fechaDesde)} - HASTA: ${fmtFecha(fechaHasta)}`

  const fetchAll = async () => {
    if (!fechaDesde || !fechaHasta) return
    setCargando(true)

    const desdeStr = fechaLocalStr(fechaDesde)
    const hasta = new Date(fechaHasta); hasta.setDate(hasta.getDate() + 1)
    const hastaStr = fechaLocalStr(hasta)

    // Previous month range
    const mesAntDesde = new Date(fechaDesde.getFullYear(), fechaDesde.getMonth() - 1, 1)
    const mesAntHasta = new Date(fechaDesde.getFullYear(), fechaDesde.getMonth(), 0)
    const maDesdeStr = fechaLocalStr(mesAntDesde)
    const maH = new Date(mesAntHasta); maH.setDate(maH.getDate() + 1)
    const maHastaStr = fechaLocalStr(maH)

    // 6-month historical range (single query each)
    const meses6 = []
    for (let i = 5; i >= 0; i--) { const d = new Date(fechaHasta.getFullYear(), fechaHasta.getMonth() - i, 1); meses6.push({ year: d.getFullYear(), month: d.getMonth() }) }
    const hist6Desde = `${meses6[0].year}-${String(meses6[0].month+1).padStart(2,'0')}-01`
    const hist6HastaD = new Date(meses6[5].year, meses6[5].month+1, 1)
    const hist6Hasta = fechaLocalStr(hist6HastaD)

    // ALL queries in parallel: 6 total instead of 16
    const [lavadasRes, transRes, lavAntRes, transAntRes, lavHistRes, transHistRes] = await Promise.all([
      supabase.from('lavadas').select('*, tipo_lavado:tipos_lavado(nombre), lavador:lavadores(nombre), metodo_pago:metodos_pago(nombre)').gte('fecha', desdeStr).lt('fecha', hastaStr),
      supabase.from('transacciones').select('*').gte('fecha', desdeStr).lt('fecha', hastaStr),
      supabase.from('lavadas').select('valor').gte('fecha', maDesdeStr).lt('fecha', maHastaStr),
      supabase.from('transacciones').select('tipo, valor').gte('fecha', maDesdeStr).lt('fecha', maHastaStr),
      supabase.from('lavadas').select('valor, fecha').gte('fecha', hist6Desde).lt('fecha', hist6Hasta),
      supabase.from('transacciones').select('tipo, valor, fecha').gte('fecha', hist6Desde).lt('fecha', hist6Hasta),
    ])

    const lavadas = lavadasRes.data || []
    const trans = transRes.data || []

    // --- Tab 1: Ventas ---
    const lavMem = lavadas.filter(l => l.tipo_lavado?.nombre === 'MEMBRESIA')
    const lavInd = lavadas.filter(l => l.tipo_lavado?.nombre !== 'MEMBRESIA')
    const totalInd = lavInd.reduce((s,l) => s + Number(l.valor||0), 0)
    const totalAdicMem = lavMem.reduce((s,l) => s + Number(l.valor||0), 0)
    const ingresosTrans = trans.filter(t => t.tipo === 'INGRESO').reduce((s,t) => s + Number(t.valor||0), 0)
    const egresosTrans = trans.filter(t => t.tipo === 'EGRESO').reduce((s,t) => s + Number(t.valor||0), 0)
    const totalVentas = totalInd + totalAdicMem + ingresosTrans
    const balance = totalVentas - egresosTrans
    const cInd = lavInd.length, cMem = lavMem.length, cTotal = lavadas.length

    const ventas = {
      totalVentas, totalInd, totalAdicMem, ingresosTrans, totalEgresos: egresosTrans, balance,
      cInd, cMem, cTotal,
      ticketSin: cInd > 0 ? totalInd / cInd : 0,
      ticketCon: cMem > 0 ? totalAdicMem / cMem : 0,
      ticketTotal: cTotal > 0 ? (totalInd + totalAdicMem) / cTotal : 0,
    }

    // Charts Tab 1
    const ventasPorDia = {}
    lavadas.forEach(l => { const d = new Date(l.fecha).getDate(); ventasPorDia[d] = (ventasPorDia[d]||0) + Number(l.valor||0) })
    const dias = Math.min(Math.ceil((fechaHasta - fechaDesde) / 864e5) + 1, 366)
    const ventasDiarias = []
    for (let i = 0; i < dias; i++) { const d = new Date(fechaDesde); d.setDate(d.getDate()+i); const dia = d.getDate(); ventasDiarias.push({ dia: String(dia), ventas: ventasPorDia[dia]||0 }) }

    const lavadorMap = {}
    lavadas.forEach(l => { const n = l.lavador?.nombre || 'Sin asignar'; if (!lavadorMap[n]) lavadorMap[n] = { nombre: n, cantidad: 0, total: 0 }; lavadorMap[n].cantidad++; lavadorMap[n].total += Number(l.valor||0) })
    const rendLavadores = Object.values(lavadorMap).sort((a,b) => b.cantidad - a.cantidad)

    const totalTipos = cInd + cMem
    const tiposLavado = [
      { name: 'Individuales', value: cInd, porcentaje: pctNum(cInd, totalTipos) },
      { name: 'Membresía', value: cMem, porcentaje: pctNum(cMem, totalTipos) },
    ]

    const adicMap = {}
    lavadas.forEach(l => (l.adicionales||[]).forEach(a => { const n = a.nombre || a; adicMap[n] = (adicMap[n]||0)+1 }))
    const adicionales = Object.entries(adicMap).map(([nombre, cantidad]) => ({ nombre, cantidad })).sort((a,b) => b.cantidad - a.cantidad)

    const pagoMap = {}
    lavadas.forEach(l => {
      const pagos = l.pagos || []
      if (pagos.length > 0) pagos.forEach(p => { const n = p.nombre||'Otro'; pagoMap[n] = (pagoMap[n]||0) + Number(p.valor||0) })
      else if (l.metodo_pago?.nombre) pagoMap[l.metodo_pago.nombre] = (pagoMap[l.metodo_pago.nombre]||0) + Number(l.valor||0)
    })
    const totalPagos = Object.values(pagoMap).reduce((s,v) => s+v, 0)
    const metodosPago = Object.entries(pagoMap).map(([name, value]) => ({ name, value, porcentaje: pctNum(value, totalPagos) })).sort((a,b) => b.value - a.value)

    const ticketData = [
      { nombre: 'Sin membresía', valor: ventas.ticketSin },
      { nombre: 'Con membresía', valor: ventas.ticketCon },
      { nombre: 'General', valor: ventas.ticketTotal },
    ]

    // --- Tab 2: Ingresos y Egresos ---
    const ingMembresias = trans.filter(t => t.tipo === 'INGRESO' && t.categoria === 'MEMBRESIA').reduce((s,t) => s + Number(t.valor||0), 0)
    const ingAdicional = trans.filter(t => t.tipo === 'INGRESO' && t.categoria === 'ADICIONAL').reduce((s,t) => s + Number(t.valor||0), 0)
    const ingOtros = trans.filter(t => t.tipo === 'INGRESO' && !['MEMBRESIA','ADICIONAL','SERVICIO','LAVADA'].includes(t.categoria)).reduce((s,t) => s + Number(t.valor||0), 0)
    const ingLavadas = trans.filter(t => t.tipo === 'INGRESO' && (t.categoria === 'SERVICIO' || t.categoria === 'LAVADA')).reduce((s,t) => s + Number(t.valor||0), 0)
    const totalIngresos = totalInd + totalAdicMem + ingresosTrans

    const egCats = {}
    trans.filter(t => t.tipo === 'EGRESO').forEach(t => { const c = t.categoria || 'OTRO'; egCats[c] = (egCats[c]||0) + Number(t.valor||0) })
    const egresosDetalle = Object.entries(egCats).map(([cat, valor]) => ({ categoria: cat, valor })).sort((a,b) => b.valor - a.valor)

    const margen = totalIngresos > 0 ? ((balance / totalIngresos) * 100).toFixed(1) : 0

    const ingresos = { lavInd: totalInd, adicMem: totalAdicMem, membresias: ingMembresias, adicTrans: ingAdicional, lavTrans: ingLavadas, otros: ingOtros, total: totalIngresos }

    // Chart: ingresos vs egresos diarios
    const ingDia = {}, egDia = {}
    lavadas.forEach(l => { const d = new Date(l.fecha).getDate(); ingDia[d] = (ingDia[d]||0) + Number(l.valor||0) })
    trans.forEach(t => {
      const d = new Date(t.fecha).getDate()
      if (t.tipo === 'INGRESO') ingDia[d] = (ingDia[d]||0) + Number(t.valor||0)
      else egDia[d] = (egDia[d]||0) + Number(t.valor||0)
    })
    const ingEgDiario = []
    for (let i = 0; i < dias; i++) { const d = new Date(fechaDesde); d.setDate(d.getDate()+i); const dia = d.getDate(); ingEgDiario.push({ dia: String(dia), ingresos: ingDia[dia]||0, egresos: egDia[dia]||0 }) }

    const ingPie = [
      { name: 'Individuales', value: totalInd, porcentaje: pctNum(totalInd, totalIngresos) },
      { name: 'Adicionales membresía', value: totalAdicMem, porcentaje: pctNum(totalAdicMem, totalIngresos) },
      { name: 'Membresías', value: ingMembresias, porcentaje: pctNum(ingMembresias, totalIngresos) },
      { name: 'Otros', value: ingOtros + ingAdicional + ingLavadas, porcentaje: pctNum(ingOtros + ingAdicional + ingLavadas, totalIngresos) },
    ].filter(d => d.value > 0)

    const egPie = egresosDetalle.map(e => ({ name: e.categoria, value: e.valor, porcentaje: pctNum(e.valor, egresosTrans) }))

    // --- Tab 3: Reporte Total ---
    // Previous month (already fetched in parallel)
    const lavAnt = lavAntRes.data || []
    const transAnt = transAntRes.data || []
    const ventasAnt = lavAnt.reduce((s,l) => s + Number(l.valor||0), 0) + transAnt.filter(t => t.tipo === 'INGRESO').reduce((s,t) => s + Number(t.valor||0), 0)
    const egresosAnt = transAnt.filter(t => t.tipo === 'EGRESO').reduce((s,t) => s + Number(t.valor||0), 0)
    const balanceAnt = ventasAnt - egresosAnt
    const cantAnt = lavAnt.length

    const cambio = (actual, anterior) => anterior > 0 ? (((actual - anterior) / anterior) * 100).toFixed(1) : actual > 0 ? 100 : 0

    const comparativa = {
      ventas: cambio(totalVentas, ventasAnt),
      lavadas: cambio(cTotal, cantAnt),
      balance: cambio(balance, balanceAnt),
    }

    // Top 5 días ventas
    const ventasDiaMap = {}
    lavadas.forEach(l => {
      const fStr = l.fecha?.split('T')[0] || ''
      ventasDiaMap[fStr] = (ventasDiaMap[fStr]||0) + Number(l.valor||0)
    })
    const topDias = Object.entries(ventasDiaMap).map(([fecha, total]) => ({ fecha, total })).sort((a,b) => b.total - a.total).slice(0, 5)

    // Top 3 lavadores por ingresos
    const topLavadores = [...rendLavadores].sort((a,b) => b.total - a.total).slice(0, 3)

    // Top 3 adicionales
    const topAdicionales = adicionales.slice(0, 3)

    // 6 months: group historical data by month in JS (no extra queries)
    const lavHist = lavHistRes.data || []
    const transHist = transHistRes.data || []

    const tend6 = meses6.map(({ year, month }) => {
      const prefix = `${year}-${String(month+1).padStart(2,'0')}`
      const lavMes = lavHist.filter(l => (l.fecha || '').startsWith(prefix))
      const trsMes = transHist.filter(t => (t.fecha || '').startsWith(prefix))
      const ing = lavMes.reduce((s,l) => s + Number(l.valor||0), 0) + trsMes.filter(t => t.tipo === 'INGRESO').reduce((s,t) => s + Number(t.valor||0), 0)
      const eg = trsMes.filter(t => t.tipo === 'EGRESO').reduce((s,t) => s + Number(t.valor||0), 0)
      const cnt = lavMes.length
      return { mes: MESES[month].substring(0,3), ingresos: ing, egresos: eg, balance: ing - eg, ticket: cnt > 0 ? ing / cnt : 0 }
    })

    // Ranking lavadores por ingresos
    const rankLavadores = [...rendLavadores].sort((a,b) => b.total - a.total)

    setData({
      ventas, ingresos, egresosDetalle, egresosTrans, margen, balance, totalIngresos,
      // Tab 1 charts
      ventasDiarias, rendLavadores, tiposLavado, adicionales, metodosPago, ticketData,
      // Tab 2 charts
      ingEgDiario, ingPie, egPie,
      // Tab 3
      comparativa, topDias, topLavadores, topAdicionales, tend6, rankLavadores,
      cTotal,
    })
    setCargando(false)
  }

  // --- Render helpers ---
  const renderLabel = ({ name, porcentaje }) => porcentaje > 0 ? `${name} ${porcentaje}%` : ''

  // --- PDF ---
  const descargarPDF = () => {
    if (!data) return
    const doc = new jsPDF('p', 'mm', 'a4')
    const W = 210, H = 297, M = 20
    const cVerde = [16, 185, 129], cRojo = [239, 68, 68]
    const cGrisOscuro = [31, 41, 55], cGrisMedio = [107, 114, 128]
    const cGrisClaro = [249, 250, 251]

    const addHeaderFooter = (pageNum, total) => {
      doc.setDrawColor(...cVerde); doc.setLineWidth(0.8)
      doc.line(M, 12, W - M, 12)
      doc.setFontSize(8); doc.setTextColor(...cGrisMedio)
      doc.text(negocioNombre || 'Monaco', M, 10)
      doc.text(getTitulo(), W - M, 10, { align: 'right' })
      doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.3)
      doc.line(M, H - 15, W - M, H - 15)
      doc.setFontSize(8); doc.setTextColor(...cGrisMedio)
      doc.text(`Página ${pageNum} de ${total}`, W / 2, H - 10, { align: 'center' })
      doc.text(new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }), W - M, H - 10, { align: 'right' })
    }

    const seccionTitulo = (titulo, y) => {
      doc.setFillColor(...cVerde); doc.rect(M, y - 1, 4, 9, 'F')
      doc.setFontSize(16); doc.setFont(undefined, 'bold'); doc.setTextColor(...cGrisOscuro)
      doc.text(titulo, M + 8, y + 6)
      return y + 14
    }

    const ts = {
      theme: 'grid',
      headStyles: { fillColor: cGrisOscuro, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10, cellPadding: 4 },
      styles: { fontSize: 10, cellPadding: 4 },
      alternateRowStyles: { fillColor: cGrisClaro },
      margin: { left: M, right: M }
    }
    const col3 = { 0: { cellWidth: 90 }, 1: { halign: 'right', cellWidth: 45 }, 2: { halign: 'center', cellWidth: 25 } }

    const sign = v => Number(v) >= 0 ? `+${v}%` : `${v}%`

    // ===== PAGE 1: COVER =====
    doc.setFillColor(...cVerde); doc.rect(0, 0, W, 5, 'F')
    doc.setFontSize(36); doc.setFont(undefined, 'bold'); doc.setTextColor(...cGrisOscuro)
    doc.text(negocioNombre || 'Monaco', W / 2, 85, { align: 'center' })
    doc.setFontSize(18); doc.setFont(undefined, 'normal'); doc.setTextColor(...cGrisMedio)
    doc.text('Reporte de Gestión', W / 2, 96, { align: 'center' })
    doc.setDrawColor(...cVerde); doc.setLineWidth(1.2)
    doc.line(W / 2 - 35, 108, W / 2 + 35, 108)
    doc.setFontSize(22); doc.setFont(undefined, 'bold'); doc.setTextColor(...cGrisOscuro)
    doc.text('REPORTE DE GANANCIAS', W / 2, 130, { align: 'center' })
    doc.setFontSize(13); doc.setFont(undefined, 'normal'); doc.setTextColor(...cGrisMedio)
    doc.text(getRangoStr(), W / 2, 145, { align: 'center' })
    doc.setFontSize(11)
    doc.text(`Generado el ${new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`, W / 2, 160, { align: 'center' })
    doc.setFillColor(...cVerde); doc.rect(0, H - 5, W, 5, 'F')

    // ===== PAGE 2: EXECUTIVE SUMMARY =====
    doc.addPage()
    let y = seccionTitulo('Resumen Ejecutivo', M + 5)

    autoTable(doc, {
      ...ts, startY: y,
      head: [['Indicador', 'Valor', 'vs Mes Anterior']],
      body: [
        ['Total Ventas', fmt(data.ventas.totalVentas), sign(data.comparativa.ventas)],
        ['Total Egresos', fmt(data.egresosTrans), ''],
        ['Balance Neto', fmt(data.balance), sign(data.comparativa.balance)],
        ['Margen de Ganancia', `${data.margen}%`, ''],
        ['Total Servicios', String(data.cTotal), sign(data.comparativa.lavadas)],
        ['Ticket Promedio', fmt(data.ventas.ticketTotal), ''],
      ],
      columnStyles: { 0: { cellWidth: 80 }, 1: { halign: 'right', cellWidth: 50 }, 2: { halign: 'center', cellWidth: 35 } },
      didParseCell: (d) => {
        if (d.section !== 'body') return
        if (d.column.index === 1) {
          if (d.row.index === 0) d.cell.styles.textColor = cVerde
          if (d.row.index === 1) d.cell.styles.textColor = cRojo
          if (d.row.index === 2) { d.cell.styles.fontStyle = 'bold'; d.cell.styles.textColor = data.balance >= 0 ? cVerde : cRojo }
          if (d.row.index === 3) d.cell.styles.textColor = Number(data.margen) >= 0 ? cVerde : cRojo
        }
        if (d.column.index === 2 && d.cell.text[0]) {
          d.cell.styles.textColor = d.cell.text[0].startsWith('+') ? cVerde : cRojo
        }
      }
    })

    // ===== PAGE 3: INCOME DETAILS =====
    doc.addPage()
    y = seccionTitulo('Detalle de Ingresos', M + 5)

    autoTable(doc, {
      ...ts, startY: y, columnStyles: col3,
      head: [['Concepto', 'Valor', '%']],
      body: getIngresosRows(),
      didParseCell: (d) => {
        if (d.section === 'body' && d.row.index === d.table.body.length - 1) {
          d.cell.styles.fontStyle = 'bold'; d.cell.styles.textColor = cVerde
        }
      }
    })
    y = doc.lastAutoTable.finalY + 12

    // Payment methods
    const totalPagos = Object.values(data.metodosPago).reduce((s, m) => s + m.value, 0)
    if (data.metodosPago.length > 0) {
      doc.setFontSize(13); doc.setFont(undefined, 'bold'); doc.setTextColor(...cGrisOscuro)
      doc.text('Desglose por Método de Pago', M, y); y += 6

      const metRows = data.metodosPago.map(m => [m.name, fmt(m.value), `${m.porcentaje}%`])
      metRows.push(['TOTAL', fmt(totalPagos), '100%'])

      autoTable(doc, {
        ...ts, startY: y, columnStyles: col3,
        head: [['Método', 'Valor', '%']],
        body: metRows,
        didParseCell: (d) => {
          if (d.section === 'body' && d.row.index === d.table.body.length - 1) d.cell.styles.fontStyle = 'bold'
        }
      })
    }

    // ===== PAGE 4: LAVADORES =====
    doc.addPage()
    y = seccionTitulo('Rendimiento por Lavador', M + 5)

    autoTable(doc, {
      ...ts, startY: y,
      head: [['#', 'Lavador', 'Servicios', 'Ingresos', 'Promedio']],
      body: data.rankLavadores.map((l, i) => [
        i + 1, l.nombre, l.cantidad, fmt(l.total), fmt(l.cantidad > 0 ? l.total / l.cantidad : 0)
      ]),
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 50 },
        2: { halign: 'center', cellWidth: 25 },
        3: { halign: 'right', cellWidth: 40 },
        4: { halign: 'right', cellWidth: 40 },
      }
    })

    // ===== PAGE 5: EXPENSE DETAILS =====
    doc.addPage()
    y = seccionTitulo('Detalle de Egresos', M + 5)

    autoTable(doc, {
      ...ts, startY: y, columnStyles: col3,
      head: [['Categoría', 'Valor', '%']],
      body: getEgresosRows(),
      didParseCell: (d) => {
        if (d.section === 'body' && d.row.index === d.table.body.length - 1) {
          d.cell.styles.fontStyle = 'bold'; d.cell.styles.textColor = cRojo
        }
      }
    })
    y = doc.lastAutoTable.finalY + 12

    doc.setFontSize(13); doc.setFont(undefined, 'bold'); doc.setTextColor(...cGrisOscuro)
    doc.text('Resultado del Período', M, y); y += 6

    autoTable(doc, {
      ...ts, startY: y,
      head: [['Concepto', 'Valor']],
      body: [
        ['Total Ingresos', fmt(data.totalIngresos)],
        ['Total Egresos', fmt(data.egresosTrans)],
        ['Balance Neto', fmt(data.balance)],
        ['Margen de Ganancia', `${data.margen}%`],
      ],
      columnStyles: { 0: { cellWidth: 90 }, 1: { halign: 'right', cellWidth: 50 } },
      didParseCell: (d) => {
        if (d.section !== 'body') return
        if (d.row.index === 0) d.cell.styles.textColor = cVerde
        if (d.row.index === 1) d.cell.styles.textColor = cRojo
        if (d.row.index === 2) { d.cell.styles.fontStyle = 'bold'; d.cell.styles.textColor = data.balance >= 0 ? cVerde : cRojo }
        if (d.row.index === 3) d.cell.styles.textColor = Number(data.margen) >= 0 ? cVerde : cRojo
      }
    })

    // ===== PAGE 6: ADDITIONAL STATS =====
    doc.addPage()
    y = seccionTitulo('Estadísticas Adicionales', M + 5)

    if (data.adicionales.length > 0) {
      doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.setTextColor(...cGrisOscuro)
      doc.text('Servicios Adicionales Más Vendidos', M, y); y += 4

      autoTable(doc, {
        ...ts, startY: y,
        head: [['#', 'Servicio', 'Cantidad']],
        body: data.adicionales.slice(0, 10).map((a, i) => [i + 1, a.nombre, a.cantidad]),
        columnStyles: { 0: { cellWidth: 15, halign: 'center' }, 2: { halign: 'center', cellWidth: 25 } }
      })
      y = doc.lastAutoTable.finalY + 12
    }

    doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.setTextColor(...cGrisOscuro)
    doc.text('Distribución de Servicios', M, y); y += 4

    autoTable(doc, {
      ...ts, startY: y,
      head: [['Tipo', 'Cantidad', '%']],
      body: [
        ['Individuales', String(data.ventas.cInd), pct(data.ventas.cInd, data.ventas.cTotal)],
        ['Con membresía', String(data.ventas.cMem), pct(data.ventas.cMem, data.ventas.cTotal)],
        ['TOTAL', String(data.ventas.cTotal), '100%'],
      ],
      columnStyles: { 0: { cellWidth: 90 }, 1: { halign: 'center', cellWidth: 30 }, 2: { halign: 'center', cellWidth: 25 } },
      didParseCell: (d) => {
        if (d.section === 'body' && d.row.index === 2) d.cell.styles.fontStyle = 'bold'
      }
    })
    y = doc.lastAutoTable.finalY + 12

    doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.setTextColor(...cGrisOscuro)
    doc.text('Tickets Promedio', M, y); y += 4

    autoTable(doc, {
      ...ts, startY: y,
      head: [['Categoría', 'Valor']],
      body: [
        ['Sin membresía', fmt(data.ventas.ticketSin)],
        ['Con membresía', fmt(data.ventas.ticketCon)],
        ['General', fmt(data.ventas.ticketTotal)],
      ],
      columnStyles: { 0: { cellWidth: 90 }, 1: { halign: 'right', cellWidth: 50 } }
    })

    // ===== PAGE 7: HISTORICAL =====
    doc.addPage()
    y = seccionTitulo('Comparativa Histórica', M + 5)

    doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.setTextColor(...cGrisOscuro)
    doc.text('Últimos 6 Meses', M, y); y += 4

    autoTable(doc, {
      ...ts, startY: y,
      head: [['Mes', 'Ingresos', 'Egresos', 'Balance', 'Margen %']],
      body: data.tend6.map((m, i) => [
        m.mes, fmt(m.ingresos), fmt(m.egresos), fmt(m.balance),
        m.ingresos > 0 ? `${((m.balance / m.ingresos) * 100).toFixed(1)}%` : '0%'
      ]),
      columnStyles: {
        0: { cellWidth: 25 },
        1: { halign: 'right', cellWidth: 38 },
        2: { halign: 'right', cellWidth: 35 },
        3: { halign: 'right', cellWidth: 38 },
        4: { halign: 'center', cellWidth: 25 },
      },
      didParseCell: (d) => {
        if (d.section !== 'body') return
        if (d.column.index === 1) d.cell.styles.textColor = cVerde
        if (d.column.index === 2) d.cell.styles.textColor = cRojo
        if (d.column.index === 3) {
          const val = data.tend6[d.row.index]?.balance || 0
          d.cell.styles.fontStyle = 'bold'
          d.cell.styles.textColor = val >= 0 ? cVerde : cRojo
        }
        // Bold last row (current month)
        if (d.row.index === d.table.body.length - 1) d.cell.styles.fontStyle = 'bold'
      }
    })
    y = doc.lastAutoTable.finalY + 12

    doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.setTextColor(...cGrisOscuro)
    doc.text('Top 5 Días con Mayor Facturación', M, y); y += 4

    autoTable(doc, {
      ...ts, startY: y,
      head: [['#', 'Fecha', 'Total']],
      body: data.topDias.map((d, i) => [i + 1, d.fecha, fmt(d.total)]),
      columnStyles: { 0: { cellWidth: 15, halign: 'center' }, 2: { halign: 'right', cellWidth: 50 } }
    })

    // Add headers/footers (skip cover)
    const totalPages = doc.getNumberOfPages()
    for (let i = 2; i <= totalPages; i++) {
      doc.setPage(i)
      addHeaderFooter(i - 1, totalPages - 1)
    }

    const mes = MESES[fechaDesde?.getMonth() || 0]
    const año = fechaDesde?.getFullYear() || new Date().getFullYear()
    const filePrefix = (negocioNombre || 'MONACO').toUpperCase().replace(/\s+/g, '_')
    doc.save(`REPORTE_${filePrefix}_${mes.toUpperCase()}_${año}.pdf`)
  }

  // --- Excel ---
  const descargarExcel = async () => {
    if (!data) return
    const wb = new ExcelJS.Workbook()
    wb.creator = negocioNombre || 'Monaco'
    wb.created = new Date()

    const sign = v => Number(v) >= 0 ? `+${v}%` : `${v}%`

    // Styles
    const fillVerde = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } }
    const fillGrisOscuro = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } }
    const fillGrisClaro = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
    const fillVerdeClaro = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }
    const fillRojoClaro = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }
    const fillDorado = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } }
    const fillAzulClaro = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } }
    const fontBlanca = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12, name: 'Arial' }
    const fontTitulo = { bold: true, color: { argb: 'FFFFFFFF' }, size: 16, name: 'Arial' }
    const fontNormal = { size: 11, name: 'Arial' }
    const fontBold = { bold: true, size: 11, name: 'Arial' }
    const fontVerde = { size: 11, name: 'Arial', color: { argb: 'FF059669' } }
    const fontRojo = { size: 11, name: 'Arial', color: { argb: 'FFDC2626' } }
    const fontVerdeBold = { bold: true, size: 11, name: 'Arial', color: { argb: 'FF059669' } }
    const fontRojoBold = { bold: true, size: 11, name: 'Arial', color: { argb: 'FFDC2626' } }
    const border = { top: { style: 'thin', color: { argb: 'FFE5E7EB' } }, bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } }, left: { style: 'thin', color: { argb: 'FFE5E7EB' } }, right: { style: 'thin', color: { argb: 'FFE5E7EB' } } }

    const addTitle = (ws, title, cols) => {
      ws.mergeCells(1, 1, 1, cols)
      const cell = ws.getCell(1, 1)
      cell.value = title
      cell.font = fontTitulo; cell.fill = fillVerde; cell.alignment = { horizontal: 'center', vertical: 'middle' }
      ws.getRow(1).height = 30

      ws.mergeCells(2, 1, 2, cols)
      const cell2 = ws.getCell(2, 1)
      cell2.value = `Generado: ${new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}`
      cell2.font = { size: 10, name: 'Arial', italic: true, color: { argb: 'FF6B7280' } }
      cell2.alignment = { horizontal: 'center' }
      return 4
    }

    const addHeaders = (ws, row, headers) => {
      headers.forEach((h, i) => {
        const cell = ws.getCell(row, i + 1)
        cell.value = h; cell.font = fontBlanca; cell.fill = fillGrisOscuro
        cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.border = border
      })
      ws.getRow(row).height = 25
    }

    const addDataRow = (ws, row, values, opts = {}) => {
      values.forEach((v, i) => {
        const cell = ws.getCell(row, i + 1)
        cell.value = v; cell.font = opts.font || fontNormal
        cell.alignment = { horizontal: opts.aligns?.[i] || 'left', vertical: 'middle' }
        cell.border = border
        if (opts.fonts?.[i]) cell.font = opts.fonts[i]
        if (opts.fill) cell.fill = opts.fill
        else if (row % 2 === 0) cell.fill = fillGrisClaro
      })
      ws.getRow(row).height = 20
    }

    const setColWidths = (ws, widths) => {
      widths.forEach((w, i) => { ws.getColumn(i + 1).width = w })
    }

    const addSubtitle = (ws, row, title, cols) => {
      ws.mergeCells(row, 1, row, cols)
      const cell = ws.getCell(row, 1)
      cell.value = title; cell.font = { bold: true, size: 13, name: 'Arial', color: { argb: 'FF1F2937' } }
      cell.alignment = { vertical: 'middle' }
      ws.getRow(row).height = 25
      return row + 1
    }

    // ===== SHEET 1: Resumen Ejecutivo =====
    const ws1 = wb.addWorksheet('Resumen Ejecutivo')
    let r = addTitle(ws1, `REPORTE DE GANANCIAS - ${getTitulo().replace('REPORTE ', '')}`, 3)
    addHeaders(ws1, r, ['Indicador', 'Valor', 'vs Mes Anterior'])
    const kpis = [
      { label: 'Total Ventas', valor: data.ventas.totalVentas, cambio: sign(data.comparativa.ventas), fontV: fontVerdeBold },
      { label: 'Total Egresos', valor: data.egresosTrans, cambio: '', fontV: fontRojoBold },
      { label: 'Balance Neto', valor: data.balance, cambio: sign(data.comparativa.balance), fontV: data.balance >= 0 ? fontVerdeBold : fontRojoBold },
      { label: 'Margen de Ganancia', valor: `${data.margen}%`, cambio: '', fontV: Number(data.margen) >= 0 ? fontVerde : fontRojo, raw: true },
      { label: 'Total Servicios', valor: data.cTotal, cambio: sign(data.comparativa.lavadas), raw: true },
      { label: 'Ticket Promedio', valor: data.ventas.ticketTotal, cambio: '' },
    ]
    kpis.forEach((kpi, i) => {
      const row = r + 1 + i
      const cambioFill = kpi.cambio && kpi.cambio.startsWith('+') ? fillVerdeClaro : kpi.cambio && kpi.cambio.startsWith('-') ? fillRojoClaro : null
      addDataRow(ws1, row, [kpi.label, kpi.raw ? kpi.valor : kpi.valor, kpi.cambio], {
        aligns: ['left', 'right', 'center'],
        fonts: [fontBold, kpi.fontV || fontBold, kpi.cambio?.startsWith('+') ? fontVerde : kpi.cambio?.startsWith('-') ? fontRojo : fontNormal]
      })
      if (!kpi.raw) ws1.getCell(row, 2).numFmt = '$ #,##0'
      if (cambioFill) ws1.getCell(row, 3).fill = cambioFill
    })
    setColWidths(ws1, [30, 22, 20])

    // ===== SHEET 2: Ingresos =====
    const ws2 = wb.addWorksheet('Ingresos')
    r = addTitle(ws2, 'Detalle de Ingresos', 3)
    addHeaders(ws2, r, ['Concepto', 'Valor', 'Porcentaje'])
    const ingRows = [
      ['Servicios individuales', data.ingresos.lavInd, pctNum(data.ingresos.lavInd, data.totalIngresos)],
      ['Adicionales membresías', data.ingresos.adicMem, pctNum(data.ingresos.adicMem, data.totalIngresos)],
      ['Membresías vendidas', data.ingresos.membresias, pctNum(data.ingresos.membresias, data.totalIngresos)],
      ['Otros ingresos', data.ingresos.otros + data.ingresos.adicTrans + data.ingresos.lavTrans, pctNum(data.ingresos.otros + data.ingresos.adicTrans + data.ingresos.lavTrans, data.totalIngresos)],
    ]
    ingRows.forEach((row, i) => {
      const rn = r + 1 + i
      addDataRow(ws2, rn, row, { aligns: ['left', 'right', 'center'] })
      ws2.getCell(rn, 2).numFmt = '$ #,##0'
      ws2.getCell(rn, 3).numFmt = '0.0"%"'; ws2.getCell(rn, 3).value = Number(row[2])
    })
    const totalIngRow = r + 1 + ingRows.length
    addDataRow(ws2, totalIngRow, ['TOTAL INGRESOS', data.totalIngresos, 100], {
      aligns: ['left', 'right', 'center'], font: fontVerdeBold, fill: fillVerdeClaro
    })
    ws2.getCell(totalIngRow, 2).numFmt = '$ #,##0'
    ws2.getCell(totalIngRow, 3).numFmt = '0.0"%"'

    // Payment methods
    let mr = totalIngRow + 2
    mr = addSubtitle(ws2, mr, 'Desglose por Método de Pago', 3)
    addHeaders(ws2, mr, ['Método', 'Valor', 'Porcentaje'])
    const totalPagos = data.metodosPago.reduce((s, m) => s + m.value, 0)
    data.metodosPago.forEach((m, i) => {
      const rn = mr + 1 + i
      addDataRow(ws2, rn, [m.name, m.value, Number(m.porcentaje)], { aligns: ['left', 'right', 'center'] })
      ws2.getCell(rn, 2).numFmt = '$ #,##0'
      ws2.getCell(rn, 3).numFmt = '0.0"%"'
    })
    const totalMetRow = mr + 1 + data.metodosPago.length
    addDataRow(ws2, totalMetRow, ['TOTAL', totalPagos, 100], { aligns: ['left', 'right', 'center'], font: fontBold })
    ws2.getCell(totalMetRow, 2).numFmt = '$ #,##0'
    ws2.getCell(totalMetRow, 3).numFmt = '0.0"%"'
    setColWidths(ws2, [35, 22, 18])

    // ===== SHEET 3: Egresos =====
    const ws3 = wb.addWorksheet('Egresos')
    r = addTitle(ws3, 'Detalle de Egresos', 3)
    addHeaders(ws3, r, ['Categoría', 'Valor', 'Porcentaje'])
    data.egresosDetalle.forEach((e, i) => {
      const rn = r + 1 + i
      addDataRow(ws3, rn, [e.categoria, e.valor, Number(pctNum(e.valor, data.egresosTrans))], { aligns: ['left', 'right', 'center'] })
      ws3.getCell(rn, 2).numFmt = '$ #,##0'
      ws3.getCell(rn, 3).numFmt = '0.0"%"'
    })
    const totalEgRow = r + 1 + data.egresosDetalle.length
    addDataRow(ws3, totalEgRow, ['TOTAL EGRESOS', data.egresosTrans, 100], {
      aligns: ['left', 'right', 'center'], font: fontRojoBold, fill: fillRojoClaro
    })
    ws3.getCell(totalEgRow, 2).numFmt = '$ #,##0'
    ws3.getCell(totalEgRow, 3).numFmt = '0.0"%"'

    // Result
    const resRow = totalEgRow + 2
    addSubtitle(ws3, resRow, 'Resultado del Período', 3)
    addHeaders(ws3, resRow + 1, ['Concepto', 'Valor', ''])
    const resData = [
      ['Total Ingresos', data.totalIngresos, fontVerdeBold],
      ['Total Egresos', data.egresosTrans, fontRojoBold],
      ['Balance Neto', data.balance, data.balance >= 0 ? fontVerdeBold : fontRojoBold],
      ['Margen de Ganancia', null, Number(data.margen) >= 0 ? fontVerdeBold : fontRojoBold],
    ]
    resData.forEach((rd, i) => {
      const rn = resRow + 2 + i
      addDataRow(ws3, rn, [rd[0], rd[1] !== null ? rd[1] : `${data.margen}%`, ''], { aligns: ['left', 'right', 'center'], fonts: [fontBold, rd[2], fontNormal] })
      if (rd[1] !== null) ws3.getCell(rn, 2).numFmt = '$ #,##0'
    })
    setColWidths(ws3, [35, 22, 18])

    // ===== SHEET 4: Lavadores =====
    const ws4 = wb.addWorksheet('Rendimiento Lavadores')
    r = addTitle(ws4, 'Rendimiento por Lavador', 5)
    addHeaders(ws4, r, ['#', 'Lavador', 'Servicios', 'Ingresos', 'Promedio'])
    data.rankLavadores.forEach((l, i) => {
      const rn = r + 1 + i
      const prom = l.cantidad > 0 ? l.total / l.cantidad : 0
      addDataRow(ws4, rn, [i + 1, l.nombre, l.cantidad, l.total, prom], {
        aligns: ['center', 'left', 'center', 'right', 'right'],
        fill: i === 0 ? fillDorado : undefined
      })
      ws4.getCell(rn, 4).numFmt = '$ #,##0'
      ws4.getCell(rn, 5).numFmt = '$ #,##0'
    })
    setColWidths(ws4, [8, 25, 15, 22, 22])

    // ===== SHEET 5: Estadísticas =====
    const ws5 = wb.addWorksheet('Estadísticas')
    r = addTitle(ws5, 'Estadísticas del Período', 3)

    if (data.adicionales.length > 0) {
      r = addSubtitle(ws5, r, 'Servicios Adicionales Más Vendidos', 3)
      addHeaders(ws5, r, ['#', 'Servicio', 'Cantidad'])
      data.adicionales.slice(0, 10).forEach((a, i) => {
        addDataRow(ws5, r + 1 + i, [i + 1, a.nombre, a.cantidad], { aligns: ['center', 'left', 'center'] })
      })
      r = r + 1 + Math.min(data.adicionales.length, 10) + 1
    }

    r = addSubtitle(ws5, r, 'Distribución de Servicios', 3)
    addHeaders(ws5, r, ['Tipo', 'Cantidad', 'Porcentaje'])
    const distRows = [
      ['Individuales', data.ventas.cInd, Number(pctNum(data.ventas.cInd, data.ventas.cTotal))],
      ['Con membresía', data.ventas.cMem, Number(pctNum(data.ventas.cMem, data.ventas.cTotal))],
    ]
    distRows.forEach((dr, i) => {
      const rn = r + 1 + i
      addDataRow(ws5, rn, dr, { aligns: ['left', 'center', 'center'] })
      ws5.getCell(rn, 3).numFmt = '0.0"%"'
    })
    const totalDistRow = r + 1 + distRows.length
    addDataRow(ws5, totalDistRow, ['TOTAL', data.ventas.cTotal, 100], { aligns: ['left', 'center', 'center'], font: fontBold })
    ws5.getCell(totalDistRow, 3).numFmt = '0.0"%"'

    r = totalDistRow + 2
    r = addSubtitle(ws5, r, 'Tickets Promedio', 3)
    addHeaders(ws5, r, ['Categoría', 'Valor', ''])
    const ticketRows = [
      ['Sin membresía', data.ventas.ticketSin],
      ['Con membresía', data.ventas.ticketCon],
      ['General', data.ventas.ticketTotal],
    ]
    ticketRows.forEach((tr, i) => {
      const rn = r + 1 + i
      addDataRow(ws5, rn, [tr[0], tr[1], ''], { aligns: ['left', 'right', 'left'] })
      ws5.getCell(rn, 2).numFmt = '$ #,##0'
    })
    setColWidths(ws5, [30, 20, 18])

    // ===== SHEET 6: Histórico =====
    const ws6 = wb.addWorksheet('Histórico')
    r = addTitle(ws6, 'Comparativa Últimos 6 Meses', 5)
    addHeaders(ws6, r, ['Mes', 'Ingresos', 'Egresos', 'Balance', 'Margen %'])
    data.tend6.forEach((m, i) => {
      const rn = r + 1 + i
      const margenVal = m.ingresos > 0 ? ((m.balance / m.ingresos) * 100) : 0
      const isLast = i === data.tend6.length - 1
      addDataRow(ws6, rn, [m.mes, m.ingresos, m.egresos, m.balance, margenVal], {
        aligns: ['center', 'right', 'right', 'right', 'center'],
        font: isLast ? fontBold : fontNormal,
        fill: isLast ? fillAzulClaro : undefined,
        fonts: [isLast ? fontBold : fontNormal, fontVerde, fontRojo, m.balance >= 0 ? fontVerdeBold : fontRojoBold, fontNormal]
      })
      ws6.getCell(rn, 2).numFmt = '$ #,##0'
      ws6.getCell(rn, 3).numFmt = '$ #,##0'
      ws6.getCell(rn, 4).numFmt = '$ #,##0'
      ws6.getCell(rn, 5).numFmt = '0.0"%"'
    })
    setColWidths(ws6, [15, 22, 22, 22, 15])

    // Generate and save
    const buffer = await wb.xlsx.writeBuffer()
    const mes = MESES[fechaDesde?.getMonth() || 0]
    const año = fechaDesde?.getFullYear() || new Date().getFullYear()
    const excelPrefix = (negocioNombre || 'MONACO').toUpperCase().replace(/\s+/g, '_')
    saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `REPORTE_${excelPrefix}_${mes.toUpperCase()}_${año}.xlsx`)
  }

  // --- Row builders ---
  const getVentasRows = () => {
    if (!data) return []
    const t = data.ventas.totalVentas
    return [
      ['Total ventas', fmt(t), '100%'],
      ['Servicios individuales', fmt(data.ventas.totalInd), pct(data.ventas.totalInd, t)],
      ['Adicionales membresías', fmt(data.ventas.totalAdicMem), pct(data.ventas.totalAdicMem, t)],
      ['Membresías y otros ingresos', fmt(data.ventas.ingresosTrans), pct(data.ventas.ingresosTrans, t)],
      ['Total egresos', fmt(data.ventas.totalEgresos), pct(data.ventas.totalEgresos, t)],
      ['Balance', fmt(data.ventas.balance), pct(data.ventas.balance, t)],
    ]
  }
  const getEstadisticasRows = () => {
    if (!data) return []
    return [
      ['Servicios individuales', String(data.ventas.cInd), pct(data.ventas.cInd, data.ventas.cTotal)],
      ['Servicios membresía', String(data.ventas.cMem), pct(data.ventas.cMem, data.ventas.cTotal)],
      ['Ticket prom. sin membresía', fmt(data.ventas.ticketSin), ''],
      ['Ticket prom. con membresía', fmt(data.ventas.ticketCon), ''],
      ['Ticket prom. total', fmt(data.ventas.ticketTotal), ''],
    ]
  }
  const getIngresosRows = () => {
    if (!data) return []
    const t = data.totalIngresos
    return [
      ['Servicios individuales', fmt(data.ingresos.lavInd), pct(data.ingresos.lavInd, t)],
      ['Adicionales membresías', fmt(data.ingresos.adicMem), pct(data.ingresos.adicMem, t)],
      ['Membresías vendidas', fmt(data.ingresos.membresias), pct(data.ingresos.membresias, t)],
      ['Otros ingresos', fmt(data.ingresos.otros + data.ingresos.adicTrans + data.ingresos.lavTrans), pct(data.ingresos.otros + data.ingresos.adicTrans + data.ingresos.lavTrans, t)],
      ['TOTAL INGRESOS', fmt(t), '100%'],
    ]
  }
  const getEgresosRows = () => {
    if (!data) return []
    const t = data.egresosTrans
    const rows = data.egresosDetalle.map(e => [e.categoria, fmt(e.valor), pct(e.valor, t)])
    rows.push(['TOTAL EGRESOS', fmt(t), '100%'])
    return rows
  }
  const getKPIRows = () => {
    if (!data) return []
    const c = data.comparativa
    const sign = v => Number(v) >= 0 ? `+${v}%` : `${v}%`
    return [
      ['Total Ventas', fmt(data.ventas.totalVentas), sign(c.ventas)],
      ['Total Egresos', fmt(data.egresosTrans), ''],
      ['Balance Neto', fmt(data.balance), sign(c.balance)],
      ['Margen de Ganancia', data.margen + '%', ''],
      ['Total Servicios', String(data.cTotal), sign(c.lavadas)],
      ['Ticket Promedio', fmt(data.ventas.ticketTotal), ''],
    ]
  }

  // ================================ RENDER ================================

  const TABS = ['Reporte de Ventas', 'Ingresos y Egresos', 'Reporte Total']

  return (
    <div className="reportes-page">
      <div className="page-header">
        <h1 className="page-title">Reportes</h1>
        <div className="reportes-actions">
          <button className="btn-export btn-pdf" onClick={descargarPDF} disabled={!data}><FileText size={18} /><span>PDF</span></button>
          <button className="btn-export btn-excel" onClick={descargarExcel} disabled={!data}><FileSpreadsheet size={18} /><span>Excel</span></button>
        </div>
      </div>

      <div className="filters">
        <div className="filter-rapido">
          {['hoy','semana','mes','año'].map(f => (
            <button key={f} className={`filter-btn ${filtroRapido === f ? 'active' : ''}`} onClick={() => aplicarFiltroRapido(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className="filter-fechas">
          <DatePicker selected={fechaDesde} onChange={d => { setFechaDesde(d); setFiltroRapido('') }} selectsStart startDate={fechaDesde} endDate={fechaHasta} placeholderText="Desde" className="filter-date" dateFormat="dd/MM/yyyy" locale="es" isClearable />
          <span className="filter-separator">→</span>
          <DatePicker selected={fechaHasta} onChange={d => { setFechaHasta(d); setFiltroRapido('') }} selectsEnd startDate={fechaDesde} endDate={fechaHasta} minDate={fechaDesde} placeholderText="Hasta" className="filter-date" dateFormat="dd/MM/yyyy" locale="es" isClearable />
        </div>
      </div>

      <div className="reporte-tabs">
        {TABS.map((t, i) => (
          <button key={i} className={`reporte-tab ${tabActivo === i ? 'active' : ''}`} onClick={() => setTabActivo(i)}>{t}</button>
        ))}
      </div>

      <div className="reporte-titulo">
        <h2>{getTitulo()}</h2>
        <p>{getRangoStr()}</p>
      </div>

      {cargando && <div className="loading">Cargando reportes...</div>}

      {data && !cargando && (
        <div className="reportes-secciones" ref={chartsRef}>

          {/* ========== TAB 1: VENTAS ========== */}
          {tabActivo === 0 && (<>
            <div className="reporte-seccion">
              <h3 className="reporte-seccion-titulo">RESUMEN DE VENTAS</h3>
              <table className="reporte-tabla">
                <thead><tr><th>Concepto</th><th className="col-valor">Valor</th><th className="col-pct">%</th></tr></thead>
                <tbody>
                  <tr><td>Total ventas</td><td className="col-valor">{fmt(data.ventas.totalVentas)}</td><td className="col-pct">100%</td></tr>
                  <tr><td>Servicios individuales</td><td className="col-valor">{fmt(data.ventas.totalInd)}</td><td className="col-pct">{pct(data.ventas.totalInd, data.ventas.totalVentas)}</td></tr>
                  <tr><td>Adicionales membresías</td><td className="col-valor">{fmt(data.ventas.totalAdicMem)}</td><td className="col-pct">{pct(data.ventas.totalAdicMem, data.ventas.totalVentas)}</td></tr>
                  <tr><td>Membresías y otros ingresos</td><td className="col-valor">{fmt(data.ventas.ingresosTrans)}</td><td className="col-pct">{pct(data.ventas.ingresosTrans, data.ventas.totalVentas)}</td></tr>
                  <tr className="fila-egresos"><td>Total egresos</td><td className="col-valor negativo">{fmt(data.ventas.totalEgresos)}</td><td className="col-pct negativo">{pct(data.ventas.totalEgresos, data.ventas.totalVentas)}</td></tr>
                  <tr className="fila-balance"><td>Balance</td><td className={`col-valor ${data.balance >= 0 ? 'positivo' : 'negativo'}`}>{fmt(data.balance)}</td><td className={`col-pct ${data.balance >= 0 ? 'positivo' : 'negativo'}`}>{pct(data.balance, data.ventas.totalVentas)}</td></tr>
                </tbody>
              </table>
            </div>

            <div className="reporte-seccion">
              <h3 className="reporte-seccion-titulo">ESTADÍSTICAS DE SERVICIOS</h3>
              <table className="reporte-tabla">
                <thead><tr><th>Concepto</th><th className="col-valor">Valor</th><th className="col-pct">%</th></tr></thead>
                <tbody>
                  <tr><td>Servicios individuales</td><td className="col-valor">{data.ventas.cInd}</td><td className="col-pct">{pct(data.ventas.cInd, data.ventas.cTotal)}</td></tr>
                  <tr><td>Servicios membresía</td><td className="col-valor">{data.ventas.cMem}</td><td className="col-pct">{pct(data.ventas.cMem, data.ventas.cTotal)}</td></tr>
                  <tr><td>Ticket prom. sin membresía</td><td className="col-valor">{fmt(data.ventas.ticketSin)}</td><td className="col-pct"></td></tr>
                  <tr><td>Ticket prom. con membresía</td><td className="col-valor">{fmt(data.ventas.ticketCon)}</td><td className="col-pct"></td></tr>
                  <tr><td>Ticket prom. total</td><td className="col-valor">{fmt(data.ventas.ticketTotal)}</td><td className="col-pct"></td></tr>
                </tbody>
              </table>
            </div>

            <h3 className="reporte-seccion-titulo" style={{ marginTop: '2rem', marginBottom: '1.5rem', fontSize: '1.3rem' }}>ANÁLISIS VISUAL</h3>

            <div className="chart-card chart-full">
              <h4 className="chart-title">Ventas diarias</h4>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.ventasDiarias}><CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" /><XAxis dataKey="dia" stroke="#a0a0a0" fontSize={12} /><YAxis stroke="#a0a0a0" fontSize={12} tickFormatter={fmtCorto} /><Tooltip content={<ChartTooltip formatter={fmt} />} /><Line type="monotone" dataKey="ventas" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} name="Ventas" /></LineChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-grid">
              <div className="chart-card">
                <h4 className="chart-title">Rendimiento por lavador</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.rendLavadores}><CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" /><XAxis dataKey="nombre" stroke="#a0a0a0" fontSize={11} /><YAxis stroke="#a0a0a0" fontSize={12} /><Tooltip content={({active,payload})=>{ if(!active||!payload?.length) return null; const d=payload[0].payload; return <div className="chart-tooltip"><p><strong>{d.nombre}</strong></p><p>Lavadas: {d.cantidad}</p><p>Total: {fmt(d.total)}</p></div> }} /><Bar dataKey="cantidad" name="Lavadas" radius={[4,4,0,0]}>{data.rendLavadores.map((_,i)=><Cell key={i} fill={COLORES[i%COLORES.length]} />)}</Bar></BarChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-card">
                <h4 className="chart-title">Tipos de lavado</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart><Pie data={data.tiposLavado} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={renderLabel}><Cell fill="#3b82f6" /><Cell fill="#10b981" /></Pie><Tooltip content={<PieTooltip />} /><Legend /></PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="chart-grid">
              <div className="chart-card">
                <h4 className="chart-title">Adicionales más vendidos</h4>
                {data.adicionales.length > 0 ? <ResponsiveContainer width="100%" height={300}><BarChart data={data.adicionales} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" /><XAxis type="number" stroke="#a0a0a0" fontSize={12} /><YAxis type="category" dataKey="nombre" stroke="#a0a0a0" fontSize={11} width={120} /><Tooltip content={<ChartTooltip />} /><Bar dataKey="cantidad" name="Cantidad" fill="#f59e0b" radius={[0,4,4,0]} /></BarChart></ResponsiveContainer> : <div className="chart-empty">Sin datos</div>}
              </div>
              <div className="chart-card">
                <h4 className="chart-title">Métodos de pago</h4>
                {data.metodosPago.length > 0 ? <ResponsiveContainer width="100%" height={300}><PieChart><Pie data={data.metodosPago} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={renderLabel}>{data.metodosPago.map((_,i)=><Cell key={i} fill={COLORES[i%COLORES.length]} />)}</Pie><Tooltip content={<PieTooltip />} /><Legend /></PieChart></ResponsiveContainer> : <div className="chart-empty">Sin datos</div>}
              </div>
            </div>

            <div className="chart-card chart-full">
              <h4 className="chart-title">Ticket promedio</h4>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.ticketData} margin={{ top: 30, right: 30, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" vertical={false} />
                  <XAxis dataKey="nombre" stroke="#a0a0a0" fontSize={13} tickLine={false} axisLine={{ stroke: '#2a2a3a' }} />
                  <YAxis stroke="#a0a0a0" fontSize={12} tickFormatter={v => `$${(v/1000).toFixed(0)}K`} domain={[0, dataMax => Math.ceil(dataMax * 1.2 / 10000) * 10000]} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip formatter={fmt} />} />
                  <Bar dataKey="valor" name="Ticket promedio" maxBarSize={80} radius={[6,6,0,0]} label={{ position: 'top', fill: '#ffffff', fontSize: 14, fontWeight: 600, formatter: v => fmt(v) }}>
                    <Cell fill="#3b82f6" />
                    <Cell fill="#10b981" />
                    <Cell fill="#8b5cf6" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>)}

          {/* ========== TAB 2: INGRESOS Y EGRESOS ========== */}
          {tabActivo === 1 && (<>
            <div className="reporte-seccion">
              <h3 className="reporte-seccion-titulo">INGRESOS</h3>
              <table className="reporte-tabla">
                <thead><tr><th>Concepto</th><th className="col-valor">Valor</th><th className="col-pct">%</th></tr></thead>
                <tbody>
                  <tr><td>Servicios individuales</td><td className="col-valor">{fmt(data.ingresos.lavInd)}</td><td className="col-pct">{pct(data.ingresos.lavInd, data.totalIngresos)}</td></tr>
                  <tr><td>Adicionales membresías</td><td className="col-valor">{fmt(data.ingresos.adicMem)}</td><td className="col-pct">{pct(data.ingresos.adicMem, data.totalIngresos)}</td></tr>
                  <tr><td>Membresías vendidas</td><td className="col-valor">{fmt(data.ingresos.membresias)}</td><td className="col-pct">{pct(data.ingresos.membresias, data.totalIngresos)}</td></tr>
                  <tr><td>Otros ingresos</td><td className="col-valor">{fmt(data.ingresos.otros + data.ingresos.adicTrans + data.ingresos.lavTrans)}</td><td className="col-pct">{pct(data.ingresos.otros + data.ingresos.adicTrans + data.ingresos.lavTrans, data.totalIngresos)}</td></tr>
                  <tr className="fila-balance"><td>TOTAL INGRESOS</td><td className="col-valor positivo">{fmt(data.totalIngresos)}</td><td className="col-pct">100%</td></tr>
                </tbody>
              </table>
            </div>

            <div className="reporte-seccion">
              <h3 className="reporte-seccion-titulo">EGRESOS</h3>
              <table className="reporte-tabla">
                <thead><tr><th>Categoría</th><th className="col-valor">Valor</th><th className="col-pct">%</th></tr></thead>
                <tbody>
                  {data.egresosDetalle.map((e, i) => (
                    <tr key={i}><td>{e.categoria}</td><td className="col-valor">{fmt(e.valor)}</td><td className="col-pct">{pct(e.valor, data.egresosTrans)}</td></tr>
                  ))}
                  <tr className="fila-balance"><td>TOTAL EGRESOS</td><td className="col-valor negativo">{fmt(data.egresosTrans)}</td><td className="col-pct">100%</td></tr>
                </tbody>
              </table>
            </div>

            <div className="reporte-seccion">
              <h3 className="reporte-seccion-titulo">RESULTADO</h3>
              <div className="kpi-result-grid">
                <div className="kpi-result"><span className="kpi-result-label">Total Ingresos</span><span className="kpi-result-value positivo">{fmt(data.totalIngresos)}</span></div>
                <div className="kpi-result"><span className="kpi-result-label">Total Egresos</span><span className="kpi-result-value negativo">{fmt(data.egresosTrans)}</span></div>
                <div className="kpi-result"><span className="kpi-result-label">Balance Neto</span><span className={`kpi-result-value ${data.balance >= 0 ? 'positivo' : 'negativo'}`}>{fmt(data.balance)}</span></div>
                <div className="kpi-result"><span className="kpi-result-label">Margen de Ganancia</span><span className={`kpi-result-value ${Number(data.margen) >= 0 ? 'positivo' : 'negativo'}`}>{data.margen}%</span></div>
              </div>
            </div>

            <h3 className="reporte-seccion-titulo" style={{ marginTop: '2rem', marginBottom: '1.5rem', fontSize: '1.3rem' }}>ANÁLISIS VISUAL</h3>

            <div className="chart-card chart-full">
              <h4 className="chart-title">Ingresos vs Egresos diarios</h4>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.ingEgDiario}><CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" /><XAxis dataKey="dia" stroke="#a0a0a0" fontSize={12} /><YAxis stroke="#a0a0a0" fontSize={12} tickFormatter={fmtCorto} /><Tooltip content={<ChartTooltip formatter={fmt} />} /><Line type="monotone" dataKey="ingresos" stroke="#10b981" strokeWidth={2} name="Ingresos" dot={false} /><Line type="monotone" dataKey="egresos" stroke="#ef4444" strokeWidth={2} name="Egresos" dot={false} /><Legend /></LineChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-grid">
              <div className="chart-card">
                <h4 className="chart-title">Distribución de ingresos</h4>
                {data.ingPie.length > 0 ? <ResponsiveContainer width="100%" height={300}><PieChart><Pie data={data.ingPie} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={renderLabel}>{data.ingPie.map((_,i)=><Cell key={i} fill={COLORES[i%COLORES.length]} />)}</Pie><Tooltip content={<PieTooltip />} /><Legend /></PieChart></ResponsiveContainer> : <div className="chart-empty">Sin datos</div>}
              </div>
              <div className="chart-card">
                <h4 className="chart-title">Distribución de egresos</h4>
                {data.egPie.length > 0 ? <ResponsiveContainer width="100%" height={300}><PieChart><Pie data={data.egPie} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={renderLabel}>{data.egPie.map((_,i)=><Cell key={i} fill={COLORES[(i+2)%COLORES.length]} />)}</Pie><Tooltip content={<PieTooltip />} /><Legend /></PieChart></ResponsiveContainer> : <div className="chart-empty">Sin datos</div>}
              </div>
            </div>
          </>)}

          {/* ========== TAB 3: REPORTE TOTAL ========== */}
          {tabActivo === 2 && (<>
            <div className="kpi-cards">
              <div className="kpi-card"><span className="kpi-label">Total Ventas</span><span className="kpi-value">{fmt(data.ventas.totalVentas)}</span><span className={`kpi-change ${Number(data.comparativa.ventas) >= 0 ? 'positivo' : 'negativo'}`}>{Number(data.comparativa.ventas) >= 0 ? '+' : ''}{data.comparativa.ventas}% vs mes ant.</span></div>
              <div className="kpi-card"><span className="kpi-label">Total Egresos</span><span className="kpi-value negativo">{fmt(data.egresosTrans)}</span></div>
              <div className="kpi-card"><span className="kpi-label">Balance Neto</span><span className={`kpi-value ${data.balance >= 0 ? 'positivo' : 'negativo'}`}>{fmt(data.balance)}</span><span className={`kpi-change ${Number(data.comparativa.balance) >= 0 ? 'positivo' : 'negativo'}`}>{Number(data.comparativa.balance) >= 0 ? '+' : ''}{data.comparativa.balance}% vs mes ant.</span></div>
              <div className="kpi-card"><span className="kpi-label">Margen Ganancia</span><span className={`kpi-value ${Number(data.margen) >= 0 ? 'positivo' : 'negativo'}`}>{data.margen}%</span></div>
              <div className="kpi-card"><span className="kpi-label">Total Servicios</span><span className="kpi-value">{data.cTotal}</span><span className={`kpi-change ${Number(data.comparativa.lavadas) >= 0 ? 'positivo' : 'negativo'}`}>{Number(data.comparativa.lavadas) >= 0 ? '+' : ''}{data.comparativa.lavadas}% vs mes ant.</span></div>
              <div className="kpi-card"><span className="kpi-label">Ticket Promedio</span><span className="kpi-value">{fmt(data.ventas.ticketTotal)}</span></div>
            </div>

            <h3 className="reporte-seccion-titulo" style={{ marginTop: '2rem', marginBottom: '1.5rem', fontSize: '1.3rem' }}>TENDENCIAS</h3>

            <div className="chart-card chart-full">
              <h4 className="chart-title">Ingresos, Egresos y Balance - Últimos 6 meses</h4>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.tend6}><CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" /><XAxis dataKey="mes" stroke="#a0a0a0" fontSize={12} /><YAxis stroke="#a0a0a0" fontSize={12} tickFormatter={fmtCorto} /><Tooltip content={<ChartTooltip formatter={fmt} />} /><Line type="monotone" dataKey="ingresos" stroke="#10b981" strokeWidth={2} name="Ingresos" /><Line type="monotone" dataKey="egresos" stroke="#ef4444" strokeWidth={2} name="Egresos" /><Line type="monotone" dataKey="balance" stroke="#3b82f6" strokeWidth={2} name="Balance" strokeDasharray="5 5" /><Legend /></LineChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-grid">
              <div className="chart-card">
                <h4 className="chart-title">Top 5 días con más ventas</h4>
                {data.topDias.length > 0 ? <ResponsiveContainer width="100%" height={300}><BarChart data={data.topDias}><CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" /><XAxis dataKey="fecha" stroke="#a0a0a0" fontSize={10} /><YAxis stroke="#a0a0a0" fontSize={12} tickFormatter={fmtCorto} /><Tooltip content={<ChartTooltip formatter={fmt} />} /><Bar dataKey="total" name="Ventas" fill="#10b981" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer> : <div className="chart-empty">Sin datos</div>}
              </div>
              <div className="chart-card">
                <h4 className="chart-title">Ranking lavadores por ingresos</h4>
                {data.rankLavadores.length > 0 ? <ResponsiveContainer width="100%" height={300}><BarChart data={data.rankLavadores}><CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" /><XAxis dataKey="nombre" stroke="#a0a0a0" fontSize={11} /><YAxis stroke="#a0a0a0" fontSize={12} tickFormatter={fmtCorto} /><Tooltip content={({active,payload})=>{ if(!active||!payload?.length) return null; const d=payload[0].payload; return <div className="chart-tooltip"><p><strong>{d.nombre}</strong></p><p>Ingresos: {fmt(d.total)}</p><p>Lavadas: {d.cantidad}</p></div> }} /><Bar dataKey="total" name="Ingresos" radius={[4,4,0,0]}>{data.rankLavadores.map((_,i)=><Cell key={i} fill={COLORES[i%COLORES.length]} />)}</Bar></BarChart></ResponsiveContainer> : <div className="chart-empty">Sin datos</div>}
              </div>
            </div>

            <div className="chart-card chart-full">
              <h4 className="chart-title">Tendencia ticket promedio - Últimos 6 meses</h4>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.tend6}><CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" /><XAxis dataKey="mes" stroke="#a0a0a0" fontSize={12} /><YAxis stroke="#a0a0a0" fontSize={12} tickFormatter={fmtCorto} /><Tooltip content={<ChartTooltip formatter={fmt} />} /><Line type="monotone" dataKey="ticket" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6', r: 4 }} name="Ticket promedio" /></LineChart>
              </ResponsiveContainer>
            </div>

            <h3 className="reporte-seccion-titulo" style={{ marginTop: '2rem', marginBottom: '1rem', fontSize: '1.1rem' }}>TOP PERFORMERS</h3>
            <div className="chart-grid top-performers-grid">
              <div className="reporte-seccion">
                <h4 className="chart-title">Top 3 Lavadores</h4>
                <table className="reporte-tabla"><thead><tr><th>#</th><th>Lavador</th><th className="col-valor">Servicios</th><th className="col-valor">Ingresos</th></tr></thead>
                  <tbody>{data.topLavadores.map((l,i) => <tr key={i}><td>{i+1}</td><td>{l.nombre}</td><td className="col-valor">{l.cantidad}</td><td className="col-valor">{fmt(l.total)}</td></tr>)}</tbody>
                </table>
              </div>
              <div className="reporte-seccion">
                <h4 className="chart-title">Top 3 Días</h4>
                <table className="reporte-tabla"><thead><tr><th>#</th><th>Fecha</th><th className="col-valor">Total</th></tr></thead>
                  <tbody>{data.topDias.slice(0,3).map((d,i) => <tr key={i}><td>{i+1}</td><td>{d.fecha}</td><td className="col-valor">{fmt(d.total)}</td></tr>)}</tbody>
                </table>
              </div>
              {data.topAdicionales.length > 0 && (
                <div className="reporte-seccion">
                  <h4 className="chart-title">Top 3 Adicionales</h4>
                  <table className="reporte-tabla"><thead><tr><th>#</th><th>Servicio</th><th className="col-valor">Cantidad</th></tr></thead>
                    <tbody>{data.topAdicionales.map((a,i) => <tr key={i}><td>{i+1}</td><td>{a.nombre}</td><td className="col-valor">{a.cantidad}</td></tr>)}</tbody>
                  </table>
                </div>
              )}
            </div>
          </>)}

        </div>
      )}

    </div>
  )
}
