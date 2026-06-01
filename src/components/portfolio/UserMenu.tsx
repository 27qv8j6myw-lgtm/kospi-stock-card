'use client'

import { useCallback, useState } from 'react'
import { User } from 'lucide-react'
import { UserAccountModal } from '@/components/portfolio/UserAccountModal'
import { useAuth } from '@/hooks/useAuth'
import { useIsProUser } from '@/hooks/useIsProUser'
import { useProInvestProfile } from '@/hooks/useProInvestProfile'
import { PRO_CLAUDE_MODEL_BADGE, PRO_CLAUDE_MODEL_LABEL } from '@/lib/claudeModelDisplay'

export function UserMenu() {
  const { user, signOut } = useAuth()
  const { isProUser: showPro } = useIsProUser(user)
  const [open, setOpen] = useState(false)
  const [logoutBusy, setLogoutBusy] = useState(false)

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
        {showPro ? (
          <span
            className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium tracking-wide text-gray-500 sm:text-[11px]"
            title={`AI 모델: ${PRO_CLAUDE_MODEL_LABEL}`}
          >
            {PRO_CLAUDE_MODEL_BADGE}
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
