import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { useTenant } from './TenantContext'
import { LAVADAS_SELECT, CLIENTES_SELECT } from '../config/constants'

const DataContext = createContext()

export function useData() {
  return useContext(DataContext)
}

function getCutoff60Days() {
  const d = new Date()
  d.setDate(d.getDate() - 60)
  return d.toISOString()
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
  const [loading, setLoading] = useState(true)
  const [lavadasAllLoaded, setLavadasAllLoaded] = useState(false)

  const fetchingRef = useRef(false)
  const debounceRef = useRef(null)

  const fetchAllData = async () => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setLoading(true)

    try {
      const cutoff = getCutoff60Days()
      const [
        clientesRes,
        lavadasRes,
        tiposLavadoRes,
        lavadoresRes,
        metodosPagoRes,
        tiposMembresiaRes,
        serviciosAdicionalesRes,
      ] = await Promise.all([
        supabase.from('clientes').select(CLIENTES_SELECT).order('nombre'),
        supabase.from('lavadas').select(LAVADAS_SELECT).gte('fecha', cutoff).order('fecha', { ascending: false }).limit(500),
        supabase.from('tipos_lavado').select('*').eq('activo', true),
        supabase.from('lavadores').select('*').eq('activo', true),
        supabase.from('metodos_pago').select('*').eq('activo', true),
        supabase.from('tipos_membresia').select('*').eq('activo', true),
        supabase.from('servicios_adicionales').select('*').eq('activo', true).order('nombre')
      ])

      if (clientesRes.error) console.error('Error clientes:', clientesRes.error)
      if (lavadasRes.error) console.error('Error lavadas:', lavadasRes.error)
      if (tiposLavadoRes.error) console.error('Error tipos_lavado:', tiposLavadoRes.error)
      if (lavadoresRes.error) console.error('Error lavadores:', lavadoresRes.error)
      if (metodosPagoRes.error) console.error('Error metodos_pago:', metodosPagoRes.error)
      if (tiposMembresiaRes.error) console.error('Error tipos_membresia:', tiposMembresiaRes.error)
      if (serviciosAdicionalesRes.error) console.error('Error servicios_adicionales:', serviciosAdicionalesRes.error)

      setClientes(clientesRes.data || [])
      setLavadas(lavadasRes.data || [])
      setLavadasAllLoaded(false)
      setTiposLavado(tiposLavadoRes.data || [])
      setLavadores(lavadoresRes.data || [])
      setMetodosPago(metodosPagoRes.data || [])
      setTiposMembresia(tiposMembresiaRes.data || [])
      setServiciosAdicionales(serviciosAdicionalesRes.data || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }

  const refreshLavadas = async () => {
    const cutoff = getCutoff60Days()
    const query = lavadasAllLoaded
      ? supabase.from('lavadas').select(LAVADAS_SELECT).order('fecha', { ascending: false })
      : supabase.from('lavadas').select(LAVADAS_SELECT).gte('fecha', cutoff).order('fecha', { ascending: false }).limit(500)
    const { data } = await query
    setLavadas(data || [])
  }

  const loadAllLavadas = useCallback(async () => {
    if (lavadasAllLoaded) return
    const { data } = await supabase
      .from('lavadas')
      .select(LAVADAS_SELECT)
      .order('fecha', { ascending: false })
    setLavadas(data || [])
    setLavadasAllLoaded(true)
  }, [lavadasAllLoaded])

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

  useEffect(() => {
    fetchingRef.current = false
    setLavadasAllLoaded(false)
    fetchAllData()
  }, [negocioId])

  // Supabase Realtime subscription for lavadas — debounced
  useEffect(() => {
    if (!negocioId) return

    const channel = supabase
      .channel('lavadas-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lavadas' }, () => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
          refreshLavadas()
        }, 300)
      })
      .subscribe()

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      supabase.removeChannel(channel)
    }
  }, [negocioId, lavadasAllLoaded])

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
    lavadasAllLoaded,
    fetchAllData,
    refreshLavadas,
    refreshClientes,
    refreshConfig,
    loadAllLavadas,
    updateLavadaLocal,
    addLavadaLocal,
    addClienteLocal,
    updateClienteLocal,
    deleteClienteLocal,
    deleteLavadaLocal,
    setLavadas,
  }

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  )
}
