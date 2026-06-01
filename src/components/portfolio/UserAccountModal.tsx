'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { LogOut, UserCircle2, X } from 'lucide-react'
import { ProInvestProfileForm } from '@/components/pro/ProInvestProfileForm'
import type { ProInvestProfileField } from '@/hooks/useProInvestProfile'
import type { ProInvestProfile } from '@/lib/proInvestProfile'

type Props = {
  open: boolean
  onClose: () => void
  userName: string
  email: string
  avatarUrl?: string | null
  showPro: boolean
  profile: ProInvestProfile
  loading: boolean
  saving: ProInvestProfileField | null
  error: string | null
  saveField: (field: ProInvestProfileField, value: string) => Promise<void>
  onSignOut: () => void | Promise<void>
  logoutBusy: boolean
}

export function UserAccountModal({
  open,
  onClose,
  userName,
  email,
  avatarUrl = null,
  showPro,
  profile,
  loading,
  saving,
  error,
  saveField,
  onSignOut,
  logoutBusy,
}: Props) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open || !mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[150] overflow-y-auto bg-black/40"
      onClick={onClose}
      role="presentation"
    >
      <div className="flex min-h-[100dvh] items-center justify-center p-4 py-6 sm:py-8">
        <div
          className="my-auto flex max-h-[min(85dvh,calc(100dvh-3rem))] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl md:max-w-md"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-account-modal-title"
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3.5">
            <UserCircle2 size={18} className="text-amber-600" strokeWidth={1.9} aria-hidden />
            <span id="user-account-modal-title" className="text-[15px] font-bold text-gray-900">
              {showPro ? '계정 · 투자 프로필' : '계정'}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="ml-auto rounded-lg p-1 hover:bg-gray-200"
              aria-label="닫기"
            >
              <X size={18} className="text-gray-500" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-4">
            <div className="mb-4 flex items-center gap-3 border-b border-gray-100 pb-3">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  width={40}
                  height={40}
                  className="size-10 shrink-0 rounded-full bg-gray-100 object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                  <UserCircle2 size={20} strokeWidth={1.8} aria-hidden />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-medium text-gray-900">{userName}</div>
                {email ? (
                  <div className="truncate text-[12px] text-gray-500">{email}</div>
                ) : null}
              </div>
              <button
                type="button"
                disabled={logoutBusy}
                onClick={() => void onSignOut()}
                className="flex size-10 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50 md:size-9"
                aria-label={logoutBusy ? '로그아웃 중' : '로그아웃'}
                title="로그아웃"
              >
                <LogOut size={18} strokeWidth={2} aria-hidden />
              </button>
            </div>

            {showPro ? (
              <ProInvestProfileForm
                profile={profile}
                loading={loading}
                saving={saving}
                error={error}
                saveField={saveField}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
