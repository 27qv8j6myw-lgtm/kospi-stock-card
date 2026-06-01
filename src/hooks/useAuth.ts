'use client'

import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export type UseAuthResult = {
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      console.log('[useAuth] init')
      console.log('[useAuth] hash:', window.location.hash.slice(0, 80))

      if (window.location.hash.includes('access_token')) {
        console.log('[useAuth] OAuth callback - 처리 대기...')
        await new Promise((r) => setTimeout(r, 500))
      }

      const {
        data: { session },
        error,
      } = await supabase.auth.getSession()

      console.log(
        '[useAuth] session:',
        session ? `user=${session.user.email}` : 'none',
        error?.message ?? '',
      )

      if (session && window.location.hash.includes('access_token')) {
        window.history.replaceState(null, '', window.location.pathname)
        console.log('[useAuth] URL fragment 정리됨')
      }

      if (!cancelled) {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    }

    void init()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[useAuth] event:', event, session ? `user=${session.user.email}` : 'no session')

      if (!cancelled) {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    console.log('[useAuth] Google 로그인 시작')

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    })

    if (error) {
      console.error('[useAuth] OAuth 실패:', error.message)
      throw error
    }

    console.log('[useAuth] signInWithOAuth OK, redirect URL:', data?.url?.slice(0, 60))
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }, [])

  return { user, loading, signInWithGoogle, signOut }
}
