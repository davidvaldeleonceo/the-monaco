import { useState, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { useData } from './DataContext'
import { useTenant } from './TenantContext'
import { logAudit } from '../utils/auditLog'
import { Plus, Search, X, Edit, Trash2, ChevronDown, SlidersHorizontal, Upload, Download, CheckSquare, Sparkles } from 'lucide-react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { registerLocale } from 'react-datepicker'
import es from 'date-fns/locale/es'
import * as XLSX from 'xlsx'

registerLocale('es', es)

export default function Clientes() {
  const { clientes, tiposMembresia, loading, addClienteLocal, updateClienteLocal, deleteClienteLocal, refreshClientes, negocioId } = useData()
  const { userEmail } = useTenant()

  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [search, setSearch] = useState('')
  const [filtroTipoCliente, setFiltroTipoCliente] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [fechaDesde, setFechaDesde] = useState(null)
  const [fechaHasta, setFechaHasta] = useState(null)
  const [filtroRapido, setFiltroRapido] = useState('')
  const [expandedCard, setExpandedCard] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedClientes, setSelectedClientes] = useState(new Set())
  const [modoSeleccion, setModoSeleccion] = useState(false)
  const [filtroNuevos, setFiltroNuevos] = useState(false)

  // Import CSV states
  const [showImportModal, setShowImportModal] = useState(false)
  const [importData, setImportData] = useState([])
  const [importErrors, setImportErrors] = useState([])
  const [importDuplicados, setImportDuplicados] = useState([])
  const [importNuevos, setImportNuevos] = useState([])
  const [importStep, setImportStep] = useState('upload')
  const [dupAction, setDupAction] = useState('skip')
  const [importProgress, setImportProgress] = useState(0)
  const [importResult, setImportResult] = useState(null)
  const fileInputRef = useRef(null)

  const [formData, setFormData] = useState({
    nombre: '',
    cedula: '',
    telefono: '',
    correo: '',
    placa: '',
    moto: '',
    membresia_id: '',
    fecha_inicio_membresia: null,
    fecha_fin_membresia: null,
    estado: 'Activo'
  })

  const fechaLocalStr = (date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const handleMembresiaChange = (membresiaId) => {
    const membresia = tiposMembresia.find(m => m.id === membresiaId)
    const hoy = new Date()

    if (!membresiaId || membresia?.nombre?.toLowerCase().includes('sin ')) {
      setFormData(prev => ({
        ...prev,
        membresia_id: membresiaId,
        fecha_inicio_membresia: hoy,
        fecha_fin_membresia: hoy
      }))
    } else {
      const meses = membresia?.duracion_dias || 1
      const fin = new Date()
      fin.setMonth(fin.getMonth() + meses)
      setFormData(prev => ({
        ...prev,
        membresia_id: membresiaId,
        fecha_inicio_membresia: hoy,
        fecha_fin_membresia: fin
      }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    let formToSend = { ...formData }
    if (!formToSend.membresia_id) {
      const sinMembresia = tiposMembresia.find(m => m.nombre.toLowerCase().includes('sin '))
      if (sinMembresia) {
        const hoy = new Date()
        formToSend.membresia_id = sinMembresia.id
        formToSend.fecha_inicio_membresia = hoy
        formToSend.fecha_fin_membresia = hoy
      }
    }

    const cleanData = Object.fromEntries(
      Object.entries(formToSend).map(([key, value]) => {
        if (value === '' || value === null) return [key, null]
        if ((key === 'fecha_inicio_membresia' || key === 'fecha_fin_membresia') && value instanceof Date) {
          return [key, fechaLocalStr(value)]
        }
        return [key, value]
      })
    )

    if (editando) {
      const { data, error } = await supabase
        .from('clientes')
        .update(cleanData)
        .eq('id', editando)
        .select('*, membresia:tipos_membresia(nombre)')
        .single()

      if (!error && data) {
        updateClienteLocal(editando, data)
        logAudit({ tabla: 'clientes', accion: 'update', registro_id: editando, despues: { nombre: data.nombre, placa: data.placa }, descripcion: `Cliente actualizado: ${data.nombre}`, usuario_email: userEmail, negocio_id: negocioId })
      }
    } else {
      const { data, error } = await supabase
        .from('clientes')
        .insert([{ ...cleanData, negocio_id: negocioId }])
        .select('*, membresia:tipos_membresia(nombre)')
        .single()

      if (!error && data) {
        addClienteLocal(data)
        logAudit({ tabla: 'clientes', accion: 'create', registro_id: data.id, despues: { nombre: data.nombre, placa: data.placa }, descripcion: `Nuevo cliente: ${data.nombre} (${data.placa})`, usuario_email: userEmail, negocio_id: negocioId })
      }
    }

    setShowModal(false)
    setEditando(null)
    setFormData({
      nombre: '',
      cedula: '',
      telefono: '',
      correo: '',
      placa: '',
      moto: '',
      membresia_id: '',
      fecha_inicio_membresia: null,
      fecha_fin_membresia: null,
      estado: 'Activo'
    })
  }

  const parseFecha = (str) => str ? new Date(str + 'T00:00:00') : null

  const formatFecha = (str) => {
    if (!str) return '—'
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
    const d = new Date(str + 'T00:00:00')
    return `${d.getDate()} ${meses[d.getMonth()]} ${d.getFullYear()}`
  }

  const handleEdit = (cliente) => {
    setEditando(cliente.id)
    setFormData({
      nombre: cliente.nombre || '',
      cedula: cliente.cedula || '',
      telefono: cliente.telefono || '',
      correo: cliente.correo || '',
      placa: cliente.placa || '',
      moto: cliente.moto || '',
      membresia_id: cliente.membresia_id || '',
      fecha_inicio_membresia: parseFecha(cliente.fecha_inicio_membresia),
      fecha_fin_membresia: parseFecha(cliente.fecha_fin_membresia),
      estado: cliente.estado || 'Activo'
    })
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (confirm('¿Estás seguro de eliminar este cliente?')) {
      const cliente = clientes.find(c => c.id === id)
      const { error } = await supabase.from('clientes').delete().eq('id', id)
      if (error) {
        alert('No se pudo eliminar: ' + (error.message.includes('foreign key') ? 'El cliente tiene servicios asociados. Elimina sus servicios primero.' : error.message))
      } else {
        deleteClienteLocal(id)
        setSelectedClientes(prev => { const next = new Set(prev); next.delete(id); return next })
        logAudit({ tabla: 'clientes', accion: 'delete', registro_id: id, antes: cliente ? { nombre: cliente.nombre, placa: cliente.placa } : null, descripcion: `Cliente eliminado: ${cliente?.nombre || id}`, usuario_email: userEmail, negocio_id: negocioId })
      }
    }
  }

  const toggleSelectCliente = (id) => {
    setSelectedClientes(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedClientes.size === clientesFiltrados.length) {
      setSelectedClientes(new Set())
    } else {
      setSelectedClientes(new Set(clientesFiltrados.map(c => c.id)))
    }
  }

  const handleBulkDelete = async () => {
    const count = selectedClientes.size
    if (!count) return
    if (!confirm(`¿Estás seguro de eliminar ${count} cliente${count > 1 ? 's' : ''}?`)) return

    const ids = [...selectedClientes]
    let eliminados = 0
    let fallos = 0

    for (const id of ids) {
      const { error } = await supabase.from('clientes').delete().eq('id', id)
      if (!error) {
        deleteClienteLocal(id)
        eliminados++
      } else {
        fallos++
      }
    }

    setSelectedClientes(new Set())
    setModoSeleccion(false)

    if (fallos > 0) {
      alert(`Se eliminaron ${eliminados} de ${count} clientes. ${fallos} no se pudieron eliminar porque tienen servicios asociados.`)
    }
  }

  const descargarPlantilla = () => {
    const bom = '\uFEFF'
    const headers = 'nombre,placa,telefono,cedula,correo,moto,tipo_membresia,fecha_inicio'
    const tipos = tiposMembresia.map(m => m.nombre)
    const ejemplo = `Juan Pérez,ABC123,3001234567,12345678,juan@email.com,Yamaha FZ 2.0,${tipos[0] || 'MENSUAL'},2026-02-10`
    const separador = '\n\n# INSTRUCCIONES (borra estas líneas antes de importar)'
    const instrucciones = [
      '# Columnas obligatorias: nombre - placa - telefono',
      '# Columnas opcionales: cedula - correo - moto - tipo_membresia - fecha_inicio',
      '# Teléfono: solo números sin espacios ni guiones (ej: 3001234567)',
      '# Placa: se convierte a mayúsculas automáticamente',
      `# Tipos de membresía válidos: ${tipos.join(' | ') || '(ninguno configurado)'}`,
      '# Si tipo_membresia queda vacío o no coincide se asignará SIN MEMBRESIA',
      '# fecha_inicio: formato AAAA-MM-DD (ej: 2026-02-10). Si queda vacío se usa la fecha de hoy'
    ]
    const csv = bom + [headers, ejemplo, separador, ...instrucciones].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plantilla_clientes.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const isCSV = file.name.toLowerCase().endsWith('.csv')
    const reader = new FileReader()
    reader.onload = (evt) => {
      let wb
      if (isCSV) {
        wb = XLSX.read(evt.target.result, { type: 'string', cellDates: true })
      } else {
        const data = new Uint8Array(evt.target.result)
        wb = XLSX.read(data, { type: 'array', cellDates: true })
      }
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: true })

      const errors = []
      const duplicados = []
      const nuevos = []

      const nombresMembresia = tiposMembresia.map(m => m.nombre).join(', ')

      rows.forEach((row, idx) => {
        const fila = idx + 2
        const nombre = (row.nombre || '').toString().trim()
        const placa = (row.placa || '').toString().trim().toUpperCase()
        const telefono = (row.telefono || '').toString().trim()

        const camposVacios = []
        if (!nombre) camposVacios.push('nombre')
        if (!placa) camposVacios.push('placa')
        if (!telefono) camposVacios.push('telefono')

        if (camposVacios.length > 0) {
          errors.push({
            fila,
            problema: `La columna "${camposVacios.join('", "')}" está vacía`,
            solucion: `Abre el archivo y llena ${camposVacios.length > 1 ? 'las columnas' : 'la columna'} ${camposVacios.join(', ')} en la fila ${fila}`
          })
          return
        }

        const tipoNombre = (row.tipo_membresia || '').toString().trim()
        let membresiaId = null
        let membresiaWarning = null
        if (tipoNombre) {
          const match = tiposMembresia.find(m => m.nombre.toLowerCase() === tipoNombre.toLowerCase())
          if (match) {
            membresiaId = match.id
          } else {
            membresiaWarning = `"${tipoNombre}" no coincide con ninguna membresía`
          }
        }
        if (!membresiaId) {
          const sinMem = tiposMembresia.find(m => m.nombre.toLowerCase().includes('sin '))
          membresiaId = sinMem ? sinMem.id : null
          if (!membresiaWarning && !tipoNombre) {
            membresiaWarning = 'No se indicó tipo de membresía'
          }
        }

        if (membresiaWarning) {
          errors.push({
            fila,
            problema: `${membresiaWarning} → se asignará "SIN MEMBRESIA"`,
            solucion: `Usa uno de los nombres válidos: ${nombresMembresia}`,
            tipo: 'warning'
          })
        }

        let fechaInicio = null
        const fechaRawVal = row.fecha_inicio
        if (fechaRawVal) {
          // Date object from cellDates: true
          if (fechaRawVal instanceof Date && !isNaN(fechaRawVal.getTime())) {
            const y = fechaRawVal.getUTCFullYear()
            const m = String(fechaRawVal.getUTCMonth() + 1).padStart(2, '0')
            const dd = String(fechaRawVal.getUTCDate()).padStart(2, '0')
            fechaInicio = `${y}-${m}-${dd}`
          }
          if (!fechaInicio) {
            const fechaRaw = fechaRawVal.toString().trim()
            // YYYY-MM-DD string
            const matchISO = fechaRaw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
            if (matchISO) {
              const d = new Date(fechaRaw + 'T00:00:00')
              if (!isNaN(d.getTime())) fechaInicio = fechaRaw
            }
            // DD/MM/YYYY string
            if (!fechaInicio) {
              const matchDMY = fechaRaw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
              if (matchDMY) {
                const dd = matchDMY[1].padStart(2, '0')
                const mm = matchDMY[2].padStart(2, '0')
                const d = new Date(`${matchDMY[3]}-${mm}-${dd}T00:00:00`)
                if (!isNaN(d.getTime())) fechaInicio = `${matchDMY[3]}-${mm}-${dd}`
              }
            }
            if (!fechaInicio) {
              errors.push({
                fila,
                problema: `Fecha "${fechaRaw}" no tiene formato válido`,
                solucion: 'Usa el formato AAAA-MM-DD (ej: 2026-02-10)',
                tipo: 'warning'
              })
            }
          }
        }

        const parsed = {
          nombre,
          placa,
          telefono,
          cedula: (row.cedula || '').toString().trim() || null,
          correo: (row.correo || '').toString().trim() || null,
          moto: (row.moto || '').toString().trim() || null,
          membresia_id: membresiaId,
          tipo_membresia_nombre: tipoNombre || 'SIN MEMBRESIA',
          fecha_inicio: fechaInicio
        }

        const existente = clientes.find(c => c.placa?.toUpperCase() === placa)
        if (existente) {
          duplicados.push({ ...parsed, clienteExistenteId: existente.id })
        } else if (nuevos.find(n => n.placa === placa)) {
          errors.push({
            fila,
            problema: `La placa "${placa}" está repetida dentro del archivo`,
            solucion: 'Elimina la fila duplicada del archivo, solo debe aparecer una vez cada placa'
          })
        } else {
          nuevos.push(parsed)
        }
      })

      setImportData(rows)
      setImportErrors(errors)
      setImportDuplicados(duplicados)
      setImportNuevos(nuevos)
      setImportStep('preview')
    }
    if (isCSV) {
      reader.readAsText(file, 'UTF-8')
    } else {
      reader.readAsArrayBuffer(file)
    }
  }

  const calcularFechasMembresia = (membresiaId, fechaInicioStr) => {
    const membresia = tiposMembresia.find(m => m.id === membresiaId)
    const inicio = fechaInicioStr ? new Date(fechaInicioStr + 'T00:00:00') : new Date()

    if (!membresiaId || membresia?.nombre?.toLowerCase().includes('sin ')) {
      return { fecha_inicio_membresia: fechaLocalStr(inicio), fecha_fin_membresia: fechaLocalStr(inicio) }
    }

    const meses = membresia?.duracion_dias || 1
    const fin = new Date(inicio)
    fin.setMonth(fin.getMonth() + meses)
    return { fecha_inicio_membresia: fechaLocalStr(inicio), fecha_fin_membresia: fechaLocalStr(fin) }
  }

  const ejecutarImportacion = async () => {
    setImportStep('importing')
    setImportProgress(0)

    let insertados = 0
    let actualizados = 0
    let errores = 0
    const failedRows = []
    const total = importNuevos.length + (dupAction === 'update' ? importDuplicados.length : 0)
    let procesados = 0

    // Insert new clients one by one to isolate failures
    for (const row of importNuevos) {
      const fechas = calcularFechasMembresia(row.membresia_id, row.fecha_inicio)
      const { error } = await supabase.from('clientes').insert([{
        nombre: row.nombre,
        placa: row.placa,
        telefono: row.telefono,
        cedula: row.cedula,
        correo: row.correo,
        moto: row.moto,
        membresia_id: row.membresia_id,
        estado: 'Activo',
        negocio_id: negocioId,
        ...fechas
      }])
      if (error) {
        errores++
        failedRows.push({ placa: row.placa, nombre: row.nombre, error: error.message })
      } else {
        insertados++
      }
      procesados++
      setImportProgress(Math.round((procesados / total) * 100))
    }

    // Update duplicates if selected
    if (dupAction === 'update' && importDuplicados.length > 0) {
      for (const dup of importDuplicados) {
        const fechas = calcularFechasMembresia(dup.membresia_id, dup.fecha_inicio)
        const { error } = await supabase.from('clientes').update({
          nombre: dup.nombre,
          telefono: dup.telefono,
          cedula: dup.cedula,
          correo: dup.correo,
          moto: dup.moto,
          membresia_id: dup.membresia_id,
          estado: 'Activo',
          ...fechas
        }).eq('id', dup.clienteExistenteId)

        if (error) {
          errores++
          failedRows.push({ placa: dup.placa, nombre: dup.nombre, error: error.message })
        } else {
          actualizados++
        }
        procesados++
        setImportProgress(Math.round((procesados / total) * 100))
      }
    }

    await refreshClientes()
    setImportResult({ insertados, actualizados, errores, failedRows })
    setImportStep('done')
  }

  const resetImport = () => {
    setShowImportModal(false)
    setImportData([])
    setImportErrors([])
    setImportDuplicados([])
    setImportNuevos([])
    setImportStep('upload')
    setDupAction('skip')
    setImportProgress(0)
    setImportResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const aplicarFiltroRapido = (tipo) => {
    setFiltroRapido(tipo)
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    switch (tipo) {
      case 'hoy':
        setFechaDesde(hoy)
        setFechaHasta(hoy)
        break
      case 'semana': {
        const inicioSemana = new Date(hoy)
        const diaS = hoy.getDay()
        inicioSemana.setDate(hoy.getDate() - (diaS === 0 ? 6 : diaS - 1))
        const finSemana = new Date(inicioSemana)
        finSemana.setDate(inicioSemana.getDate() + 6)
        setFechaDesde(inicioSemana)
        setFechaHasta(finSemana)
        break
      }
      case 'mes': {
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
        const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
        setFechaDesde(inicioMes)
        setFechaHasta(finMes)
        break
      }
      case 'año': {
        const inicioAño = new Date(hoy.getFullYear(), 0, 1)
        const finAño = new Date(hoy.getFullYear(), 11, 31)
        setFechaDesde(inicioAño)
        setFechaHasta(finAño)
        break
      }
      case 'todas':
        setFechaDesde(null)
        setFechaHasta(null)
        break
      default:
        break
    }
  }

  const isClienteNuevo = (cliente) => {
    if (!cliente.created_at) return false
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const created = new Date(cliente.created_at)
    created.setHours(0, 0, 0, 0)
    return created.getTime() === hoy.getTime()
  }

  const getEstadoCliente = (cliente) => {
    if (!cliente.fecha_inicio_membresia || !cliente.fecha_fin_membresia) return 'Inactivo'
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const inicio = new Date(cliente.fecha_inicio_membresia + 'T00:00:00')
    const fin = new Date(cliente.fecha_fin_membresia + 'T00:00:00')
    return hoy >= inicio && hoy <= fin ? 'Activo' : 'Inactivo'
  }

  const clientesFiltrados = clientes.filter(c => {
    const matchSearch = c.nombre?.toLowerCase().includes(search.toLowerCase()) ||
      c.placa?.toLowerCase().includes(search.toLowerCase()) ||
      c.cedula?.includes(search) ||
      c.telefono?.includes(search)
    const matchTipo = !filtroTipoCliente || c.membresia_id === filtroTipoCliente
    const matchEstado = !filtroEstado || getEstadoCliente(c) === filtroEstado

    let matchFechaDesde = true
    let matchFechaHasta = true
    if (c.fecha_fin_membresia) {
      const venc = new Date(c.fecha_fin_membresia + 'T00:00:00')
      if (fechaDesde) {
        const desde = new Date(fechaDesde)
        desde.setHours(0, 0, 0, 0)
        matchFechaDesde = venc >= desde
      }
      if (fechaHasta) {
        const hasta = new Date(fechaHasta)
        hasta.setHours(23, 59, 59, 999)
        matchFechaHasta = venc <= hasta
      }
    } else {
      if (fechaDesde || fechaHasta) {
        matchFechaDesde = false
      }
    }

    const matchNuevos = !filtroNuevos || isClienteNuevo(c)

    return matchSearch && matchTipo && matchEstado && matchFechaDesde && matchFechaHasta && matchNuevos
  })

  if (loading) {
    return <div className="loading">Cargando...</div>
  }

  return (
    <div className="clientes-page">
      <div className="page-header">
        <h1 className="page-title">Clientes <span className="total-hoy">({clientesFiltrados.length})</span></h1>
        <div className="page-header-actions">
          <button
            className={`btn-secondary ${modoSeleccion ? 'btn-seleccion-activo' : ''}`}
            onClick={() => { setModoSeleccion(prev => !prev); setSelectedClientes(new Set()) }}
          >
            <CheckSquare size={18} />
            <span className="btn-label">{modoSeleccion ? 'Cancelar' : 'Seleccionar'}</span>
          </button>
          <button className="btn-secondary" onClick={() => setShowImportModal(true)}>
            <Upload size={18} />
            <span className="btn-label">Importar</span>
          </button>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={20} />
            <span className="btn-label">Nuevo Cliente</span>
          </button>
        </div>
      </div>

      <div className="filters">
        <div className="filters-row-main">
          <div className="search-box">
            <Search size={18} />
            <input
              type="text"
              placeholder="Buscar nombre, placa, cédula..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            value={filtroTipoCliente}
            onChange={(e) => setFiltroTipoCliente(e.target.value)}
            className="filter-select"
          >
            <option value="">Tipo</option>
            {tiposMembresia.map(m => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </select>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="filter-select"
          >
            <option value="">Estado</option>
            <option value="Activo">Activo</option>
            <option value="Inactivo">Inactivo</option>
          </select>
          <button
            className={`filter-toggle-btn ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(prev => !prev)}
            title="Más filtros"
          >
            <SlidersHorizontal size={18} />
          </button>
          <button
            className={`filter-btn ${filtroNuevos ? 'active' : ''}`}
            onClick={() => setFiltroNuevos(prev => !prev)}
            title="Nuevos hoy"
            style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
          >
            <Sparkles size={14} /> Nuevos hoy
          </button>
          {(search || filtroTipoCliente || filtroEstado || fechaDesde || fechaHasta || filtroRapido || filtroNuevos) && (
            <button
              className="filter-clear-btn"
              onClick={() => {
                setSearch('')
                setFiltroTipoCliente('')
                setFiltroEstado('')
                setFechaDesde(null)
                setFechaHasta(null)
                setFiltroRapido('')
                setFiltroNuevos(false)
              }}
              title="Limpiar filtros"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className={`filters-row-extra ${showFilters ? 'open' : ''}`}>
          <div className="filter-rapido">
            <button className={`filter-btn ${filtroRapido === 'hoy' ? 'active' : ''}`} onClick={() => aplicarFiltroRapido('hoy')}>Hoy</button>
            <button className={`filter-btn ${filtroRapido === 'semana' ? 'active' : ''}`} onClick={() => aplicarFiltroRapido('semana')}>Semana</button>
            <button className={`filter-btn ${filtroRapido === 'mes' ? 'active' : ''}`} onClick={() => aplicarFiltroRapido('mes')}>Mes</button>
            <button className={`filter-btn ${filtroRapido === 'año' ? 'active' : ''}`} onClick={() => aplicarFiltroRapido('año')}>Año</button>
            <button className={`filter-btn ${filtroRapido === 'todas' ? 'active' : ''}`} onClick={() => aplicarFiltroRapido('todas')}>Todas</button>
          </div>
          <div className="filter-fechas">
            <DatePicker
              selected={fechaDesde}
              onChange={(date) => setFechaDesde(date)}
              selectsStart
              startDate={fechaDesde}
              endDate={fechaHasta}
              placeholderText="Desde"
              className="filter-date"
              dateFormat="dd/MM/yyyy"
              locale="es"
              isClearable
            />
            <span className="filter-separator">→</span>
            <DatePicker
              selected={fechaHasta}
              onChange={(date) => setFechaHasta(date)}
              selectsEnd
              startDate={fechaDesde}
              endDate={fechaHasta}
              minDate={fechaDesde}
              placeholderText="Hasta"
              className="filter-date"
              dateFormat="dd/MM/yyyy"
              locale="es"
              isClearable
            />
          </div>
        </div>
      </div>

      {/* Desktop: tabla */}
      <div className="card clientes-tabla-desktop">
        <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              {modoSeleccion && (
                <th className="th-checkbox">
                  <label className="custom-check">
                    <input
                      type="checkbox"
                      checked={clientesFiltrados.length > 0 && selectedClientes.size === clientesFiltrados.length}
                      onChange={toggleSelectAll}
                    />
                    <span className="checkmark"></span>
                  </label>
                </th>
              )}
              <th>Nombre</th>
              <th>Placa</th>
              <th>Teléfono</th>
              <th>Tipo de Cliente</th>
              <th>Vencimiento</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clientesFiltrados.map((cliente) => (
              <tr key={cliente.id} className={selectedClientes.has(cliente.id) ? 'row-selected' : ''}>
                {modoSeleccion && (
                  <td className="td-checkbox">
                    <label className="custom-check">
                      <input
                        type="checkbox"
                        checked={selectedClientes.has(cliente.id)}
                        onChange={() => toggleSelectCliente(cliente.id)}
                      />
                      <span className="checkmark"></span>
                    </label>
                  </td>
                )}
                <td>
                  <div className="cliente-cell">
                    <span className="cliente-nombre">
                      {cliente.nombre}
                      {isClienteNuevo(cliente) && <span className="badge-nuevo">Nuevo</span>}
                    </span>
                    <span className="cliente-fecha">{cliente.moto}</span>
                  </div>
                </td>
                <td>{cliente.placa}</td>
                <td>{cliente.telefono}</td>
                <td>{cliente.membresia?.nombre || 'Sin tipo'}</td>
                <td>{formatFecha(cliente.fecha_fin_membresia)}</td>
                <td>
                  {(() => {
                    const estado = getEstadoCliente(cliente)
                    return (
                      <span className={`estado-badge ${estado === 'Activo' ? 'activo' : 'vencido'}`}>
                        {estado}
                      </span>
                    )
                  })()}
                </td>
                <td>
                  <div className="acciones">
                    <button className="btn-icon" onClick={() => handleEdit(cliente)}>
                      <Edit size={18} />
                    </button>
                    <button className="btn-icon delete" onClick={() => handleDelete(cliente.id)}>
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {clientesFiltrados.length === 0 && (
              <tr>
                <td colSpan={modoSeleccion ? 8 : 7} className="empty">No hay clientes registrados</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Mobile: cards */}
      <div className="clientes-cards-mobile">
        {clientesFiltrados.map(cliente => {
          const estado = getEstadoCliente(cliente)
          const isExpanded = expandedCard === cliente.id
          return (
            <div key={cliente.id} className={`cliente-card ${estado === 'Activo' ? 'estado-activo-border' : 'estado-vencido-border'} ${isExpanded ? 'expanded' : ''} ${selectedClientes.has(cliente.id) ? 'card-selected' : ''}`}>
              <div className="cliente-card-header" onClick={() => setExpandedCard(isExpanded ? null : cliente.id)}>
                <div className="cliente-card-left">
                  {modoSeleccion && (
                    <label className="custom-check" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedClientes.has(cliente.id)}
                        onChange={() => toggleSelectCliente(cliente.id)}
                      />
                      <span className="checkmark"></span>
                    </label>
                  )}
                  <span className="cliente-card-nombre">
                    {cliente.nombre}
                    {isClienteNuevo(cliente) && <span className="badge-nuevo">Nuevo</span>}
                  </span>
                  <span className="cliente-card-placa">{cliente.placa}</span>
                </div>
                <div className="cliente-card-right">
                  <span className={`estado-badge-mini ${estado === 'Activo' ? 'activo' : 'vencido'}`}>{estado}</span>
                  <ChevronDown size={16} className={`cliente-card-chevron ${isExpanded ? 'rotated' : ''}`} />
                </div>
              </div>
              {isExpanded && (
                <div className="cliente-card-body">
                  <div className="cliente-card-row">
                    <span className="cliente-card-label">Moto</span>
                    <span className="cliente-card-value">{cliente.moto || '—'}</span>
                  </div>
                  <div className="cliente-card-row">
                    <span className="cliente-card-label">Teléfono</span>
                    <span className="cliente-card-value">{cliente.telefono || '—'}</span>
                  </div>
                  <div className="cliente-card-row">
                    <span className="cliente-card-label">Tipo</span>
                    <span className="cliente-card-value">{cliente.membresia?.nombre || 'Sin tipo'}</span>
                  </div>
                  <div className="cliente-card-row">
                    <span className="cliente-card-label">Vencimiento</span>
                    <span className="cliente-card-value">{formatFecha(cliente.fecha_fin_membresia)}</span>
                  </div>
                  <div className="cliente-card-actions">
                    <button className="btn-secondary" onClick={() => handleEdit(cliente)}>
                      <Edit size={16} /> Editar
                    </button>
                    <button className="btn-secondary btn-danger-outline" onClick={() => handleDelete(cliente.id)}>
                      <Trash2 size={16} /> Eliminar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {clientesFiltrados.length === 0 && (
          <div className="clientes-cards-empty">No hay clientes registrados</div>
        )}
      </div>

      {modoSeleccion && selectedClientes.size > 0 && (
        <div className="bulk-action-bar">
          <span>{selectedClientes.size} seleccionado{selectedClientes.size > 1 ? 's' : ''}</span>
          <div className="bulk-action-buttons">
            <button className="btn-secondary" onClick={() => { setSelectedClientes(new Set()); setModoSeleccion(false) }}>
              <X size={16} /> Cancelar
            </button>
            <button className="btn-danger" onClick={handleBulkDelete}>
              <Trash2 size={16} /> Eliminar
            </button>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="modal-overlay">
          <div className="modal import-modal">
            <div className="modal-header">
              <h2>Importar Clientes</h2>
              <button className="btn-close" onClick={resetImport}>
                <X size={24} />
              </button>
            </div>
            <div className="import-body">
              {importStep === 'upload' && (
                <>
                  <button className="btn-secondary" onClick={descargarPlantilla} style={{ marginBottom: '1rem' }}>
                    <Download size={18} /> Descargar Plantilla
                  </button>
                  <div
                    className="import-drop-zone"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      const file = e.dataTransfer.files[0]
                      if (file) {
                        const dt = new DataTransfer()
                        dt.items.add(file)
                        fileInputRef.current.files = dt.files
                        handleFileUpload({ target: { files: [file] } })
                      }
                    }}
                  >
                    <Upload size={32} />
                    <p>Arrastra un archivo o haz clic para seleccionar</p>
                    <span className="import-drop-hint">.csv, .xlsx, .xls</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                    />
                  </div>
                  <div className="import-instructions">
                    <p>Columnas obligatorias: <strong>nombre</strong>, <strong>placa</strong>, <strong>telefono</strong></p>
                    <p>Opcionales: cedula, correo, moto, tipo_membresia</p>
                  </div>
                </>
              )}

              {importStep === 'preview' && (
                <>
                  <div className="import-summary">
                    <div className="import-stat stat-green">
                      <span className="import-stat-value">{importNuevos.length}</span>
                      <span className="import-stat-label">Nuevos</span>
                    </div>
                    <div className="import-stat stat-yellow">
                      <span className="import-stat-value">{importDuplicados.length}</span>
                      <span className="import-stat-label">Duplicados</span>
                    </div>
                    <div className="import-stat stat-red">
                      <span className="import-stat-value">{importErrors.filter(e => e.tipo !== 'warning').length}</span>
                      <span className="import-stat-label">Errores</span>
                    </div>
                  </div>

                  {(() => {
                    const todos = [...importNuevos, ...(dupAction === 'update' ? importDuplicados : [])]
                    const conteo = {}
                    todos.forEach(r => {
                      const nombre = r.tipo_membresia_nombre || 'SIN MEMBRESIA'
                      conteo[nombre] = (conteo[nombre] || 0) + 1
                    })
                    const entries = Object.entries(conteo).sort((a, b) => b[1] - a[1])
                    return entries.length > 0 && (
                      <div className="import-membresia-breakdown">
                        <h4>Desglose por membresía</h4>
                        {entries.map(([nombre, cant]) => (
                          <div key={nombre} className="import-membresia-row">
                            <span>{nombre}</span>
                            <span className="import-membresia-count">{cant}</span>
                          </div>
                        ))}
                      </div>
                    )
                  })()}

                  {importErrors.filter(e => e.tipo !== 'warning').length > 0 && (
                    <div className="import-errors">
                      <h4>Errores — estas filas no se importarán</h4>
                      {importErrors.filter(e => e.tipo !== 'warning').map((err, i) => (
                        <div key={i} className="import-error-item">
                          <div className="import-error-fila">Fila {err.fila}</div>
                          <div className="import-error-problema">{err.problema}</div>
                          <div className="import-error-solucion">Solución: {err.solucion}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {importErrors.filter(e => e.tipo === 'warning').length > 0 && (
                    <div className="import-warnings">
                      <h4>Advertencias — se importarán con ajustes</h4>
                      {importErrors.filter(e => e.tipo === 'warning').map((err, i) => (
                        <div key={i} className="import-warning-item">
                          <div className="import-error-fila">Fila {err.fila}</div>
                          <div className="import-error-problema">{err.problema}</div>
                          <div className="import-error-solucion">Tip: {err.solucion}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {importDuplicados.length > 0 && (
                    <div className="import-dup-options">
                      <h4>Placas duplicadas encontradas</h4>
                      <label className="import-radio">
                        <input type="radio" name="dupAction" value="skip" checked={dupAction === 'skip'} onChange={() => setDupAction('skip')} />
                        Saltar duplicados
                      </label>
                      <label className="import-radio">
                        <input type="radio" name="dupAction" value="update" checked={dupAction === 'update'} onChange={() => setDupAction('update')} />
                        Actualizar datos existentes
                      </label>
                    </div>
                  )}

                  {importNuevos.length > 0 && (
                    <div className="import-preview-wrapper">
                      <h4>Vista previa</h4>
                      <div className="import-preview-table-wrapper">
                        <table className="import-preview-table">
                          <thead>
                            <tr>
                              <th>Nombre</th>
                              <th>Placa</th>
                              <th>Teléfono</th>
                              <th>Membresía</th>
                            </tr>
                          </thead>
                          <tbody>
                            {importNuevos.slice(0, 10).map((row, i) => (
                              <tr key={i}>
                                <td>{row.nombre}</td>
                                <td>{row.placa}</td>
                                <td>{row.telefono}</td>
                                <td>{row.tipo_membresia_nombre}</td>
                              </tr>
                            ))}
                            {importNuevos.length > 10 && (
                              <tr><td colSpan="4" className="import-more">... y {importNuevos.length - 10} más</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="modal-footer">
                    <button className="btn-secondary" onClick={resetImport}>Cancelar</button>
                    <button
                      className="btn-primary"
                      onClick={ejecutarImportacion}
                      disabled={importNuevos.length === 0 && (dupAction === 'skip' || importDuplicados.length === 0)}
                    >
                      Importar {importNuevos.length + (dupAction === 'update' ? importDuplicados.length : 0)} clientes
                    </button>
                  </div>
                </>
              )}

              {importStep === 'importing' && (
                <div className="import-progress-container">
                  <p>Importando clientes...</p>
                  <div className="import-progress-bar">
                    <div className="import-progress-fill" style={{ width: `${importProgress}%` }}></div>
                  </div>
                  <span className="import-progress-text">{importProgress}%</span>
                </div>
              )}

              {importStep === 'done' && importResult && (
                <div className="import-done">
                  <div className="import-summary">
                    <div className="import-stat stat-green">
                      <span className="import-stat-value">{importResult.insertados}</span>
                      <span className="import-stat-label">Importados</span>
                    </div>
                    <div className="import-stat stat-yellow">
                      <span className="import-stat-value">{importResult.actualizados}</span>
                      <span className="import-stat-label">Actualizados</span>
                    </div>
                    <div className="import-stat stat-red">
                      <span className="import-stat-value">{importResult.errores}</span>
                      <span className="import-stat-label">Errores</span>
                    </div>
                  </div>
                  {importResult.failedRows?.length > 0 && (
                    <div className="import-errors">
                      <h4>Clientes que no se pudieron importar</h4>
                      {importResult.failedRows.map((f, i) => (
                        <div key={i} className="import-error-item">
                          <div className="import-error-fila">{f.nombre} ({f.placa})</div>
                          <div className="import-error-problema">{f.error}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="modal-footer">
                    <button className="btn-primary" onClick={resetImport}>Cerrar</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>{editando ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
              <button className="btn-close" onClick={() => { setShowModal(false); setEditando(null) }}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Nombre completo</label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Cédula</label>
                  <input
                    type="text"
                    value={formData.cedula}
                    onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Teléfono</label>
                  <input
                    type="text"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Correo</label>
                  <input
                    type="email"
                    value={formData.correo}
                    onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Placa</label>
                  <input
                    type="text"
                    value={formData.placa}
                    onChange={(e) => setFormData({ ...formData, placa: e.target.value.toUpperCase() })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Moto</label>
                  <input
                    type="text"
                    value={formData.moto}
                    onChange={(e) => setFormData({ ...formData, moto: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Tipo de Cliente</label>
                  <select
                    value={formData.membresia_id}
                    onChange={(e) => handleMembresiaChange(e.target.value)}
                  >
                    <option value="">Seleccionar</option>
                    {tiposMembresia.map(m => (
                      <option key={m.id} value={m.id}>{m.nombre}</option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Fecha inicio</label>
                    <DatePicker
                      selected={formData.fecha_inicio_membresia}
                      onChange={(date) => setFormData({ ...formData, fecha_inicio_membresia: date })}
                      dateFormat="dd/MM/yyyy"
                      locale="es"
                      isClearable
                      placeholderText="Seleccionar fecha"
                    />
                  </div>
                  <div className="form-group">
                    <label>Fecha fin</label>
                    <DatePicker
                      selected={formData.fecha_fin_membresia}
                      onChange={(date) => setFormData({ ...formData, fecha_fin_membresia: date })}
                      dateFormat="dd/MM/yyyy"
                      locale="es"
                      isClearable
                      placeholderText="Seleccionar fecha"
                      minDate={formData.fecha_inicio_membresia}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => { setShowModal(false); setEditando(null) }}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  {editando ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
