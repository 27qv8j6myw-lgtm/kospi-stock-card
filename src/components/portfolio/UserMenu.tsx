'use client'

import { useCallback, useEffect, useState } from 'react'
import { User } from 'lucide-react'
import { UserAccountModal } from '@/components/portfolio/UserAccountModal'
import { useAuth } from '@/hooks/useAuth'
import { useIsProUser } from '@/hooks/useIsProUser'
import { useProInvestProfile } from '@/hooks/useProInvestProfile'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'

export function UserMenu() {
  const { user, signOut } = useAuth()
  const { isProUser: showPro } = useIsProUser(user)
  const [open, setOpen] = useState(false)
  const [logoutBusy, setLogoutBusy] = useState(false)
  const [usageCost, setUsageCost] = useState<number | null>(null)

  useEffect(() => {
    if (!showPro) return
    let active = true
    void (async () => {
      try {
        const r = await authFetch(apiUrl('/api/pro-usage-cost'))
        if (!r.ok) return
        const d = (await r.json().catch(() => ({}))) as { costUsd?: number }
        if (active && typeof d.costUsd === 'number') setUsageCost(d.costUsd)
      } catch {
        // 조용히 숨김
      }
    })()
    return () => {
      active = false
    }
  }, [showPro])

  const { profile, loading, saving, error, saveField } = useProInvestProfile({
    enabled: open && showPro,
  })

  const onSignOut = useCallback(async () => {
    setLogoutBusy(true)
    try {
      await signOut()
      setOpen(false)
    } catch (e) {
      console.error('[UserMenu]', e)
    } finally {
      setLogoutBusy(false)
    }
  }, [signOut])

  if (!user) return null

  const email = user.email || ''
  const userName =
    (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name.trim()) ||
    email.split('@')[0] ||
    '계정'
  const avatarUrl =
    typeof user.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : null

  return (
    <>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {showPro && usageCost != null ? (
          <span
            className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-emerald-700 sm:text-[11px]"
            title="내 누적 AI 사용금액(USD)"
          >
            {usageCost < 0.01 ? '$0.00' : `$${usageCost.toFixed(2)}`}
          </span>
        ) : null}
        {showPro ? (
          <span
            className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white sm:text-[11px]"
            title="PRO 모드 사용자"
          >
            PRO
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-label="계정 메뉴"
          className="flex size-10 shrink-0 items-center justify-center rounded-full outline-none ring-amber-400 focus-visible:ring-2 md:size-8"
        >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            width={32}
            height={32}
            className="size-8 rounded-full bg-gray-100 object-cover md:size-8"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex size-8 items-center justify-center rounded-full border border-default bg-neutral-bg text-secondary">
            <User className="size-4" strokeWidth={2} aria-hidden />
          </div>
        )}
        </button>
      </div>

      <UserAccountModal
        open={open}
        onClose={() => setOpen(false)}
        userName={userName}
        email={email}
        avatarUrl={avatarUrl}
        showPro={showPro}
        profile={profile}
        loading={loading}
        saving={saving}
        error={error}
        saveField={saveField}
        onSignOut={onSignOut}
        logoutBusy={logoutBusy}
      />
    </>
  )
}
