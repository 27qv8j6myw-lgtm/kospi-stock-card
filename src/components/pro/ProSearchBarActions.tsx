import { DollarSign, MessageCircle, TrendingUp } from 'lucide-react'
import { useAppNavigation } from '@/hooks/useAppNavigation'

const BTN =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white transition-colors hover:border-gray-400'

type ProSearchBarActionsProps = {
  /** 대시보드 검색줄 등 더 큰 터치 영역 */
  size?: 'md' | 'sm'
}

export function ProSearchBarActions({ size = 'sm' }: ProSearchBarActionsProps) {
  const { navigate } = useAppNavigation()
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
        onClick={() => navigate('/pro/trends')}
        className={btnClass}
        title="마켓 트렌드"
        aria-label="마켓 트렌드"
      >
        <TrendingUp size={18} className="text-amber-500" strokeWidth={2} aria-hidden />
      </button>
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
