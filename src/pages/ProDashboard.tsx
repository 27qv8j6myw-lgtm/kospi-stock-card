import type { ReactNode } from 'react'
import { BarChart3, Bell, BookOpen, Sparkles } from 'lucide-react'
import { useAppNavigation } from '@/hooks/useAppNavigation'

export default function ProDashboard() {
  const { navigate } = useAppNavigation()

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={20} style={{ color: '#D97706' }} strokeWidth={1.8} />
          <h1 className="text-[20px] font-bold text-gray-900 tracking-tight">Pro Dashboard</h1>
        </div>
        <p className="text-[13px] text-gray-500 tracking-tight">중석 본인 전용 매매 도구</p>
      </div>

      <button
        type="button"
        onClick={() => navigate('/pro/chat')}
        className="block w-full mb-4 text-left bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-amber-300 rounded-2xl p-6 hover:border-amber-500 transition-colors"
      >
        <div className="flex items-center gap-3 mb-2">
          <Sparkles size={22} className="text-amber-700 shrink-0" />
          <h2 className="text-[18px] font-bold text-gray-900">매매 어시스턴트</h2>
          <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded text-[10px] font-bold">NEW</span>
        </div>
        <p className="text-[12px] text-gray-700 leading-relaxed">
          Opus 와 대화하며 실시간 KIS 데이터 기반 매매 결정.
          종목 시세, 52주 위치를 한 채팅창에서.
        </p>
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <FeatureCard
          icon={<BookOpen size={20} strokeWidth={1.5} />}
          title="매매 일지"
          description="매매 기록 + AI 회고"
          status="준비 중"
          onClick={() => alert('Day 4-5 작업')}
        />
        <FeatureCard
          icon={<Bell size={20} strokeWidth={1.5} />}
          title="알림"
          description="급등/급락/외국인 매수 알림"
          status="준비 중"
          onClick={() => alert('Day 6 작업')}
        />
        <FeatureCard
          icon={<BarChart3 size={20} strokeWidth={1.5} />}
          title="백테스트"
          description="너 매매 룰 과거 성과"
          status="준비 중"
          onClick={() => alert('Day 7+ 작업')}
        />
      </div>

      <div className="mt-8 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">로드맵</span>
        </div>
        <ul className="text-[12px] text-amber-900 leading-relaxed space-y-1">
          <li>• Day 2: KIS 풀스택 데이터 (PER, PBR, 52주, 투자자 동향)</li>
          <li>• Day 3: 종목 카드에 Pro 박스 (너만 보이는 추가 분석)</li>
          <li>• Day 4-5: 매매 일지 시스템</li>
          <li>• Day 6: 알림 시스템</li>
          <li>• Day 7+: 백테스트, 패턴 학습</li>
        </ul>
      </div>
    </div>
  )
}

type FeatureCardProps = {
  icon: ReactNode
  title: string
  description: string
  status: string
  onClick: () => void
}

function FeatureCard({ icon, title, description, status, onClick }: FeatureCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-xl p-5 text-left hover:border-gray-300 transition-colors"
    >
      <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center mb-3">
        {icon}
      </div>
      <p className="text-[14px] font-semibold text-gray-900 mb-1 tracking-tight">{title}</p>
      <div className="text-[12px] text-gray-500 mb-2 tracking-tight">{description}</div>
      <div className="text-[10px] text-amber-600 font-semibold uppercase tracking-wider">{status}</div>
    </button>
  )
}
