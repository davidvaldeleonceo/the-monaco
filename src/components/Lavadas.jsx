import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useData } from './DataContext'
import { Plus, Search, X, MessageCircle, Calendar, Trash2 } from 'lucide-react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { registerLocale } from 'react-datepicker'
import es from 'date-fns/locale/es'

registerLocale('es', es)

export default function Lavadas() {
  const { lavadas, clientes, tiposLavado, lavadores, metodosPago, loading, updateLavadaLocal, addLavadaLocal, deleteLavadaLocal } = useData()
  
  const [showModal, setShowModal] = useState(false)
  const [searchPlaca, setSearchPlaca] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroLavador, setFiltroLavador] = useState('')
  const [fechaDesde, setFechaDesde] = useState(null)
  const [fechaHasta, setFechaHasta] = useState(null)
  const [filtroRapido, setFiltroRapido] = useState('')
  
  const [formData, setFormData] = useState({
    cliente_id: '',
    placa: '',
    tipo_lavado_id: '',
    lavador_id: '',
    metodo_pago_id: '',
    valor: 0,
    cera_restaurador: false,
    kit_completo: false,
    estado: 'EN ESPERA',
    notas: ''
  })

  const handlePlacaSearch = (placa) => {
    setFormData({ ...formData, placa })
    const cliente = clientes.find(c => c.placa.toLowerCase() === placa.toLowerCase())
    if (cliente) {
      setFormData(prev => ({ ...prev, placa, cliente_id: cliente.id }))
    }
  }

  const handleTipoLavadoChange = (tipoId) => {
    const tipo = tiposLavado.find(t => t.id === tipoId)
    const precioBase = tipo?.precio || 0
    setFormData(prev => {
      let nuevoValor = precioBase
      if (prev.cera_restaurador) nuevoValor += 5000
      if (prev.kit_completo) nuevoValor += 10000
      return {
        ...prev,
        tipo_lavado_id: tipoId,
        valor: nuevoValor
      }
    })
  }

  const handleFormAdicionalChange = (campo, checked) => {
    setFormData(prev => {
      const tipo = tiposLavado.find(t => t.id === prev.tipo_lavado_id)
      const precioBase = tipo?.precio || 0
      const nuevaCera = campo === 'cera_restaurador' ? checked : prev.cera_restaurador
      const nuevoKit = campo === 'kit_completo' ? checked : prev.kit_completo

      let nuevoValor = precioBase
      if (nuevaCera) nuevoValor += 5000
      if (nuevoKit) nuevoValor += 10000

      return {
        ...prev,
        [campo]: checked,
        valor: nuevoValor
      }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Convertir strings vacíos a null para Supabase
    const cleanData = Object.fromEntries(
      Object.entries(formData).map(([key, value]) => [key, value === '' ? null : value])
    )

    const dataToSend = {
      ...cleanData,
      fecha: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('lavadas')
      .insert([dataToSend])
      .select('*, cliente:clientes(nombre), tipo_lavado:tipos_lavado(nombre), lavador:lavadores(nombre), metodo_pago:metodos_pago(nombre)')
      .single()

    if (!error && data) {
      addLavadaLocal(data)
      setShowModal(false)
      setFormData({
        cliente_id: '',
        placa: '',
        tipo_lavado_id: '',
        lavador_id: '',
        metodo_pago_id: '',
        valor: 0,
        cera_restaurador: false,
        kit_completo: false,
        estado: 'EN ESPERA',
        notas: ''
      })
    }
  }

  const handleEstadoChange = async (lavadaId, nuevoEstado) => {
    const lavada = lavadas.find(l => l.id === lavadaId)
    let updates = { estado: nuevoEstado }
    
    if (nuevoEstado === 'EN LAVADO') {
      updates.hora_inicio_lavado = new Date().toISOString()
    }
    
    if (nuevoEstado === 'TERMINADO' && lavada.hora_inicio_lavado) {
      const inicio = new Date(lavada.hora_inicio_lavado)
      const fin = new Date()
      const minutos = Math.max(1, Math.round((fin - inicio) / 60000))
      updates.tiempo_lavado = minutos
    }
    
    updateLavadaLocal(lavadaId, updates)
    
    await supabase
      .from('lavadas')
      .update(updates)
      .eq('id', lavadaId)
  }

  const handleLavadorChange = async (lavadaId, lavadorId) => {
    const lavador = lavadores.find(l => l.id === lavadorId)
    updateLavadaLocal(lavadaId, { lavador_id: lavadorId, lavador })
    
    await supabase
      .from('lavadas')
      .update({ lavador_id: lavadorId || null })
      .eq('id', lavadaId)
  }

  const handleTipoLavadoChangeInline = async (lavadaId, tipoId) => {
    const tipo = tiposLavado.find(t => t.id === tipoId)
    const lavada = lavadas.find(l => l.id === lavadaId)
    
    let nuevoValor = tipo?.precio || 0
    if (lavada.cera_restaurador) nuevoValor += 5000
    if (lavada.kit_completo) nuevoValor += 10000
    
    updateLavadaLocal(lavadaId, { 
      tipo_lavado_id: tipoId, 
      tipo_lavado: tipo,
      valor: nuevoValor
    })
    
    await supabase
      .from('lavadas')
      .update({ tipo_lavado_id: tipoId, valor: nuevoValor })
      .eq('id', lavadaId)
  }

  const handleAdicionalChange = async (lavadaId, campo, valor) => {
    const lavada = lavadas.find(l => l.id === lavadaId)
    const tipoActual = tiposLavado.find(t => t.id === lavada.tipo_lavado_id)
    
    let nuevoValor = tipoActual?.precio || 0
    
    const nuevaCera = campo === 'cera_restaurador' ? valor : lavada.cera_restaurador
    const nuevoKit = campo === 'kit_completo' ? valor : lavada.kit_completo
    
    if (nuevaCera) nuevoValor += 5000
    if (nuevoKit) nuevoValor += 10000
    
    updateLavadaLocal(lavadaId, { 
      [campo]: valor,
      valor: nuevoValor
    })
    
    await supabase
      .from('lavadas')
      .update({ [campo]: valor, valor: nuevoValor })
      .eq('id', lavadaId)
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
    case 'semana':
      const inicioSemana = new Date(hoy)
      inicioSemana.setDate(hoy.getDate() - hoy.getDay() + 1)
      setFechaDesde(inicioSemana)
      setFechaHasta(hoy)
      break
    case 'mes':
      const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
      setFechaDesde(inicioMes)
      setFechaHasta(hoy)
      break
    case 'año':
      const inicioAño = new Date(hoy.getFullYear(), 0, 1)
      setFechaDesde(inicioAño)
      setFechaHasta(hoy)
      break
    case 'todas':
      setFechaDesde(null)
      setFechaHasta(null)
      break
    default:
      break
  }
}

  const handleEliminarLavada = async (lavadaId) => {
    if (confirm('¿Estás seguro de eliminar esta lavada?')) {
      await supabase
        .from('lavadas')
        .delete()
        .eq('id', lavadaId)

      deleteLavadaLocal(lavadaId)
    }
  }

  const enviarWhatsApp = (lavada) => {
  const cliente = clientes.find(c => c.id === lavada.cliente_id)
  if (!cliente?.telefono) {
    alert('El cliente no tiene número de teléfono registrado')
    return
  }
  
  const telefono = cliente.telefono.replace(/\D/g, '')
  const mensaje = `Hola ${cliente.nombre}, tu moto de placa *${lavada.placa}* ya está lista. ¡Puedes venir a recogerla! 🏍️`
  const url = `https://api.whatsapp.com/send?phone=57${telefono}&text=${encodeURIComponent(mensaje)}`
  
  window.open(url, '_blank')
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
    'TERMINADO': 'estado-terminado',
    'NOTIFICADO': 'estado-notificado',
    'ENTREGADO': 'estado-entregado'
  }
  return clases[estado] || ''
  }

  const lavadasFiltradas = lavadas.filter(l => {
    const matchPlaca = l.placa.toLowerCase().includes(searchPlaca.toLowerCase())
    const matchEstado = !filtroEstado || l.estado === filtroEstado
    const matchLavador = !filtroLavador || l.lavador_id === filtroLavador
    
    const fechaLavada = new Date(l.fecha)
    fechaLavada.setHours(0, 0, 0, 0)
    
    let matchFechaDesde = true
    if (fechaDesde) {
      const desde = new Date(fechaDesde)
      desde.setHours(0, 0, 0, 0)
      matchFechaDesde = fechaLavada >= desde
    }
    
    let matchFechaHasta = true
    if (fechaHasta) {
      const hasta = new Date(fechaHasta)
      hasta.setHours(23, 59, 59, 999)
      matchFechaHasta = fechaLavada <= hasta
    }
    
    return matchPlaca && matchEstado && matchLavador && matchFechaDesde && matchFechaHasta
  })

  const totalFiltrado = lavadasFiltradas.reduce((sum, l) => sum + (l.valor || 0), 0)
  const cantidadFiltrada = lavadasFiltradas.length

  if (loading) {
    return <div className="loading">Cargando...</div>
  }

  return (
    <div className="lavadas-page">
      <div className="page-header">
        <h1 className="page-title">Lavadas <span className="total-hoy">({cantidadFiltrada} - {formatMoney(totalFiltrado)})</span></h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={20} />
          Nueva Lavada
        </button>
      </div>

      <div className="filters">
        <div className="search-box">
          <Search size={20} />
          <input
            type="text"
            placeholder="Buscar por placa..."
            value={searchPlaca}
            onChange={(e) => setSearchPlaca(e.target.value)}
          />
        </div>
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="filter-select"
        >
          <option value="">Todos los estados</option>
          <option value="EN ESPERA">En Espera</option>
          <option value="EN LAVADO">En Lavado</option>
          <option value="TERMINADO">Terminado</option>
          <option value="NOTIFICADO">Notificado</option>
          <option value="ENTREGADO">Entregado</option>
        </select>
        <select
          value={filtroLavador}
          onChange={(e) => setFiltroLavador(e.target.value)}
          className="filter-select"
        >
          <option value="">Todos los lavadores</option>
          {lavadores.map(l => (
            <option key={l.id} value={l.id}>{l.nombre}</option>
          ))}
        </select>

         <div className="filter-rapido">
          <button 
            className={`filter-btn ${filtroRapido === 'hoy' ? 'active' : ''}`}
            onClick={() => aplicarFiltroRapido('hoy')}
          >
            Hoy
          </button>
          <button 
            className={`filter-btn ${filtroRapido === 'semana' ? 'active' : ''}`}
            onClick={() => aplicarFiltroRapido('semana')}
          >
            Semana
          </button>
          <button 
            className={`filter-btn ${filtroRapido === 'mes' ? 'active' : ''}`}
            onClick={() => aplicarFiltroRapido('mes')}
          >
            Mes
          </button>
          <button 
            className={`filter-btn ${filtroRapido === 'año' ? 'active' : ''}`}
            onClick={() => aplicarFiltroRapido('año')}
          >
            Año
          </button>
          <button 
            className={`filter-btn ${filtroRapido === 'todas' ? 'active' : ''}`}
            onClick={() => aplicarFiltroRapido('todas')}
          >
            Todas
          </button>
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

      <div className="card">
        <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th className="th-eliminar"></th>
              <th>Cliente</th>
              <th>Tipo</th>
              <th>Placa</th>
              <th>Estado</th>
              <th>Tiempo</th>
              <th>Adicionales</th>
              <th>Valor</th>
              <th>Lavador</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {lavadasFiltradas.map((lavada) => (
              <tr key={lavada.id} className="fila-lavada">
                <td className="celda-eliminar">
                  <button
                    className="btn-eliminar"
                    onClick={() => handleEliminarLavada(lavada.id)}
                    title="Eliminar lavada"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
                <td>
                  <div className="cliente-cell">
                    <span className="cliente-nombre">
                      {lavada.cliente?.nombre || 'No encontrado'}
                    </span>
                    <span className="cliente-fecha">
                      {new Date(lavada.fecha).toLocaleDateString('es-CO')}
                    </span>
                  </div>
                </td>
                <td>
                  <select
                    value={lavada.tipo_lavado_id || ''}
                    onChange={(e) => handleTipoLavadoChangeInline(lavada.id, e.target.value)}
                    className="tipo-lavado-select"
                  >
                    <option value="">Seleccionar</option>
                    {tiposLavado.map(t => (
                      <option key={t.id} value={t.id}>{t.nombre}</option>
                    ))}
                  </select>
                </td>
                <td>{lavada.placa}</td>
                <td>
                  <select
                    value={lavada.estado}
                    onChange={(e) => handleEstadoChange(lavada.id, e.target.value)}
                    className={`estado-select ${getEstadoClass(lavada.estado)}`}
                  >
                    <option value="EN ESPERA">En Espera</option>
                    <option value="EN LAVADO">En Lavado</option>
                    <option value="TERMINADO">Terminado</option>
                    <option value="NOTIFICADO">Notificado</option>
                    <option value="ENTREGADO">Entregado</option>
                  </select>
                </td>

                <td className="tiempo-cell">
                  {lavada.tiempo_lavado ? `${lavada.tiempo_lavado} min` : '-'}
                </td>

                <td>
                  <div className="adicionales-cell">
                    <label className="adicional-check">
                      <input
                        type="checkbox"
                        checked={lavada.cera_restaurador || false}
                        onChange={(e) => handleAdicionalChange(lavada.id, 'cera_restaurador', e.target.checked)}
                      />
                      <span>Cera</span>
                    </label>
                    <label className="adicional-check">
                      <input
                        type="checkbox"
                        checked={lavada.kit_completo || false}
                        onChange={(e) => handleAdicionalChange(lavada.id, 'kit_completo', e.target.checked)}
                      />
                      <span>Kit</span>
                    </label>
                  </div>
                </td>
                <td className="valor-cell">{formatMoney(lavada.valor)}</td>
                <td>
                  <select
                    value={lavada.lavador_id || ''}
                    onChange={(e) => handleLavadorChange(lavada.id, e.target.value)}
                    className="lavador-select"
                  >
                    <option value="">Sin asignar</option>
                    {lavadores.map(l => (
                      <option key={l.id} value={l.id}>{l.nombre}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <button
                    className="btn-whatsapp"
                    onClick={() => enviarWhatsApp(lavada)}
                    title="Enviar WhatsApp"
                  >
                    <MessageCircle size={18} />
                  </button>
                </td>
              </tr>
            ))}
            {lavadasFiltradas.length === 0 && (
              <tr>
                <td colSpan="7" className="empty">No hay lavadas registradas</td>
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
              <h2>Nueva Lavada</h2>
              <button className="btn-close" onClick={() => setShowModal(false)}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Placa</label>
                  <input
                    type="text"
                    value={formData.placa}
                    onChange={(e) => handlePlacaSearch(e.target.value.toUpperCase())}
                    placeholder="ABC123"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Cliente</label>
                  <select
                    value={formData.cliente_id}
                    onChange={(e) => setFormData({ ...formData, cliente_id: e.target.value })}
                  >
                    <option value="">Seleccionar cliente</option>
                    {clientes.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre} - {c.placa}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Tipo de Lavado</label>
                  <select
                    value={formData.tipo_lavado_id}
                    onChange={(e) => handleTipoLavadoChange(e.target.value)}
                    required
                  >
                    <option value="">Seleccionar tipo</option>
                    {tiposLavado.map(t => (
                      <option key={t.id} value={t.id}>{t.nombre} - {formatMoney(t.precio)}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Lavador</label>
                  <select
                    value={formData.lavador_id}
                    onChange={(e) => setFormData({ ...formData, lavador_id: e.target.value })}
                  >
                    <option value="">Seleccionar lavador</option>
                    {lavadores.map(l => (
                      <option key={l.id} value={l.id}>{l.nombre}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Método de Pago</label>
                  <select
                    value={formData.metodo_pago_id}
                    onChange={(e) => setFormData({ ...formData, metodo_pago_id: e.target.value })}
                  >
                    <option value="">Seleccionar método</option>
                    {metodosPago.map(m => (
                      <option key={m.id} value={m.id}>{m.nombre}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Valor</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formData.valor === 0 ? '' : formData.valor}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '')
                      setFormData({ ...formData, valor: val === '' ? 0 : Number(val) })
                    }}
                    required
                  />
                </div>

                <div className="form-group checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.cera_restaurador}
                      onChange={(e) => handleFormAdicionalChange('cera_restaurador', e.target.checked)}
                    />
                    Cera y Restaurador (+$5.000)
                  </label>
                </div>

                <div className="form-group checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.kit_completo}
                      onChange={(e) => handleFormAdicionalChange('kit_completo', e.target.checked)}
                    />
                    Kit Completo (+$10.000)
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label>Notas</label>
                <textarea
                  value={formData.notas}
                  onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                  rows="3"
                ></textarea>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Guardar Lavada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}