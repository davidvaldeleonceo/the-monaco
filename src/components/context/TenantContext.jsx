import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { supabase, getCachedProfile, clearProfileCache } from '../../apiClient'
import { setCurrency } from '../../utils/money'
import { COUNTRY_CURRENCY } from '../../config/currencies'

const TenantContext = createContext()

export function useTenant() {
  return useContext(TenantContext)
}

function computePlanStatus(negocio) {
  if (!negocio) return { isPro: false, status: 'free', daysLeft: null, cancelled: false }
  const now = new Date()
  const cancelled = negocio.plan === 'cancelled'

  if (negocio.subscription_expires_at && new Date(negocio.subscription_expires_at) > now) {
    return { isPro: true, status: cancelled ? 'cancelled' : 'active', daysLeft: null, cancelled }
  }
  if (negocio.trial_ends_at && new Date(negocio.trial_ends_at) > now) {
    const daysLeft = Math.ceil((new Date(negocio.trial_ends_at) - now) / 86400000)
    return { isPro: true, status: cancelled ? 'cancelled' : 'trial', daysLeft, cancelled }
  }
  return { isPro: false, status: 'free', daysLeft: null, cancelled: false }
}

export function TenantProvider({ session, children }) {
  const [negocioId, setNegocioId] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [negocioNombre, setNegocioNombre] = useState('')
  const [setupComplete, setSetupComplete] = useState(true)
  const [loading, setLoading] = useState(true)
  const [justCompletedSetup, setJustCompletedSetup] = useState(false)

  const applyProfile = useCallback((data) => {
    setNegocioId(data.negocio_id)
    setUserProfile(data)
    setNegocioNombre(data.negocio?.nombre || '')
    setSetupComplete(data.negocio?.setup_complete ?? true)
    setCurrency(COUNTRY_CURRENCY[data.negocio?.pais] || data.negocio?.moneda || 'COP')
  }, [])

  const fetchProfile = useCallback(async () => {
    if (!session?.user?.id) {
      setLoading(false)
      return
    }

    // Fast path 1: profile from login response (instant, no API call)
    if (session.profile) {
      applyProfile(session.profile)
      setLoading(false)
      return
    }

    // Fast path 2: cached profile from sessionStorage (page refresh)
    const cached = getCachedProfile()
    if (cached && cached.id === session.user.id) {
      applyProfile(cached)
      setLoading(false)
      return
    }

    // Fallback: API fetch (direct navigation, edge cases)
    setLoading(true)
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*, negocio:negocios(id, nombre, setup_complete, plan, trial_ends_at, subscription_expires_at, subscription_period, moneda, pais)')
      .eq('id', session.user.id)
      .single()

    if (data && !error) {
      applyProfile(data)
      setLoading(false)
    } else {
      const pending = localStorage.getItem('pending_negocio')
      if (pending) {
        const { nombre_negocio, pais: pendingPais } = JSON.parse(pending)

        const { error: rpcError } = await supabase.rpc('crear_negocio_y_perfil', {
          p_nombre: nombre_negocio,
          p_email: session.user.email,
          p_pais: pendingPais || 'CO',
        })

        if (!rpcError) {
          localStorage.removeItem('pending_negocio')

          const { data: newData } = await supabase
            .from('user_profiles')
            .select('*, negocio:negocios(id, nombre, setup_complete, plan, trial_ends_at, subscription_expires_at, subscription_period, moneda, pais)')
            .eq('id', session.user.id)
            .single()
          if (newData) {
            applyProfile(newData)
          }
        }
      } else {
        setNegocioId(null)
        setUserProfile(null)
        setNegocioNombre('')
      }
      setLoading(false)
    }
  }, [session?.user?.id, session?.access_token, session?.profile, applyProfile])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const needsOnboarding = !loading && !negocioId
  const needsSetup = !loading && !!negocioId && !setupComplete

  const markSetupDone = useCallback(() => {
    setSetupComplete(true)
    setJustCompletedSetup(true)
  }, [])

  const clearJustCompletedSetup = useCallback(() => {
    setJustCompletedSetup(false)
  }, [])

  const planInfo = useMemo(() => {
    if (!userProfile?.negocio) return { isPro: false, status: 'free', daysLeft: null, cancelled: false }
    return computePlanStatus(userProfile.negocio)
  }, [userProfile?.negocio?.plan, userProfile?.negocio?.trial_ends_at, userProfile?.negocio?.subscription_expires_at])

  const value = {
    negocioId,
    userProfile,
    negocioNombre,
    loading,
    needsOnboarding,
    needsSetup,
    markSetupDone,
    justCompletedSetup,
    clearJustCompletedSetup,
    refresh: async () => {
      // Force a real API fetch (bypass cache)
      clearProfileCache()
      setLoading(true)
      const { data } = await supabase
        .from('user_profiles')
        .select('*, negocio:negocios(id, nombre, setup_complete, plan, trial_ends_at, subscription_expires_at, subscription_period, moneda, pais)')
        .eq('id', session.user.id)
        .single()
      if (data) applyProfile(data)
      setLoading(false)
    },
    userEmail: session?.user?.email,
    userId: session?.user?.id,
    isPro: planInfo.isPro,
    planStatus: planInfo.status,
    planCancelled: planInfo.cancelled,
    daysLeftInTrial: planInfo.daysLeft,
    subscriptionPeriod: userProfile?.negocio?.subscription_period || null,
    pais: userProfile?.negocio?.pais || 'CO',
    currencyCode: userProfile?.negocio?.moneda || 'COP',
  }

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  )
}
