import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useTenant } from './TenantContext'

const DataContext = createContext()

export function useData() {
  return useContext(DataContext)
}

export function DataProvider({ children }) {
  const { negocioId } = useTenant()
  const [clientes, setClientes] = useState([])
  const [lavadas, setLavadas] = useState([])
  const [tiposLavado, setTiposLavado] = useState([])
  const [lavadores, setLavadores] = useState([])
  const [metodosPago, setMetodosPago] = useState([])
  const [tiposMembresia, setTiposMembresia] = useState([])
  const [serviciosAdicionales, setServiciosAdicionales] = useState([])
  const [transacciones, setTransacciones] = useState([])
  const [reservas, setReservas] = useState([])
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)

  const fetchAllData = async () => {
    if (initialized) {
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      const [
        clientesRes,
        lavadasRes,
        tiposLavadoRes,
        lavadoresRes,
        metodosPagoRes,
        tiposMembresiaRes,
        serviciosAdicionalesRes,
        reservasRes
      ] = await Promise.all([
        supabase.from('clientes').select('*, membresia:tipos_membresia(nombre)').order('nombre'),
        supabase.from('lavadas').select('*, cliente:clientes(nombre), tipo_lavado:tipos_lavado(nombre), lavador:lavadores(nombre), metodo_pago:metodos_pago(nombre)').order('fecha', { ascending: false }),
        supabase.from('tipos_lavado').select('*').eq('activo', true),
        supabase.from('lavadores').select('*').eq('activo', true),
        supabase.from('metodos_pago').select('*').eq('activo', true),
        supabase.from('tipos_membresia').select('*').eq('activo', true),
        supabase.from('servicios_adicionales').select('*').eq('activo', true).order('nombre'),
        supabase.from('reservas').select('*').order('fecha_hora', { ascending: true })
      ])

      if (clientesRes.error) console.error('Error clientes:', clientesRes.error)
      if (lavadasRes.error) console.error('Error lavadas:', lavadasRes.error)
      if (tiposLavadoRes.error) console.error('Error tipos_lavado:', tiposLavadoRes.error)
      if (lavadoresRes.error) console.error('Error lavadores:', lavadoresRes.error)
      if (metodosPagoRes.error) console.error('Error metodos_pago:', metodosPagoRes.error)
      if (tiposMembresiaRes.error) console.error('Error tipos_membresia:', tiposMembresiaRes.error)
      if (serviciosAdicionalesRes.error) console.error('Error servicios_adicionales:', serviciosAdicionalesRes.error)
      if (reservasRes.error) console.error('Error reservas:', reservasRes.error)

      setClientes(clientesRes.data || [])
      setLavadas(lavadasRes.data || [])
      setTiposLavado(tiposLavadoRes.data || [])
      setLavadores(lavadoresRes.data || [])
      setMetodosPago(metodosPagoRes.data || [])
      setTiposMembresia(tiposMembresiaRes.data || [])
      setServiciosAdicionales(serviciosAdicionalesRes.data || [])
      setReservas(reservasRes.data || [])
      setInitialized(true)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const refreshLavadas = async () => {
    const { data } = await supabase
      .from('lavadas')
      .select('*, cliente:clientes(nombre), tipo_lavado:tipos_lavado(nombre), lavador:lavadores(nombre), metodo_pago:metodos_pago(nombre)')
      .order('fecha', { ascending: false })
    setLavadas(data || [])
  }

  const refreshClientes = async () => {
    const { data } = await supabase
      .from('clientes')
      .select('*, membresia:tipos_membresia(nombre)')
      .order('nombre')
    setClientes(data || [])
  }

  const refreshConfig = async () => {
    const [tiposLavadoRes, lavadoresRes, metodosPagoRes, tiposMembresiaRes, serviciosRes] = await Promise.all([
      supabase.from('tipos_lavado').select('*').eq('activo', true),
      supabase.from('lavadores').select('*').eq('activo', true),
      supabase.from('metodos_pago').select('*').eq('activo', true),
      supabase.from('tipos_membresia').select('*').eq('activo', true),
      supabase.from('servicios_adicionales').select('*').eq('activo', true).order('nombre')
    ])
    setTiposLavado(tiposLavadoRes.data || [])
    setLavadores(lavadoresRes.data || [])
    setMetodosPago(metodosPagoRes.data || [])
    setTiposMembresia(tiposMembresiaRes.data || [])
    setServiciosAdicionales(serviciosRes.data || [])
  }

  const updateLavadaLocal = (lavadaId, updates) => {
    setLavadas(prev => prev.map(l => l.id === lavadaId ? { ...l, ...updates } : l))
  }

  const addLavadaLocal = (nuevaLavada) => {
    setLavadas(prev => [nuevaLavada, ...prev])
  }

  const addClienteLocal = (nuevoCliente) => {
    setClientes(prev => [...prev, nuevoCliente].sort((a, b) => a.nombre.localeCompare(b.nombre)))
  }

  const updateClienteLocal = (clienteId, updates) => {
    setClientes(prev => prev.map(c => c.id === clienteId ? { ...c, ...updates } : c))
  }

  const deleteClienteLocal = (clienteId) => {
    setClientes(prev => prev.filter(c => c.id !== clienteId))
  }

  const deleteLavadaLocal = (lavadaId) => {
    setLavadas(prev => prev.filter(l => l.id !== lavadaId))
  }

  const refreshReservas = async () => {
    const { data } = await supabase
      .from('reservas')
      .select('*')
      .order('fecha_hora', { ascending: true })
    setReservas(data || [])
  }

  const addReservaLocal = (nuevaReserva) => {
    setReservas(prev => [...prev, nuevaReserva].sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora)))
  }

  const updateReservaLocal = (reservaId, updates) => {
    setReservas(prev => prev.map(r => r.id === reservaId ? { ...r, ...updates } : r))
  }

  const deleteReservaLocal = (reservaId) => {
    setReservas(prev => prev.filter(r => r.id !== reservaId))
  }

  useEffect(() => {
    setInitialized(false)
    fetchAllData()
  }, [negocioId])

  // Supabase Realtime subscription for lavadas
  useEffect(() => {
    if (!negocioId) return

    const channel = supabase
      .channel('lavadas-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lavadas' }, () => {
        refreshLavadas()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, () => {
        refreshReservas()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [negocioId])

  const value = {
    negocioId,
    clientes,
    lavadas,
    tiposLavado,
    lavadores,
    metodosPago,
    tiposMembresia,
    serviciosAdicionales,
    loading,
    fetchAllData,
    refreshLavadas,
    refreshClientes,
    refreshConfig,
    updateLavadaLocal,
    addLavadaLocal,
    addClienteLocal,
    updateClienteLocal,
    deleteClienteLocal,
    deleteLavadaLocal,
    setLavadas,
    reservas,
    refreshReservas,
    addReservaLocal,
    updateReservaLocal,
    deleteReservaLocal,
  }

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  )
}