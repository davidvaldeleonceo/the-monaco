import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const DataContext = createContext()

export function useData() {
  return useContext(DataContext)
}

export function DataProvider({ children }) {
  const [clientes, setClientes] = useState([])
  const [lavadas, setLavadas] = useState([])
  const [tiposLavado, setTiposLavado] = useState([])
  const [lavadores, setLavadores] = useState([])
  const [metodosPago, setMetodosPago] = useState([])
  const [tiposMembresia, setTiposMembresia] = useState([])
  const [transacciones, setTransacciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)

  const fetchAllData = async () => {
    if (initialized) {
      setLoading(false)
      return
    }
    
    setLoading(true)

    const [
      { data: clientesData },
      { data: lavadasData },
      { data: tiposLavadoData },
      { data: lavadoresData },
      { data: metodosPagoData },
      { data: tiposMembresiaData }
    ] = await Promise.all([
      supabase.from('clientes').select('*, membresia:tipos_membresia(nombre)').order('nombre'),
      supabase.from('lavadas').select('*, cliente:clientes(nombre), tipo_lavado:tipos_lavado(nombre), lavador:lavadores(nombre), metodo_pago:metodos_pago(nombre)').order('fecha', { ascending: false }),
      supabase.from('tipos_lavado').select('*').eq('activo', true),
      supabase.from('lavadores').select('*').eq('activo', true),
      supabase.from('metodos_pago').select('*').eq('activo', true),
      supabase.from('tipos_membresia').select('*').eq('activo', true)
    ])

    setClientes(clientesData || [])
    setLavadas(lavadasData || [])
    setTiposLavado(tiposLavadoData || [])
    setLavadores(lavadoresData || [])
    setMetodosPago(metodosPagoData || [])
    setTiposMembresia(tiposMembresiaData || [])
    setInitialized(true)
    setLoading(false)
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
    fetchAllData()
  }, [])

  const value = {
    clientes,
    lavadas,
    tiposLavado,
    lavadores,
    metodosPago,
    tiposMembresia,
    loading,
    fetchAllData,
    refreshLavadas,
    refreshClientes,
    updateLavadaLocal,
    addLavadaLocal,
    addClienteLocal,
    updateClienteLocal,
    deleteClienteLocal,
    deleteLavadaLocal,
    setLavadas
  }

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  )
}