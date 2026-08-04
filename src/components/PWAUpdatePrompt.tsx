import { useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw, X } from 'lucide-react'

/** 앱을 열어둔 채 새 배포를 찾는 주기 — 짧으면 ‘나중에’ 후에도 팝업이 반복된다 */
const UPDATE_CHECK_MS = 6 * 60 * 60 * 1000
const DISMISS_KEY = 'pwa-update-dismissed'

/** 새 배포 감지 시 업데이트 토스트 — registerType: prompt */
export function PWAUpdatePrompt() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (!r) return
      // 포커스/탭 복귀마다 확인하던 방식은 팝업을 너무 자주 띄워서 제거했다
      setInterval(() => {
        void r.update()
      }, UPDATE_CHECK_MS)
    },
  })

  if (!needRefresh || dismissed) return null

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // private mode 등
    }
    setDismissed(true)
    setNeedRefresh(false)
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 rounded-xl bg-gray-900 p-4 text-white shadow-lg md:left-auto md:right-4 md:w-80">
      <div className="flex items-start gap-3">
        <RefreshCw size={18} className="mt-0.5 flex-shrink-0 text-amber-400" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-[13px] font-bold">새 버전이 있어요</div>
          <div className="mb-3 text-[11px] text-gray-300">탭하면 최신으로 업데이트됩니다</div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                try {
                  sessionStorage.removeItem(DISMISS_KEY)
                } catch {
                  // ignore
                }
                void updateServiceWorker(true)
              }}
              className="rounded bg-amber-500 px-3 py-1.5 text-[12px] font-bold text-gray-900 hover:bg-amber-400"
            >
              업데이트
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="rounded border border-gray-600 bg-transparent px-3 py-1.5 text-[12px] text-gray-300 hover:border-gray-400"
            >
              나중에
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="text-gray-500 hover:text-gray-300"
          aria-label="닫기"
        >
          <X size={16} aria-hidden />
        </button>
      </div>
    </div>
  )
}
