import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'
import { proDesign } from '@/lib/proStockDesign'
import { ProTechBox } from './ProTechBox'

type TechnicalData = {
  rsi?: number | null
  macd?: number | null
  bollinger?: { current: number; upper: number; lower: number } | null
}

export function ProTechIndicators({ code }: { code: string }) {
  const [tech, setTech] = useState<TechnicalData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    void authFetch(apiUrl(`/api/pro-stock-technical?code=${code}`))
      .then((r) => (r.ok ? r.json() : null))
      .then((d: TechnicalData | null) => setTech(d))
      .catch(() => setTech(null))
      .finally(() => setLoading(false))
  }, [code])

  if (loading) {
    return (
      <div
        className={`flex h-16 items-center justify-center text-[11px] text-gray-400 ${proDesign.whiteBox}`}
      >
        지표 계산 중...
      </div>
    )
  }

  if (!tech) {
    return (
      <div
        className={`flex h-16 items-center justify-center text-[11px] text-gray-400 ${proDesign.whiteBox}`}
      >
        지표 데이터 없음
      </div>
    )
  }

  const rsi = tech.rsi
  const rsiStatus =
    rsi != null && rsi > 70
      ? { label: '과매수', color: 'text-red-600' }
      : rsi != null && rsi < 30
        ? { label: '과매도', color: 'text-blue-600' }
        : { label: '중립', color: 'text-gray-600' }

  const macd = tech.macd
  const macdStatus =
    macd != null && macd > 0
      ? { label: '강세', color: 'text-red-600' }
      : { label: '약세', color: 'text-blue-600' }

  const bollingerStatus = tech.bollinger
    ? tech.bollinger.current >= tech.bollinger.upper * 0.98
      ? { label: '상단 근접', color: 'text-red-600' }
      : tech.bollinger.current <= tech.bollinger.lower * 1.02
        ? { label: '하단 근접', color: 'text-blue-600' }
        : { label: '중간대', color: 'text-gray-600' }
    : { label: '—', color: 'text-gray-400' }

  return (
    <div className="grid grid-cols-3 gap-2">
      <ProTechBox
        label="RSI(14)"
        value={rsi != null ? rsi.toFixed(1) : '—'}
        status={rsiStatus.label}
        statusColor={rsiStatus.color}
        desc="14일 상대강도지수. 70 이상 과매수, 30 이하 과매도. 단기 매매 타이밍 참고용."
      />
      <ProTechBox
        label="MACD"
        value={macd != null ? macd.toLocaleString() : '—'}
        status={macdStatus.label}
        statusColor={macdStatus.color}
        desc="12-26일 이동평균선 차이. 양수=강세, 음수=약세. 추세 전환 시점 포착."
      />
      <ProTechBox
        label="볼린저"
        value={bollingerStatus.label}
        status={bollingerStatus.label === '하단 근접' ? '반등 가능' : bollingerStatus.label}
        statusColor={bollingerStatus.color}
        desc="20일 평균 ± 2 표준편차. 상단 근접=과열, 하단 근접=반등 가능성."
      />
    </div>
  )
}
