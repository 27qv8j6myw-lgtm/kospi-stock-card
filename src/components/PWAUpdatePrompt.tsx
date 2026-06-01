import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw, X } from 'lucide-react'

/** 새 배포 감지 시 업데이트 토스트 — registerType: prompt */
export function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (r) {
        setInterval(() => {
          void r.update()
        }, 60 * 60 * 1000)
      }
    },
  })

  if (!needRefresh) return null

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
              onClick={() => void updateServiceWorker(true)}
              className="rounded bg-amber-500 px-3 py-1.5 text-[12px] font-bold text-gray-900 hover:bg-amber-400"
            >
              업데이트
            </button>
            <button
              type="button"
              onClick={() => setNeedRefresh(false)}
              className="rounded border border-gray-600 bg-transparent px-3 py-1.5 text-[12px] text-gray-300 hover:border-gray-400"
            >
              나중에
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          className="text-gray-500 hover:text-gray-300"
          aria-label="닫기"
        >
          <X size={16} aria-hidden />
        </button>
      </div>
    </div>
  )
}
