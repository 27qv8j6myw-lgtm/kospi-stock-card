'use client'

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export type UseIsScreenerUserResult = {
  isScreenerUser: boolean
  ready: boolean
}

/**
 * `user_settings.screener_enabled` — 본인 설정만 RLS로 조회.
 * 관리자는 별도(`useIsAdmin`)로 항상 접근 가능하므로 여기서는 부여된 권한만 본다.
 */
export function useIsScreenerUser(user: User | null): UseIsScreenerUserResult {
  const [isScreenerUser, setIsScreenerUser] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!user?.id) {
      setIsScreenerUser(false)
      setReady(true)
      return
    }

    let cancelled = false
    setReady(false)

    void supabase
      .from('user_settings')
      .select('screener_enabled')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.warn('[useIsScreenerUser]', error.message)
          setIsScreenerUser(false)
        } else {
          setIsScreenerUser(data?.screener_enabled === true)
        }
        setReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [user?.id])

  return { isScreenerUser, ready }
}
