'use client'

import { Lock } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

export default function BlockedPage() {
  const { signOut } = useAuth()

  return (
    <div className="flex min-h-svh items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-gray-100 text-gray-600">
          <Lock className="size-7" aria-hidden />
        </div>
        <h1 className="mt-6 text-lg font-bold text-gray-900">접근이 차단되었습니다</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          이 계정은 관리자에 의해 일시 차단되었습니다.
          <br />
          문의가 필요하면 관리자에게 연락해 주세요.
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-8 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50"
        >
          로그아웃
        </button>
      </div>
    </div>
  )
}
