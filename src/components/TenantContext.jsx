import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'

const TenantContext = createContext()

export function useTenant() {
  return useContext(TenantContext)
}

export function TenantProvider({ session, children }) {
  const [negocioId, setNegocioId] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [negocioNombre, setNegocioNombre] = useState('')
  const [setupComplete, setSetupComplete] = useState(true)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async () => {
    if (!session?.user?.id) {
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*, negocio:negocios(id, nombre, setup_complete)')
      .eq('id', session.user.id)
      .single()

    if (data && !error) {
      setNegocioId(data.negocio_id)
      setUserProfile(data)
      setNegocioNombre(data.negocio?.nombre || '')
      setSetupComplete(data.negocio?.setup_complete ?? true)
      setLoading(false)
    } else {
      const pending = localStorage.getItem('pending_negocio')
      if (pending) {
        const { nombre_negocio } = JSON.parse(pending)

        const { error: rpcError } = await supabase.rpc('crear_negocio_y_perfil', {
          p_nombre: nombre_negocio,
          p_email: session.user.email,
        })

        if (!rpcError) {
          localStorage.removeItem('pending_negocio')

          const { data: newData } = await supabase
            .from('user_profiles')
            .select('*, negocio:negocios(id, nombre, setup_complete)')
            .eq('id', session.user.id)
            .single()
          if (newData) {
            setNegocioId(newData.negocio_id)
            setUserProfile(newData)
            setNegocioNombre(newData.negocio?.nombre || '')
            setSetupComplete(newData.negocio?.setup_complete ?? true)
          }
        }
      } else {
        setNegocioId(null)
        setUserProfile(null)
        setNegocioNombre('')
      }
      setLoading(false)
    }
  }, [session?.user?.id, session?.access_token])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const needsOnboarding = !loading && !negocioId
  const needsSetup = !loading && !!negocioId && !setupComplete

  const markSetupDone = useCallback(() => {
    setSetupComplete(true)
  }, [])

  const value = {
    negocioId,
    userProfile,
    negocioNombre,
    loading,
    needsOnboarding,
    needsSetup,
    markSetupDone,
    refresh: fetchProfile,
    userEmail: session?.user?.email,
    userId: session?.user?.id,
  }

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  )
}
