'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import type { User } from '@supabase/supabase-js'

interface StaffInfo {
  role: string
  permissions: string[]
  name: string
}

interface AuthCtx {
  user: User | null
  loading: boolean
  isStaff: boolean
  staffInfo: StaffInfo | null
  signOut: () => Promise<void>
  hasPermission: (resource: string, action: string) => boolean
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  loading: true,
  isStaff: false,
  staffInfo: null,
  signOut: async () => {},
  hasPermission: () => false,
})

export function useAuth() {
  return useContext(AuthContext)
}

function hasAuthCookie() {
  try {
    return document.cookie.split(';').some(c => c.trim().startsWith('sb-'))
  } catch {
    return false
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isStaff, setIsStaff] = useState(false)
  const [staffInfo, setStaffInfo] = useState<StaffInfo | null>(null)
  const mountedRef = useRef(true)
  const subRef = useRef<{ unsubscribe: () => void } | null>(null)
  const supabasePromiseRef = useRef<Promise<typeof import('@/utils/supabase/client')> | null>(null)

  useEffect(() => {
    mountedRef.current = true

    async function sync() {
      if (!hasAuthCookie()) {
        if (subRef.current) { subRef.current.unsubscribe(); subRef.current = null }
        if (mountedRef.current) { setUser(null); setIsStaff(false); setStaffInfo(null); setLoading(false) }
        return
      }
      if (subRef.current) return
      if (!supabasePromiseRef.current) supabasePromiseRef.current = import('@/utils/supabase/client')
      const { createClient } = await supabasePromiseRef.current
      if (!mountedRef.current) return
      const supabase = createClient()
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (mountedRef.current) { setUser(session?.user ?? null); setLoading(false) }
      })
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (mountedRef.current) { setUser(session?.user ?? null); setLoading(false) }
      })
      subRef.current = subscription
    }

    sync().catch(() => { if (mountedRef.current) { setUser(null); setLoading(false) } })

    const onSync = () => { sync().catch(() => {}) }
    const onVisibility = () => { if (document.visibilityState === 'visible') onSync() }
    const onFocus = () => onSync()
    const w = window as any
    w.addEventListener('shanta:auth-sync', onSync)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)
    window.addEventListener('pageshow', onFocus)

    return () => {
      mountedRef.current = false
      if (subRef.current) { subRef.current.unsubscribe(); subRef.current = null }
      w.removeEventListener('shanta:auth-sync', onSync)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('pageshow', onFocus)
    }
  }, [])

  useEffect(() => {
    if (!user?.id) { setIsStaff(false); setStaffInfo(null); return }
    fetch('/api/check-staff', { method: 'POST' })
      .then(r => r.json())
      .then(d => {
        if (mountedRef.current) {
          setIsStaff(!!d.isStaff)
          setStaffInfo(d.isStaff ? { role: d.role, permissions: d.permissions || [], name: d.name } : null)
        }
      })
      .catch(() => { if (mountedRef.current) { setIsStaff(false); setStaffInfo(null) } })
  }, [user?.id])

  const signOut = useCallback(async () => {
    const { createClient } = await import('@/utils/supabase/client')
    const supabase = createClient()
    try {
      await Promise.race([
        supabase.auth.signOut({ scope: 'global' }),
        new Promise<void>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
      ])
    } catch {}
    try {
      const keys = Object.keys(localStorage)
      for (const k of keys) { if (k.startsWith('sb-')) localStorage.removeItem(k) }
    } catch {}
    window.location.href = '/staff-login'
  }, [])

  const hasPermission = useCallback((resource: string, action: string) => {
    if (!staffInfo?.permissions) return false
    return staffInfo.permissions.includes(`${resource}:${action}`)
  }, [staffInfo])

  return (
    <AuthContext.Provider value={{ user, loading, isStaff, staffInfo, signOut, hasPermission }}>
      {children}
    </AuthContext.Provider>
  )
}
