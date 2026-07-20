import { DollarSign, MessageCircle, ReceiptText, SlidersHorizontal } from 'lucide-react'
import { useAppNavigation } from '@/hooks/useAppNavigation'
import { useAuth } from '@/hooks/useAuth'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import { useIsScreenerUser } from '@/hooks/useIsScreenerUser'

const BTN =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white transition-colors hover:border-gray-400'

type ProSearchBarActionsProps = {
  /** 대시보드 검색줄 등 더 큰 터치 영역 */
  size?: 'md' | 'sm'
}

export function ProSearchBarActions({ size = 'sm' }: ProSearchBarActionsProps) {
  const { navigate } = useAppNavigation()
  const { user } = useAuth()
  const { isAdmin, ready: isAdminReady } = useIsAdmin(user)
  const { isScreenerUser, ready: isScreenerReady } = useIsScreenerUser(user)
  const showScreener = (isAdminReady && isAdmin) || (isScreenerReady && isScreenerUser)
  const btnClass = size === 'md' ? BTN.replace('h-10 w-10', 'h-11 w-11') : BTN

  return (
    <>
      <button
        type="button"
        onClick={() => navigate('/pro/holdings')}
        className={btnClass}
        title="내 보유종목"
        aria-label="내 보유종목"
      >
        <DollarSign size={18} className="text-emerald-500" strokeWidth={2} aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => navigate('/pro/trades')}
        className={btnClass}
        title="매매일지"
        aria-label="매매일지"
      >
        <ReceiptText size={18} className="text-violet-500" strokeWidth={2} aria-hidden />
      </button>
      {showScreener ? (
        <button
          type="button"
          onClick={() => navigate('/pro/screener')}
          className={btnClass}
          title="스크리너"
          aria-label="스크리너"
        >
          <SlidersHorizontal size={18} className="text-amber-500" strokeWidth={2} aria-hidden />
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => navigate('/pro/chat')}
        className={btnClass}
        title="AI 채팅"
        aria-label="AI 채팅"
      >
        <MessageCircle size={18} className="text-blue-500" strokeWidth={2} aria-hidden />
      </button>
    </>
  )
}
