import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { supabase, getBootstrapPromise } from '../../apiClient'
import { useTenant } from './TenantContext'
import { LAVADAS_SELECT, CLIENTES_SELECT } from '../../config/constants'
import { fechaToBogotaDate, nowBogota } from '../../utils/date'

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
  const [productos, setProductos] = useState([])
  const [plantillasMensaje, setPlantillasMensaje] = useState([])
  const [categoriasTransaccion, setCategoriasTransaccion] = useState([])
  const [initialTransacciones, setInitialTransacciones] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lavadasAllLoaded, setLavadasAllLoaded] = useState(false)

  const fetchingRef = useRef(false)
  const debounceRef = useRef(null)
  const clientesDebounceRef = useRef(null)

  const applyBootstrapData = (data) => {
    setClientes(data.clientes || [])
    setLavadas(data.lavadas || [])
    setLavadasAllLoaded(false)
    setTiposLavado(data.tiposLavado || [])
    setLavadores(data.lavadores || [])
    setMetodosPago(data.metodosPago || [])
    setTiposMembresia(data.tiposMembresia || [])
    setServiciosAdicionales(data.serviciosAdicionales || [])
    setProductos(data.productos || [])
    setPlantillasMensaje(data.plantillasMensaje || [])
    setCategoriasTransaccion(data.categoriasTransaccion || [])
    if (data.transacciones) {
      setInitialTransacciones(data.transacciones)
    }
  }

  const fetchAllData = async () => {
    if (!negocioId) return
    if (fetchingRef.current) return
    fetchingRef.current = true
    setLoading(true)

    try {
      // Try to consume pre-fetched bootstrap data (started during login)
      const bootstrapPromise = getBootstrapPromise()
      if (bootstrapPromise) {
        const result = await bootstrapPromise
        if (result?.data) {
          applyBootstrapData(result.data)
          setLoading(false)
          fetchingRef.current = false
          return
        }
      }

      // Fallback: individual queries (page refresh, direct navigation)
      const cutoff = getCutoff60Days()
      const [
        clientesRes,
        lavadasRes,
        tiposLavadoRes,
        lavadoresRes,
        metodosPagoRes,
        tiposMembresiaRes,
        serviciosAdicionalesRes,
        productosRes,
        plantillasRes,
        categoriasTransaccionRes,
      ] = await Promise.all([
        supabase.from('clientes').select(CLIENTES_SELECT).eq('negocio_id', negocioId).order('nombre'),
        supabase.from('lavadas').select(LAVADAS_SELECT).eq('negocio_id', negocioId).gte('fecha', cutoff).order('fecha', { ascending: false }).limit(500),
        supabase.from('tipos_lavado').select('*').eq('negocio_id', negocioId).eq('activo', true),
        supabase.from('lavadores').select('*').eq('negocio_id', negocioId).eq('activo', true),
        supabase.from('metodos_pago').select('*').eq('negocio_id', negocioId).eq('activo', true),
        supabase.from('tipos_membresia').select('*').eq('negocio_id', negocioId).eq('activo', true),
        supabase.from('servicios_adicionales').select('*').eq('negocio_id', negocioId).eq('activo', true).order('nombre'),
        supabase.from('productos').select('*').eq('negocio_id', negocioId).order('nombre'),
        supabase.from('plantillas_mensaje').select('*').eq('negocio_id', negocioId).eq('activo', true).order('nombre'),
        supabase.from('categorias_transaccion').select('*').eq('negocio_id', negocioId).eq('activo', true).order('nombre'),
      ])

      setClientes(clientesRes.data || [])
      setLavadas(lavadasRes.data || [])
      setLavadasAllLoaded(false)
      setTiposLavado(tiposLavadoRes.data || [])
      setLavadores(lavadoresRes.data || [])
      setMetodosPago(metodosPagoRes.data || [])
      setTiposMembresia(tiposMembresiaRes.data || [])
      setServiciosAdicionales(serviciosAdicionalesRes.data || [])
      setProductos(productosRes.data || [])
      setPlantillasMensaje(plantillasRes.data || [])
      setCategoriasTransaccion(categoriasTransaccionRes.data || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }

  const refreshLavadas = useCallback(async () => {
    const cutoff = getCutoff60Days()
    const query = lavadasAllLoaded
      ? supabase.from('lavadas').select(LAVADAS_SELECT).eq('negocio_id', negocioId).order('fecha', { ascending: false })
      : supabase.from('lavadas').select(LAVADAS_SELECT).eq('negocio_id', negocioId).gte('fecha', cutoff).order('fecha', { ascending: false }).limit(500)
    const { data } = await query
    setLavadas(data || [])
  }, [negocioId, lavadasAllLoaded])

  const loadAllLavadas = useCallback(async () => {
    if (lavadasAllLoaded) return
    const { data } = await supabase
      .from('lavadas')
      .select(LAVADAS_SELECT)
      .eq('negocio_id', negocioId)
      .order('fecha', { ascending: false })
    setLavadas(data || [])
    setLavadasAllLoaded(true)
  }, [lavadasAllLoaded, negocioId])

  const refreshClientes = useCallback(async () => {
    const { data } = await supabase
      .from('clientes')
      .select('*, membresia:tipos_membresia(nombre)')
      .eq('negocio_id', negocioId)
      .order('nombre')
    setClientes(data || [])
  }, [negocioId])

  const refreshConfig = useCallback(async () => {
    const [tiposLavadoRes, lavadoresRes, metodosPagoRes, tiposMembresiaRes, serviciosRes, productosRes, plantillasRes, categoriasRes] = await Promise.all([
      supabase.from('tipos_lavado').select('*').eq('negocio_id', negocioId).eq('activo', true),
      supabase.from('lavadores').select('*').eq('negocio_id', negocioId).eq('activo', true),
      supabase.from('metodos_pago').select('*').eq('negocio_id', negocioId).eq('activo', true),
      supabase.from('tipos_membresia').select('*').eq('negocio_id', negocioId).eq('activo', true),
      supabase.from('servicios_adicionales').select('*').eq('negocio_id', negocioId).eq('activo', true).order('nombre'),
      supabase.from('productos').select('*').eq('negocio_id', negocioId).order('nombre'),
      supabase.from('plantillas_mensaje').select('*').eq('negocio_id', negocioId).eq('activo', true).order('nombre'),
      supabase.from('categorias_transaccion').select('*').eq('negocio_id', negocioId).eq('activo', true).order('nombre'),
    ])
    setTiposLavado(tiposLavadoRes.data || [])
    setLavadores(lavadoresRes.data || [])
    setMetodosPago(metodosPagoRes.data || [])
    setTiposMembresia(tiposMembresiaRes.data || [])
    setServiciosAdicionales(serviciosRes.data || [])
    setProductos(productosRes.data || [])
    setPlantillasMensaje(plantillasRes.data || [])
    setCategoriasTransaccion(categoriasRes.data || [])
  }, [negocioId])

  const updateLavadaLocal = useCallback((lavadaId, updates) => {
    setLavadas(prev => prev.map(l => l.id === lavadaId ? { ...l, ...updates } : l))
  }, [])

  const addLavadaLocal = useCallback((nuevaLavada) => {
    setLavadas(prev => [nuevaLavada, ...prev])
  }, [])

  const addClienteLocal = useCallback((nuevoCliente) => {
    setClientes(prev => [...prev, nuevoCliente].sort((a, b) => a.nombre.localeCompare(b.nombre)))
  }, [])

  const updateClienteLocal = useCallback((clienteId, updates) => {
    setClientes(prev => prev.map(c => c.id === clienteId ? { ...c, ...updates } : c))
  }, [])

  const deleteClienteLocal = useCallback((clienteId) => {
    setClientes(prev => prev.filter(c => c.id !== clienteId))
  }, [])

  const deleteLavadaLocal = useCallback((lavadaId) => {
    setLavadas(prev => prev.filter(l => l.id !== lavadaId))
  }, [])

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
  }, [negocioId, lavadasAllLoaded, refreshLavadas])

  // Supabase Realtime subscription for clientes — debounced
  useEffect(() => {
    if (!negocioId) return

    const channel = supabase
      .channel('clientes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, () => {
        if (clientesDebounceRef.current) clearTimeout(clientesDebounceRef.current)
        clientesDebounceRef.current = setTimeout(() => {
          refreshClientes()
        }, 300)
      })
      .subscribe()

    return () => {
      if (clientesDebounceRef.current) clearTimeout(clientesDebounceRef.current)
      supabase.removeChannel(channel)
    }
  }, [negocioId, refreshClientes])

  const lavadaCountThisMonth = useMemo(() => lavadas.filter(l => {
    const dateOnly = fechaToBogotaDate(l.fecha)
    if (!dateOnly) return false
    const d = new Date(dateOnly + 'T00:00:00')
    const now = nowBogota()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length, [lavadas])

  const clienteCount = clientes.length

  const clearInitialTransacciones = useCallback(() => setInitialTransacciones(null), [])

  const value = useMemo(() => ({
    negocioId,
    clientes,
    lavadas,
    tiposLavado,
    lavadores,
    metodosPago,
    tiposMembresia,
    serviciosAdicionales,
    productos,
    plantillasMensaje,
    categoriasTransaccion,
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
    lavadaCountThisMonth,
    clienteCount,
    initialTransacciones,
    clearInitialTransacciones,
  }), [
    negocioId, clientes, lavadas, tiposLavado, lavadores, metodosPago,
    tiposMembresia, serviciosAdicionales, productos, plantillasMensaje,
    categoriasTransaccion, loading, lavadasAllLoaded, fetchAllData,
    refreshLavadas, refreshClientes, refreshConfig, loadAllLavadas,
    updateLavadaLocal, addLavadaLocal, addClienteLocal, updateClienteLocal,
    deleteClienteLocal, deleteLavadaLocal, lavadaCountThisMonth, clienteCount,
    initialTransacciones, clearInitialTransacciones,
  ])

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  )
}
