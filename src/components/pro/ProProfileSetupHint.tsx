'use client'

import { useEffect, useState } from 'react'
import { useProInvestProfile } from '@/hooks/useProInvestProfile'
import { hasProInvestProfile, PRO_PROFILE_HINT_STORAGE_KEY } from '@/lib/proInvestProfile'

type Props = {
  className?: string
}

/** 프로필 미설정 시 분석 하단 부드러운 유도 (세션당 1회 표시) */
export function ProProfileSetupHint({ className = '' }: Props) {
  const { profile, loading } = useProInvestProfile()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (loading || hasProInvestProfile(profile)) return
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem(PRO_PROFILE_HINT_STORAGE_KEY) === '1') return
    setVisible(true)
    sessionStorage.setItem(PRO_PROFILE_HINT_STORAGE_KEY, '1')
  }, [loading, profile])

  if (!visible) return null

  return (
    <div
      className={`mt-2 rounded-lg bg-gray-50 p-2 text-[11px] leading-relaxed text-gray-400 ${className}`}
    >
      💡 프로필 아이콘에서 투자성향을 설정하면 맞춤 분석을 받을 수 있어요
    </div>
  )
}
