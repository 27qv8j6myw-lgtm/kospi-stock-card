'use client'

import { useCallback, useState } from 'react'
import { LogOut, User } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

export function UserMenu() {
  const { user, signOut } = useAuth()
  const [busy, setBusy] = useState(false)

  const onSignOut = useCallback(async () => {
    setBusy(true)
    try {
      await signOut()
    } catch (e) {
      console.error('[UserMenu]', e)
    } finally {
      setBusy(false)
    }
  }, [signOut])

  if (!user) return null

  const label = user.email || user.user_metadata?.full_name || '계정'
  const avatarUrl =
    typeof user.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : undefined

  return (
    <div className="flex min-w-0 max-w-[55vw] flex-wrap items-center justify-end gap-x-2 gap-y-1 sm:max-w-none">
      <div className="flex shrink-0 items-center sm:hidden" title={label}>
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="size-8 rounded-full object-cover" />
        ) : (
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-default bg-neutral-bg text-secondary">
            <User className="size-4 shrink-0" strokeWidth={2} aria-hidden />
          </div>
        )}
      </div>
      <span
        className="hidden min-w-0 items-center gap-1 truncate text-xs text-secondary sm:inline-flex"
        title={label}
      >
        <User className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
        <span className="hidden min-w-0 truncate text-xs sm:inline">{label}</span>
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={onSignOut}
        aria-label="로그아웃"
        className="flex shrink-0 items-center gap-1 rounded-lg border border-default px-2 py-1.5 text-xs font-medium text-secondary hover:bg-neutral-bg disabled:opacity-50"
      >
        <LogOut size={14} strokeWidth={2} aria-hidden />
        <span className="hidden sm:inline">로그아웃</span>
      </button>
    </div>
  )
}
