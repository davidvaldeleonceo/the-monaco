import pool from '../config/database.js'
import { getFormatter, getTimezone } from '../config/currencies.js'

const businessContextCache = new Map()
const CONTEXT_TTL = 5 * 60 * 1000

export async function getBusinessContext(negocioId) {
  const cached = businessContextCache.get(negocioId)
  if (cached && Date.now() - cached.fetchedAt < CONTEXT_TTL) return cached.data

  const [tiposRes, lavadoresRes, metodosRes, negocioRes] = await Promise.all([
    pool.query('SELECT nombre, precio FROM tipos_lavado WHERE negocio_id = $1 AND activo = true ORDER BY nombre', [negocioId]),
    pool.query('SELECT nombre FROM lavadores WHERE negocio_id = $1 AND activo = true ORDER BY nombre', [negocioId]),
    pool.query('SELECT nombre FROM metodos_pago WHERE negocio_id = $1 AND activo = true ORDER BY nombre', [negocioId]),
    pool.query('SELECT moneda, pais FROM negocios WHERE id = $1', [negocioId]),
  ])

  const moneda = negocioRes.rows[0]?.moneda || 'COP'
  const pais = negocioRes.rows[0]?.pais || 'CO'
  const fmt = getFormatter(moneda)
  const servicios = tiposRes.rows.map(t => `${t.nombre} (${fmt(t.precio)})`).join(', ') || 'Sin servicios'
  const lavadores = lavadoresRes.rows.map(l => l.nombre).join(', ') || 'Sin lavadores'
  const metodos = metodosRes.rows.map(m => m.nombre).join(', ') || 'Sin métodos'

  const contextText = `SERVICIOS: ${servicios}\nLAVADORES: ${lavadores}\nMÉTODOS DE PAGO: ${metodos}`
  const data = { contextText, moneda, pais }
  businessContextCache.set(negocioId, { data, fetchedAt: Date.now() })
  return data
}

