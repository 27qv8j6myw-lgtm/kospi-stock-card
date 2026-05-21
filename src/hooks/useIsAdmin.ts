'use client'

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export type UseIsAdminResult = {
  /** RPC `is_admin()` 결과 */
  isAdmin: boolean
  /** 첫 RPC 완료 전에는 `false` — `isAdmin`만 보면 오판하지 말 것 */
  ready: boolean
}

/**
 * Supabase `is_admin()` RPC 결과 (DB·RLS와 일치). `process.env` 관리자 목록은 사용하지 않음.
 * `useAuth()` 와 같은 컴포넌트에서 쓰려면 `user`만 넘기세요 (훅 중복 호출 방지).
 * @param {User | null} user
 */
export function useIsAdmin(user: User | null): UseIsAdminResult {
  const [isAdmin, setIsAdmin] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!user) {
      setIsAdmin(false)
      setReady(false)
      return
    }

    let cancelled = false
    setReady(false)
    setIsAdmin(false)

    const check = async () => {
      const { data, error } = await supabase.rpc('is_admin')
      console.log('[useIsAdmin] result:', { data, error: error?.message })
      if (cancelled) return
      setIsAdmin(data === true)
      setReady(true)
    }

    void check()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  return { isAdmin, ready }
}