export const toolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'query_lavadas',
      description: 'Consulta lavadas/servicios filtradas por fecha, placa, lavador o estado. Retorna las ultimas 20 por defecto.',
      parameters: {
        type: 'object',
        properties: {
          fecha_desde: { type: 'string', description: 'Fecha inicio YYYY-MM-DD (zona Bogota)' },
          fecha_hasta: { type: 'string', description: 'Fecha fin YYYY-MM-DD (zona Bogota)' },
          placa: { type: 'string', description: 'Placa del vehiculo (parcial o completa)' },
          lavador_nombre: { type: 'string', description: 'Nombre del lavador (parcial)' },
          estado: { type: 'string', description: 'Estado: EN ESPERA, EN LAVADO, TERMINADO, ENTREGADO' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_clientes',
      description: 'Busca clientes por nombre o placa.',
      parameters: {
        type: 'object',
        properties: {
          nombre: { type: 'string', description: 'Nombre del cliente (parcial)' },
          placa: { type: 'string', description: 'Placa del vehiculo (parcial)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_trabajadores',
      description: 'Lista los lavadores/trabajadores del negocio.',
      parameters: {
        type: 'object',
        properties: {
          nombre: { type: 'string', description: 'Nombre del lavador (parcial)' },
          solo_activos: { type: 'boolean', description: 'Solo mostrar activos (default true)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_business_summary',
      description: 'Resumen del negocio: lavadas, ingresos y clientes de hoy, esta semana o este mes.',
      parameters: {
        type: 'object',
        properties: {
          periodo: { type: 'string', enum: ['hoy', 'semana', 'mes'], description: 'Periodo del resumen' },
        },
        required: ['periodo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ranking_lavadores',
      description: 'Ranking de lavadores por cantidad de lavadas o ingresos en un periodo. Responde preguntas como "quien lavo mas", "lavador con mas servicios", "ranking de trabajadores".',
      parameters: {
        type: 'object',
        properties: {
          fecha_desde: { type: 'string', description: 'Fecha inicio YYYY-MM-DD' },
          fecha_hasta: { type: 'string', description: 'Fecha fin YYYY-MM-DD' },
          orden: { type: 'string', enum: ['cantidad', 'ingresos'], description: 'Ordenar por cantidad de lavadas o por ingresos (default: cantidad)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_transacciones',
      description: 'Consulta ingresos y egresos (ventas de productos, membresias, gastos). Filtra por tipo, categoria o fecha.',
      parameters: {
        type: 'object',
        properties: {
          fecha_desde: { type: 'string', description: 'Fecha inicio YYYY-MM-DD' },
          fecha_hasta: { type: 'string', description: 'Fecha fin YYYY-MM-DD' },
          tipo: { type: 'string', enum: ['INGRESO', 'EGRESO'], description: 'Tipo de transaccion' },
          categoria: { type: 'string', description: 'Categoria (parcial)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'resumen_financiero',
      description: 'Resumen financiero completo: ingresos por servicios, productos, egresos, balance, metodos de pago. Para preguntas sobre dinero, ganancias, balance, cobros.',
      parameters: {
        type: 'object',
        properties: {
          fecha_desde: { type: 'string', description: 'Fecha inicio YYYY-MM-DD' },
          fecha_hasta: { type: 'string', description: 'Fecha fin YYYY-MM-DD' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_productos_servicios',
      description: 'Lista los tipos de lavado, servicios adicionales, membresias y productos configurados en el negocio con sus precios.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crear_lavada',
      description: 'Crea una nueva lavada/servicio. Requiere placa y tipo de lavado. Opcionalmente lavador, adicionales, notas y nombre del cliente (si es nuevo).',
      parameters: {
        type: 'object',
        properties: {
          placa: { type: 'string', description: 'Placa del vehiculo (ej: ABC123, ROY54G)' },
          tipo_lavado_nombre: { type: 'string', description: 'Nombre del tipo de lavado (ej: Sencillo, Completo)' },
          lavador_nombre: { type: 'string', description: 'Nombre del lavador asignado' },
          adicionales_nombres: { type: 'array', items: { type: 'string' }, description: 'Nombres de servicios adicionales' },
          notas: { type: 'string', description: 'Notas adicionales para la lavada' },
          nombre_cliente: { type: 'string', description: 'Nombre del cliente (solo si es cliente nuevo)' },
        },
        required: ['placa', 'tipo_lavado_nombre'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analisis_metodos_pago',
      description: 'Analiza los metodos de pago usados en lavadas: cuantas veces se uso cada metodo, total recaudado y porcentaje. Para preguntas como "cual es el metodo de pago mas usado", "cuanto se pago en efectivo".',
      parameters: {
        type: 'object',
        properties: {
          fecha_desde: { type: 'string', description: 'Fecha inicio YYYY-MM-DD' },
          fecha_hasta: { type: 'string', description: 'Fecha fin YYYY-MM-DD' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_tiempos',
      description: 'Analiza tiempos promedio de espera, lavado y terminado. Para preguntas como "cuanto se demoran", "tiempo de espera promedio", "eficiencia de lavado".',
      parameters: {
        type: 'object',
        properties: {
          fecha_desde: { type: 'string', description: 'Fecha inicio YYYY-MM-DD' },
          fecha_hasta: { type: 'string', description: 'Fecha fin YYYY-MM-DD' },
          lavador_nombre: { type: 'string', description: 'Filtrar por lavador especifico' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'top_clientes',
      description: 'Ranking de mejores clientes por visitas o gasto total. Para preguntas como "quien es mi mejor cliente", "clientes mas frecuentes", "quien gasta mas".',
      parameters: {
        type: 'object',
        properties: {
          fecha_desde: { type: 'string', description: 'Fecha inicio YYYY-MM-DD' },
          fecha_hasta: { type: 'string', description: 'Fecha fin YYYY-MM-DD' },
          orden: { type: 'string', enum: ['visitas', 'gasto'], description: 'Ordenar por visitas o por gasto (default: visitas)' },
          limite: { type: 'number', description: 'Cantidad de resultados (default: 10)' },
        },
        required: [],
      },
    },
  },
]

export async function executeTool(name, args, negocioId, io, moneda = 'COP', pais = 'CO') {
  const fmt = getFormatter(moneda)
  const tz = getTimezone(pais)
  switch (name) {
    case 'query_lavadas':
      return await queryLavadas(args, negocioId, fmt, tz)
    case 'query_clientes':
      return await queryClientes(args, negocioId, tz)
    case 'query_trabajadores':
      return await queryTrabajadores(args, negocioId, tz)
    case 'get_business_summary':
      return await getBusinessSummary(args, negocioId, fmt, tz)
    case 'ranking_lavadores':
      return await rankingLavadores(args, negocioId, fmt, tz)
    case 'query_transacciones':
      return await queryTransacciones(args, negocioId, fmt)
    case 'resumen_financiero':
      return await resumenFinanciero(args, negocioId, fmt, tz)
    case 'query_productos_servicios':
      return await queryProductosServicios(negocioId, fmt)
    case 'crear_lavada':
      return await crearLavada(args, negocioId, io, fmt, tz)
    case 'analisis_metodos_pago':
      return await analisisMetodosPago(args, negocioId, fmt, tz)
    case 'query_tiempos':
      return await queryTiempos(args, negocioId, tz)
    case 'top_clientes':
      return await topClientes(args, negocioId, fmt, tz)
    default:
      return { error: `Tool desconocida: ${name}` }
  }
}

async function queryLavadas(args, negocioId, fmt, tz) {
  const conditions = ['l.negocio_id = $1']
  const params = [negocioId]
  let idx = 2

  if (args.fecha_desde) {
    conditions.push(`l.fecha >= ($${idx}::timestamp AT TIME ZONE '${tz}')`)
    params.push(args.fecha_desde)
    idx++
  }
  if (args.fecha_hasta) {
    conditions.push(`l.fecha < (($${idx}::date + interval '1 day')::timestamp AT TIME ZONE '${tz}')`)
    params.push(args.fecha_hasta)
    idx++
  }
  if (args.placa) {
    conditions.push(`l.placa ILIKE $${idx}`)
    params.push(`%${args.placa}%`)
    idx++
  }
  if (args.lavador_nombre) {
    conditions.push(`lav.nombre ILIKE $${idx}`)
    params.push(`%${args.lavador_nombre}%`)
    idx++
  }
  if (args.estado) {
    conditions.push(`l.estado = $${idx}`)
    params.push(args.estado)
    idx++
  }

  const sql = `
    SELECT l.id, l.placa, l.estado, l.valor, l.fecha, l.notas,
           c.nombre AS cliente_nombre,
           tl.nombre AS tipo_lavado,
           lav.nombre AS lavador_nombre
    FROM lavadas l
    LEFT JOIN clientes c ON c.id = l.cliente_id
    LEFT JOIN tipos_lavado tl ON tl.id = l.tipo_lavado_id
    LEFT JOIN lavadores lav ON lav.id = l.lavador_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY l.fecha DESC
    LIMIT 20
  `

  const { rows } = await pool.query(sql, params)
  const resumen = rows.length === 0
    ? 'No se encontraron lavadas con esos filtros.'
    : rows.map((l, i) => `${i+1}. ${l.placa} — ${l.tipo_lavado || 'Sin tipo'} — ${l.estado} — ${fmt(l.valor)} — ${l.lavador_nombre || 'Sin lavador'}`).join('\n')
  return {
    _instruccion: 'USA EXACTAMENTE ESTOS DATOS. NO INVENTES OTROS.',
    total: rows.length,
    resumen_texto: `${rows.length} lavada(s):\n${resumen}`
  }
}

async function queryClientes(args, negocioId, tz) {
  const conditions = ['c.negocio_id = $1']
  const params = [negocioId]
  let idx = 2

  if (args.nombre) {
    conditions.push(`c.nombre ILIKE $${idx}`)
    params.push(`%${args.nombre}%`)
    idx++
  }
  if (args.placa) {
    conditions.push(`c.placa ILIKE $${idx}`)
    params.push(`%${args.placa}%`)
    idx++
  }

  const sql = `
    SELECT c.id, c.nombre, c.placa, c.telefono, c.estado, c.moto,
           tm.nombre AS membresia
    FROM clientes c
    LEFT JOIN tipos_membresia tm ON tm.id = c.membresia_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY c.nombre
    LIMIT 20
  `

  const { rows } = await pool.query(sql, params)
  const resumen = rows.length === 0
    ? 'No se encontraron clientes.'
    : rows.map((c, i) => `${i+1}. ${c.nombre} — ${c.placa}${c.membresia ? ` — ${c.membresia}` : ''} — ${c.estado}`).join('\n')
  return {
    _instruccion: 'USA EXACTAMENTE ESTOS DATOS. NO INVENTES OTROS.',
    total: rows.length,
    resumen_texto: `${rows.length} cliente(s):\n${resumen}`
  }
}

async function queryTrabajadores(args, negocioId, tz) {
  const conditions = ['negocio_id = $1']
  const params = [negocioId]
  let idx = 2

  if (args.nombre) {
    conditions.push(`nombre ILIKE $${idx}`)
    params.push(`%${args.nombre}%`)
    idx++
  }
  if (args.solo_activos !== false) {
    conditions.push('activo = true')
  }

  const sql = `
    SELECT id, nombre, telefono, activo, tipo_pago
    FROM lavadores
    WHERE ${conditions.join(' AND ')}
    ORDER BY nombre
  `

  const { rows } = await pool.query(sql, params)
  const resumen = rows.length === 0
    ? 'No hay trabajadores registrados.'
    : rows.map((t, i) => {
      const pagoLabel = { porcentaje: 'Porcentaje', sueldo_fijo: 'Sueldo fijo', porcentaje_lavada: '% de servicio + adic.', fijo_por_lavada: 'Fijo por lavada' }[t.tipo_pago] || 'No definido'
      return `${i+1}. ${t.nombre} — ${t.activo ? 'Activo' : 'Inactivo'} — Pago: ${pagoLabel}`
    }).join('\n')
  return {
    _instruccion: 'USA EXACTAMENTE ESTOS DATOS. NO INVENTES OTROS.',
    total: rows.length,
    resumen_texto: `${rows.length} trabajador(es):\n${resumen}`
  }
}

async function getBusinessSummary(args, negocioId, fmt, tz) {
  let dateFilter
  switch (args.periodo) {
    case 'hoy':
      dateFilter = `fecha >= (date_trunc('day', now() AT TIME ZONE '${tz}') AT TIME ZONE '${tz}')`
      break
    case 'semana':
      dateFilter = `fecha >= (date_trunc('week', now() AT TIME ZONE '${tz}') AT TIME ZONE '${tz}')`
      break
    case 'mes':
      dateFilter = `fecha >= (date_trunc('month', now() AT TIME ZONE '${tz}') AT TIME ZONE '${tz}')`
      break
    default:
      dateFilter = `fecha >= (date_trunc('day', now() AT TIME ZONE '${tz}') AT TIME ZONE '${tz}')`
  }

  // Date filter for transacciones (DATE column, no timezone conversion needed)
  let transDateFilter
  switch (args.periodo) {
    case 'hoy':
      transDateFilter = `fecha >= (now() AT TIME ZONE '${tz}')::date AND fecha < ((now() AT TIME ZONE '${tz}')::date + interval '1 day')`
      break
    case 'semana':
      transDateFilter = `fecha >= date_trunc('week', now() AT TIME ZONE '${tz}')::date AND fecha < (date_trunc('week', now() AT TIME ZONE '${tz}')::date + interval '7 days')`
      break
    case 'mes':
      transDateFilter = `fecha >= date_trunc('month', now() AT TIME ZONE '${tz}')::date AND fecha < (date_trunc('month', now() AT TIME ZONE '${tz}')::date + interval '1 month')`
      break
    default:
      transDateFilter = `fecha >= (now() AT TIME ZONE '${tz}')::date AND fecha < ((now() AT TIME ZONE '${tz}')::date + interval '1 day')`
  }

  const [lavadaStats, transStats, clienteStats] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) as total_lavadas,
              COALESCE(SUM(valor), 0) as valor_lavadas,
              COALESCE(SUM((SELECT COALESCE(SUM((p->>'valor')::numeric), 0) FROM jsonb_array_elements(pagos) p)), 0) as cobrado_lavadas,
              COUNT(CASE WHEN estado = 'EN ESPERA' THEN 1 END) as en_espera,
              COUNT(CASE WHEN estado = 'EN LAVADO' THEN 1 END) as en_lavado,
              COUNT(CASE WHEN estado = 'TERMINADO' THEN 1 END) as terminados,
              COUNT(CASE WHEN estado = 'ENTREGADO' THEN 1 END) as entregados
       FROM lavadas
       WHERE negocio_id = $1 AND ${dateFilter}`,
      [negocioId]
    ),
    pool.query(
      `SELECT tipo, COALESCE(SUM(valor), 0) as total
       FROM transacciones
       WHERE negocio_id = $1 AND ${transDateFilter}
       GROUP BY tipo`,
      [negocioId]
    ),
    pool.query(
      `SELECT COUNT(*) as total_clientes FROM clientes WHERE negocio_id = $1`,
      [negocioId]
    ),
  ])

  const s = lavadaStats.rows[0]
  const ingresosTrans = Number(transStats.rows.find(r => r.tipo === 'INGRESO')?.total || 0)
  const egresosTrans = Number(transStats.rows.find(r => r.tipo === 'EGRESO')?.total || 0)
  const cobradoLavadas = Number(s.cobrado_lavadas)
  const valorLavadas = Number(s.valor_lavadas)
  const totalIngresos = cobradoLavadas + ingresosTrans
  const balance = totalIngresos - egresosTrans
  return {
    _instruccion: 'USA EXACTAMENTE ESTOS NÚMEROS EN TU RESPUESTA. NO INVENTES OTROS.',
    periodo: args.periodo,
    total_lavadas: parseInt(s.total_lavadas),
    en_espera: parseInt(s.en_espera),
    en_lavado: parseInt(s.en_lavado),
    terminados: parseInt(s.terminados),
    entregados: parseInt(s.entregados),
    lavadas_completadas: parseInt(s.terminados) + parseInt(s.entregados),
    valor_servicios: fmt(valorLavadas),
    cobrado_servicios: fmt(cobradoLavadas),
    ingresos_otros: fmt(ingresosTrans),
    egresos: fmt(egresosTrans),
    ingresos_totales: fmt(totalIngresos),
    balance: fmt(balance),
    total_clientes: parseInt(clienteStats.rows[0].total_clientes),
    resumen_texto: `Periodo: ${args.periodo}. Total lavadas: ${s.total_lavadas} (EN ESPERA: ${s.en_espera}, EN LAVADO: ${s.en_lavado}, TERMINADO: ${s.terminados}, ENTREGADO: ${s.entregados}). Lavadas completadas: ${parseInt(s.terminados) + parseInt(s.entregados)}. Valor servicios: ${fmt(valorLavadas)}. Cobrado servicios: ${fmt(cobradoLavadas)}. Otros ingresos (productos/membresías): ${fmt(ingresosTrans)}. Egresos: ${fmt(egresosTrans)}. Total ingresos: ${fmt(totalIngresos)}. Balance: ${fmt(balance)}.`,
  }
}

async function rankingLavadores(args, negocioId, fmt, tz) {
  const conditions = ['l.negocio_id = $1']
  const params = [negocioId]
  let idx = 2

  if (args.fecha_desde) {
    conditions.push(`l.fecha >= ($${idx}::timestamp AT TIME ZONE '${tz}')`)
    params.push(args.fecha_desde)
    idx++
  } else {
    conditions.push(`l.fecha >= (date_trunc('day', now() AT TIME ZONE '${tz}') AT TIME ZONE '${tz}')`)
  }
  if (args.fecha_hasta) {
    conditions.push(`l.fecha < (($${idx}::date + interval '1 day')::timestamp AT TIME ZONE '${tz}')`)
    params.push(args.fecha_hasta)
    idx++
  }

  const orderCol = args.orden === 'ingresos' ? 'total_ingresos' : 'total_lavadas'

  const sql = `
    SELECT lav.nombre AS lavador,
           COUNT(*) AS total_lavadas,
           COALESCE(SUM(l.valor), 0) AS total_ingresos
    FROM lavadas l
    JOIN lavadores lav ON lav.id = l.lavador_id
    WHERE ${conditions.join(' AND ')}
    GROUP BY lav.id, lav.nombre
    ORDER BY ${orderCol} DESC
    LIMIT 10
  `
  const { rows } = await pool.query(sql, params)
  const resumen = rows.length === 0
    ? 'No hay datos de lavadores en este periodo.'
    : rows.map((r, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`
        return `${medal} ${r.lavador} — ${r.total_lavadas} lavadas — ${fmt(r.total_ingresos)}`
      }).join('\n')
  return {
    _instruccion: 'USA EXACTAMENTE ESTOS DATOS. NO INVENTES OTROS.',
    resumen_texto: `Ranking de lavadores:\n${resumen}`
  }
}

async function queryTransacciones(args, negocioId, fmt) {
  const conditions = ['t.negocio_id = $1']
  const params = [negocioId]
  let idx = 2

  if (args.fecha_desde) {
    conditions.push(`t.fecha >= $${idx}::date`)
    params.push(args.fecha_desde)
    idx++
  }
  if (args.fecha_hasta) {
    conditions.push(`t.fecha <= $${idx}::date`)
    params.push(args.fecha_hasta)
    idx++
  }
  if (args.tipo) {
    conditions.push(`t.tipo = $${idx}`)
    params.push(args.tipo)
    idx++
  }
  if (args.categoria) {
    conditions.push(`t.categoria ILIKE $${idx}`)
    params.push(`%${args.categoria}%`)
    idx++
  }

  const sql = `
    SELECT t.id, t.tipo, t.categoria, t.descripcion, t.valor, t.placa_o_persona, t.fecha,
           mp.nombre AS metodo_pago
    FROM transacciones t
    LEFT JOIN metodos_pago mp ON mp.id = t.metodo_pago_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY t.fecha DESC, t.created_at DESC
    LIMIT 30
  `
  const { rows } = await pool.query(sql, params)
  const totales = rows.reduce((acc, t) => {
    if (t.tipo === 'INGRESO') acc.ingresos += Number(t.valor)
    else acc.egresos += Number(t.valor)
    return acc
  }, { ingresos: 0, egresos: 0 })
  const resumen = rows.length === 0
    ? 'No se encontraron transacciones.'
    : rows.map((t, i) => `${i+1}. ${t.tipo} — ${t.categoria || 'Sin categoría'} — ${fmt(t.valor)} — ${t.fecha}`).join('\n')
  return {
    _instruccion: 'USA EXACTAMENTE ESTOS DATOS. NO INVENTES OTROS.',
    total: rows.length, ingresos: totales.ingresos, egresos: totales.egresos,
    resumen_texto: `${rows.length} transacción(es). Ingresos: ${fmt(totales.ingresos)}. Egresos: ${fmt(totales.egresos)}.\n${resumen}`
  }
}

async function resumenFinanciero(args, negocioId, fmt, tz) {
  const desde = args.fecha_desde || null
  const hasta = args.fecha_hasta || null
  const useLiteral = !args.fecha_desde

  // Lavadas income (from pagos JSONB)
  const lavadaParams = [negocioId]
  let lavadaDateFilter = useLiteral
    ? `l.fecha >= (date_trunc('day', now() AT TIME ZONE '${tz}') AT TIME ZONE '${tz}')`
    : `l.fecha >= ($2::timestamp AT TIME ZONE '${tz}')`
  if (!useLiteral) lavadaParams.push(desde)
  if (hasta) {
    lavadaParams.push(hasta)
    lavadaDateFilter += ` AND l.fecha < (($${lavadaParams.length}::date + interval '1 day')::timestamp AT TIME ZONE '${tz}')`
  }

  const [lavadaRes, transRes, metodosRes] = await Promise.all([
    pool.query(`
      SELECT COUNT(*) AS total_lavadas,
             COALESCE(SUM(l.valor), 0) AS valor_total_servicios,
             COALESCE(SUM((SELECT COALESCE(SUM((p->>'valor')::numeric), 0) FROM jsonb_array_elements(l.pagos) p)), 0) AS cobrado_servicios
      FROM lavadas l
      WHERE l.negocio_id = $1 AND ${lavadaDateFilter}
    `, lavadaParams),
    (() => {
      const transParams = [negocioId]
      let transDateFilter = useLiteral
        ? `fecha >= (now() AT TIME ZONE '${tz}')::date`
        : (transParams.push(desde), `fecha >= $${transParams.length}::date`)
      if (hasta) {
        transParams.push(hasta)
        transDateFilter += ` AND fecha <= $${transParams.length}::date`
      }
      return pool.query(`
        SELECT tipo,
               COALESCE(SUM(valor), 0) AS total
        FROM transacciones
        WHERE negocio_id = $1 AND ${transDateFilter}
        GROUP BY tipo
      `, transParams)
    })(),
    pool.query(`
      SELECT mp.nombre AS metodo,
             COALESCE(SUM((p->>'valor')::numeric), 0) AS total
      FROM lavadas l, jsonb_array_elements(l.pagos) p
      LEFT JOIN metodos_pago mp ON mp.id = (p->>'metodo_pago_id')::uuid
      WHERE l.negocio_id = $1 AND ${lavadaDateFilter}
      GROUP BY mp.nombre
      ORDER BY total DESC
    `, lavadaParams),
  ])

  const lavada = lavadaRes.rows[0]
  const ingresosTrans = Number(transRes.rows.find(r => r.tipo === 'INGRESO')?.total || 0)
  const egresosTrans = Number(transRes.rows.find(r => r.tipo === 'EGRESO')?.total || 0)

  const totalLavadas = parseInt(lavada.total_lavadas)
  const valorTotal = Number(lavada.valor_total_servicios)
  const cobrado = Number(lavada.cobrado_servicios)
  const pendiente = valorTotal - cobrado
  const balance = cobrado + ingresosTrans - egresosTrans
  const metodos = metodosRes.rows.map(r => `${r.metodo}: ${fmt(r.total)}`).join(', ') || 'Sin pagos registrados'

  return {
    _instruccion: 'USA EXACTAMENTE ESTOS NÚMEROS EN TU RESPUESTA. NO INVENTES OTROS.',
    total_lavadas: totalLavadas,
    valor_total_servicios: fmt(valorTotal),
    cobrado: fmt(cobrado),
    pendiente_por_cobrar: fmt(pendiente),
    ingresos_otros: fmt(ingresosTrans),
    egresos: fmt(egresosTrans),
    balance: fmt(balance),
    metodos_de_pago: metodos,
    resumen_texto: `Lavadas: ${totalLavadas}. Valor total servicios: ${fmt(valorTotal)}. Cobrado: ${fmt(cobrado)}. Pendiente por cobrar: ${fmt(pendiente)}. Otros ingresos: ${fmt(ingresosTrans)}. Egresos: ${fmt(egresosTrans)}. Balance: ${fmt(balance)}. Métodos de pago: ${metodos}.`,
  }
}

async function queryProductosServicios(negocioId, fmt) {
  const [tiposLavado, adicionales, membresias, productos, metodos] = await Promise.all([
    pool.query(`SELECT nombre, precio, activo FROM tipos_lavado WHERE negocio_id = $1 ORDER BY nombre`, [negocioId]),
    pool.query(`SELECT nombre, precio, activo FROM servicios_adicionales WHERE negocio_id = $1 ORDER BY nombre`, [negocioId]),
    pool.query(`SELECT nombre, precio, descuento, cashback, duracion_dias, activo FROM tipos_membresia WHERE negocio_id = $1 ORDER BY nombre`, [negocioId]),
    pool.query(`SELECT nombre, precio, cantidad, activo FROM productos WHERE negocio_id = $1 ORDER BY nombre`, [negocioId]),
    pool.query(`SELECT nombre, activo FROM metodos_pago WHERE negocio_id = $1 ORDER BY nombre`, [negocioId]),
  ])
  const fmtList = (arr) => arr.map(r => `${r.nombre}: ${fmt(r.precio)}${r.activo ? '' : ' (inactivo)'}`).join(', ')
  return {
    _instruccion: 'USA EXACTAMENTE ESTOS DATOS. NO INVENTES OTROS.',
    resumen_texto: `Tipos de lavado: ${fmtList(tiposLavado.rows) || 'Ninguno'}. Adicionales: ${fmtList(adicionales.rows) || 'Ninguno'}. Membresías: ${fmtList(membresias.rows) || 'Ninguna'}. Productos: ${fmtList(productos.rows) || 'Ninguno'}. Métodos: ${metodos.rows.map(m => m.nombre).join(', ') || 'Ninguno'}.`
  }
}

// ============================================
// crear_lavada — AI-driven lavada creation
// ============================================
async function crearLavada(args, negocioId, io, fmt, tz) {
  const placa = (args.placa || '').toUpperCase().trim()
  if (!placa) return { error: 'La placa es obligatoria.' }

  // 1. Find tipo_lavado by name
  const { rows: tiposRows } = await pool.query(
    `SELECT id, nombre, precio FROM tipos_lavado WHERE negocio_id = $1 AND activo = true AND nombre ILIKE $2`,
    [negocioId, `%${args.tipo_lavado_nombre}%`]
  )
  if (tiposRows.length === 0) {
    const { rows: allTipos } = await pool.query(
      `SELECT nombre, precio FROM tipos_lavado WHERE negocio_id = $1 AND activo = true ORDER BY nombre`,
      [negocioId]
    )
    return {
      error: `No encontre un tipo de lavado "${args.tipo_lavado_nombre}".`,
      opciones_disponibles: allTipos.map(t => `${t.nombre} (${fmt(t.precio)})`),
    }
  }
  const tipoLavado = tiposRows[0]

  // 2. Find client by placa
  const { rows: clienteRows } = await pool.query(
    `SELECT c.id, c.nombre, c.moto, c.membresia_id, tm.descuento
     FROM clientes c
     LEFT JOIN tipos_membresia tm ON tm.id = c.membresia_id
       AND c.fecha_fin_membresia >= (now() AT TIME ZONE '${tz}')::date
     WHERE c.negocio_id = $1 AND UPPER(c.placa) = $2`,
    [negocioId, placa]
  )

  let clienteId = null
  let descuentoMembresia = 0

  if (clienteRows.length > 0) {
    clienteId = clienteRows[0].id
    descuentoMembresia = Number(clienteRows[0].descuento || 0)
  } else if (args.nombre_cliente) {
    // Create minimal client
    const { rows: defaultMem } = await pool.query(
      `SELECT id FROM tipos_membresia WHERE negocio_id = $1 AND precio = 0 ORDER BY created_at LIMIT 1`,
      [negocioId]
    )
    const membresiaId = defaultMem[0]?.id || null
    const { rows: newClient } = await pool.query(
      `INSERT INTO clientes (nombre, placa, moto, membresia_id, negocio_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [args.nombre_cliente, placa, args.moto || null, membresiaId, negocioId]
    )
    clienteId = newClient[0].id

    // Emit realtime for new client
    if (io) {
      io.to(`negocio:${negocioId}`).emit('db:clientes', { event: 'INSERT', table: 'clientes' })
    }
  } else {
    return {
      error: `No encontre un cliente con placa ${placa}. Necesito el nombre del cliente para crearlo. Preguntale al usuario el nombre.`,
    }
  }

  // 3. Find lavador (optional)
  let lavadorId = null
  if (args.lavador_nombre) {
    const { rows: lavRows } = await pool.query(
      `SELECT id, nombre FROM lavadores WHERE negocio_id = $1 AND activo = true AND nombre ILIKE $2`,
      [negocioId, `%${args.lavador_nombre}%`]
    )
    if (lavRows.length === 0) {
      const { rows: allLav } = await pool.query(
        `SELECT nombre FROM lavadores WHERE negocio_id = $1 AND activo = true ORDER BY nombre`,
        [negocioId]
      )
      return {
        error: `No encontre un lavador "${args.lavador_nombre}".`,
        lavadores_disponibles: allLav.map(l => l.nombre),
      }
    }
    lavadorId = lavRows[0].id
  }

  // 4. Resolve adicionales
  let adicionalesJson = []
  let totalAdicionales = 0
  if (args.adicionales_nombres && args.adicionales_nombres.length > 0) {
    for (const nombre of args.adicionales_nombres) {
      const { rows: adRows } = await pool.query(
        `SELECT id, nombre, precio FROM servicios_adicionales WHERE negocio_id = $1 AND activo = true AND nombre ILIKE $2`,
        [negocioId, `%${nombre}%`]
      )
      if (adRows.length > 0) {
        adicionalesJson.push({
          id: adRows[0].id,
          nombre: adRows[0].nombre,
          precio: Number(adRows[0].precio),
        })
        totalAdicionales += Number(adRows[0].precio)
      }
    }
  }

  // 5. Calculate valor
  const precioBase = Number(tipoLavado.precio)
  const subtotal = precioBase + totalAdicionales
  const descuento = Math.round(subtotal * (descuentoMembresia / 100))
  const valor = Math.max(0, subtotal - descuento)

  // 6. Plan limit check (free plan = 50 lavadas/month)
  const { rows: negocioRows } = await pool.query(
    `SELECT plan, trial_ends_at, subscription_expires_at FROM negocios WHERE id = $1`,
    [negocioId]
  )
  const negocio = negocioRows[0]
  const now = new Date()
  const isPro = (negocio.subscription_expires_at && new Date(negocio.subscription_expires_at) > now)
    || (negocio.trial_ends_at && new Date(negocio.trial_ends_at) > now)

  if (!isPro) {
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM lavadas
       WHERE negocio_id = $1 AND fecha >= (date_trunc('month', now() AT TIME ZONE '${tz}') AT TIME ZONE '${tz}')`,
      [negocioId]
    )
    if (parseInt(countRows[0].cnt) >= 50) {
      return { error: 'Limite del plan gratuito alcanzado (50 lavadas/mes). Actualiza a PRO para continuar.' }
    }
  }

  // 7. INSERT lavada
  const { rows: insertedRows } = await pool.query(
    `INSERT INTO lavadas (placa, cliente_id, tipo_lavado_id, lavador_id, valor, estado, fecha, tiempo_espera_inicio, notas, adicionales, negocio_id)
     VALUES ($1, $2, $3, $4, $5, 'EN ESPERA', now(), now(), $6, $7::jsonb, $8)
     RETURNING id`,
    [placa, clienteId, tipoLavado.id, lavadorId, valor, args.notas || null, JSON.stringify(adicionalesJson), negocioId]
  )
  const lavadaId = insertedRows[0].id

  // 8. Re-select with JOINs for full record
  const { rows: fullRows } = await pool.query(
    `SELECT l.*, c.nombre AS cliente_nombre, tl.nombre AS tipo_lavado, lav.nombre AS lavador_nombre
     FROM lavadas l
     LEFT JOIN clientes c ON c.id = l.cliente_id
     LEFT JOIN tipos_lavado tl ON tl.id = l.tipo_lavado_id
     LEFT JOIN lavadores lav ON lav.id = l.lavador_id
     WHERE l.id = $1`,
    [lavadaId]
  )

  // 9. Emit Socket.io event
  if (io) {
    io.to(`negocio:${negocioId}`).emit('db:lavadas', {
      event: 'INSERT',
      table: 'lavadas',
      record: fullRows[0],
    })
  }

  // 10. Auto-promote client to "CLIENTE FRECUENTE" if >1 service this month
  if (clienteId) {
    const { rows: monthCount } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM lavadas
       WHERE cliente_id = $1 AND negocio_id = $2
         AND fecha >= (date_trunc('month', now() AT TIME ZONE '${tz}') AT TIME ZONE '${tz}')`,
      [clienteId, negocioId]
    )
    if (parseInt(monthCount[0].cnt) > 1) {
      await pool.query(
        `UPDATE clientes SET estado = 'CLIENTE FRECUENTE', updated_at = now() WHERE id = $1 AND estado != 'CLIENTE FRECUENTE'`,
        [clienteId]
      )
    }
  }

  const record = fullRows[0]
  return {
    exito: true,
    resumen: {
      placa: record.placa,
      tipo_lavado: record.tipo_lavado,
      lavador: record.lavador_nombre || 'Sin asignar',
      valor: Number(record.valor),
      estado: record.estado,
      cliente: record.cliente_nombre,
      adicionales: adicionalesJson.map(a => a.nombre),
    },
    resumen_texto: `Lavada creada. Placa: ${record.placa}. Tipo: ${record.tipo_lavado}. Lavador: ${record.lavador_nombre || 'Sin asignar'}. Valor: ${fmt(record.valor)}. Cliente: ${record.cliente_nombre}.${adicionalesJson.length ? ` Adicionales: ${adicionalesJson.map(a => a.nombre).join(', ')}.` : ''}`
  }
}

// ============================================
// analisis_metodos_pago
// ============================================
async function analisisMetodosPago(args, negocioId, fmt, tz) {
  const conditions = ['l.negocio_id = $1']
  const params = [negocioId]
  let idx = 2

  if (args.fecha_desde) {
    conditions.push(`l.fecha >= ($${idx}::timestamp AT TIME ZONE '${tz}')`)
    params.push(args.fecha_desde)
    idx++
  } else {
    conditions.push(`l.fecha >= (date_trunc('week', now() AT TIME ZONE '${tz}') AT TIME ZONE '${tz}')`)
  }
  if (args.fecha_hasta) {
    conditions.push(`l.fecha < (($${idx}::date + interval '1 day')::timestamp AT TIME ZONE '${tz}')`)
    params.push(args.fecha_hasta)
    idx++
  }

  const sql = `
    WITH pagos_desglose AS (
      SELECT (p->>'metodo_pago_id')::uuid AS metodo_id,
             (p->>'valor')::numeric AS monto
      FROM lavadas l, jsonb_array_elements(l.pagos) p
      WHERE ${conditions.join(' AND ')} AND jsonb_array_length(l.pagos) > 0
    )
    SELECT COALESCE(mp.nombre, 'Sin metodo') AS metodo,
           COUNT(*) AS cantidad,
           COALESCE(SUM(pd.monto), 0) AS total
    FROM pagos_desglose pd
    LEFT JOIN metodos_pago mp ON mp.id = pd.metodo_id
    GROUP BY mp.nombre
    ORDER BY total DESC
  `

  const { rows } = await pool.query(sql, params)
  const granTotal = rows.reduce((sum, r) => sum + Number(r.total), 0)
  const resultado = rows.map(r => ({
    metodo: r.metodo,
    cantidad: parseInt(r.cantidad),
    total: Number(r.total),
    porcentaje: granTotal > 0 ? Math.round((Number(r.total) / granTotal) * 100) : 0,
  }))

  const resumen = resultado.length === 0
    ? 'No hay pagos registrados en este periodo.'
    : resultado.map(r => `${r.metodo}: ${r.cantidad} pagos — ${fmt(r.total)} (${r.porcentaje}%)`).join('\n')
  return {
    _instruccion: 'USA EXACTAMENTE ESTOS DATOS. NO INVENTES OTROS.',
    total_general: granTotal,
    resumen_texto: `Métodos de pago. Total: ${fmt(granTotal)}.\n${resumen}`
  }
}

// ============================================
// query_tiempos
// ============================================
async function queryTiempos(args, negocioId, tz) {
  const conditions = ['l.negocio_id = $1']
  const params = [negocioId]
  let idx = 2

  if (args.fecha_desde) {
    conditions.push(`l.fecha >= ($${idx}::timestamp AT TIME ZONE '${tz}')`)
    params.push(args.fecha_desde)
    idx++
  } else {
    conditions.push(`l.fecha >= (date_trunc('week', now() AT TIME ZONE '${tz}') AT TIME ZONE '${tz}')`)
  }
  if (args.fecha_hasta) {
    conditions.push(`l.fecha < (($${idx}::date + interval '1 day')::timestamp AT TIME ZONE '${tz}')`)
    params.push(args.fecha_hasta)
    idx++
  }
  if (args.lavador_nombre) {
    conditions.push(`lav.nombre ILIKE $${idx}`)
    params.push(`%${args.lavador_nombre}%`)
    idx++
  }

  const sql = `
    SELECT
      COALESCE(lav.nombre, 'Sin lavador') AS lavador,
      COUNT(*) AS total_lavadas,
      ROUND(AVG(l.duracion_espera) / 60.0) AS avg_espera_min,
      ROUND(MIN(l.duracion_espera) / 60.0) AS min_espera_min,
      ROUND(MAX(l.duracion_espera) / 60.0) AS max_espera_min,
      ROUND(AVG(l.duracion_lavado) / 60.0) AS avg_lavado_min,
      ROUND(MIN(l.duracion_lavado) / 60.0) AS min_lavado_min,
      ROUND(MAX(l.duracion_lavado) / 60.0) AS max_lavado_min,
      ROUND(AVG(l.duracion_terminado) / 60.0) AS avg_terminado_min,
      ROUND(MIN(l.duracion_terminado) / 60.0) AS min_terminado_min,
      ROUND(MAX(l.duracion_terminado) / 60.0) AS max_terminado_min
    FROM lavadas l
    LEFT JOIN lavadores lav ON lav.id = l.lavador_id
    WHERE ${conditions.join(' AND ')}
    GROUP BY lav.nombre
    ORDER BY total_lavadas DESC
  `

  const { rows } = await pool.query(sql, params)

  // Also compute overall averages
  const overallSql = `
    SELECT
      COUNT(*) AS total_lavadas,
      ROUND(AVG(duracion_espera) / 60.0) AS avg_espera_min,
      ROUND(AVG(duracion_lavado) / 60.0) AS avg_lavado_min,
      ROUND(AVG(duracion_terminado) / 60.0) AS avg_terminado_min
    FROM lavadas l
    LEFT JOIN lavadores lav ON lav.id = l.lavador_id
    WHERE ${conditions.join(' AND ')}
  `
  const { rows: overall } = await pool.query(overallSql, params)

  const g = overall[0]
  const resumenLav = rows.length === 0
    ? 'No hay datos de tiempos.'
    : rows.map(r => `${r.lavador}: ${r.total_lavadas} lavadas — Espera: ${r.avg_espera_min ?? '—'}min — Lavado: ${r.avg_lavado_min ?? '—'}min`).join('\n')
  return {
    _instruccion: 'USA EXACTAMENTE ESTOS DATOS. NO INVENTES OTROS.',
    resumen_texto: `Promedios generales — Espera: ${g.avg_espera_min ?? '—'}min, Lavado: ${g.avg_lavado_min ?? '—'}min, Terminado: ${g.avg_terminado_min ?? '—'}min.\nPor lavador:\n${resumenLav}`
  }
}

// ============================================
// top_clientes
// ============================================
async function topClientes(args, negocioId, fmt, tz) {
  const conditions = ['l.negocio_id = $1']
  const params = [negocioId]
  let idx = 2

  if (args.fecha_desde) {
    conditions.push(`l.fecha >= ($${idx}::timestamp AT TIME ZONE '${tz}')`)
    params.push(args.fecha_desde)
    idx++
  } else {
    conditions.push(`l.fecha >= (date_trunc('month', now() AT TIME ZONE '${tz}') AT TIME ZONE '${tz}')`)
  }
  if (args.fecha_hasta) {
    conditions.push(`l.fecha < (($${idx}::date + interval '1 day')::timestamp AT TIME ZONE '${tz}')`)
    params.push(args.fecha_hasta)
    idx++
  }

  const orderCol = args.orden === 'gasto' ? 'total_gasto' : 'total_visitas'
  const limite = args.limite || 10

  const sql = `
    SELECT c.nombre AS cliente,
           c.placa,
           COUNT(*) AS total_visitas,
           COALESCE(SUM(l.valor), 0) AS total_gasto
    FROM lavadas l
    JOIN clientes c ON c.id = l.cliente_id
    WHERE ${conditions.join(' AND ')}
    GROUP BY c.id, c.nombre, c.placa
    ORDER BY ${orderCol} DESC
    LIMIT $${params.push(parseInt(limite) || 10)}
  `

  const { rows } = await pool.query(sql, params)
  const resumen = rows.length === 0
    ? 'No hay datos de clientes en este periodo.'
    : rows.map((c, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`
        return `${medal} ${c.cliente} (${c.placa}) — ${c.total_visitas} visitas — ${fmt(c.total_gasto)}`
      }).join('\n')
  return {
    _instruccion: 'USA EXACTAMENTE ESTOS DATOS. NO INVENTES OTROS.',
    resumen_texto: `Top clientes:\n${resumen}`
  }
}
