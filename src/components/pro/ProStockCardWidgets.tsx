import { useEffect, useState, type ReactNode } from 'react'
import {
  Bell,
  Bookmark,
  Check,
  LogIn,
  MessageCircle,
  Shield,
  Target,
} from 'lucide-react'
import { useAppNavigation } from '@/hooks/useAppNavigation'
import {
  addProWatchlist,
  fetchProStockTechnical,
  fetchProWatchlist,
  removeProWatchlist,
  type ProStockSummary,
} from '@/lib/proStockApi'
import type { ParsedStrategy } from '@/lib/parseProAnalysis'

export function SectionHeader({
  icon,
  title,
  meta,
}: {
  icon: ReactNode
  title: string
  meta?: string
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-gray-100 text-gray-600">
          {icon}
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
          {title}
        </span>
      </div>
      {meta ? <span className="text-[10px] text-gray-400">{meta}</span> : null}
    </div>
  )
}

export function StrategyBoxes({
  strategy,
  currentPrice,
}: {
  strategy: ParsedStrategy
  currentPrice: number
}) {
  const { entryPrice, targetPrice, stopLoss, entryReason } = strategy
  if (!entryPrice && !targetPrice && !stopLoss) return null

  const pctTarget =
    targetPrice && currentPrice
      ? Math.round(((targetPrice - currentPrice) / currentPrice) * 100)
      : null
  const pctStop =
    stopLoss && currentPrice
      ? Math.round(((stopLoss - currentPrice) / currentPrice) * 100)
      : null

  return (
    <div className="mt-3 grid grid-cols-3 gap-2">
      <div className="rounded-lg border border-red-200 bg-red-50 p-2.5">
        <div className="mb-1 flex items-center gap-1">
          <LogIn size={10} className="text-red-600" strokeWidth={2} />
          <span className="text-[9px] font-bold uppercase tracking-wider text-red-600">
            진입가
          </span>
        </div>
        <div className="text-[13px] font-bold tabular-nums text-gray-900">
          {entryPrice != null ? `${entryPrice.toLocaleString()}원` : '—'}
        </div>
        <div className="mt-0.5 text-[9px] text-gray-500">{entryReason || '—'}</div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5">
        <div className="mb-1 flex items-center gap-1">
          <Target size={10} className="text-amber-700" strokeWidth={2} />
          <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700">
            목표가
          </span>
        </div>
        <div className="text-[13px] font-bold tabular-nums text-gray-900">
          {targetPrice != null ? `${targetPrice.toLocaleString()}원` : '—'}
        </div>
        <div className="mt-0.5 text-[9px] text-gray-500">
          {pctTarget != null ? `+${pctTarget}%` : '—'}
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-2.5">
        <div className="mb-1 flex items-center gap-1">
          <Shield size={10} className="text-blue-600" strokeWidth={2} />
          <span className="text-[9px] font-bold uppercase tracking-wider text-blue-600">
            손절가
          </span>
        </div>
        <div className="text-[13px] font-bold tabular-nums text-gray-900">
          {stopLoss != null ? `${stopLoss.toLocaleString()}원` : '—'}
        </div>
        <div className="mt-0.5 text-[9px] text-gray-500">
          {pctStop != null ? `${pctStop}%` : '—'}
        </div>
      </div>
    </div>
  )
}

export function InvestorBars({
  investor,
}: {
  investor: ProStockSummary['investor']
}) {
  if (!investor) return null

  const foreignAmount = investor.foreign?.cumulativeNet ?? 0
  const instituteAmount = investor.institute?.cumulativeNet ?? 0
  const max = Math.max(Math.abs(foreignAmount), Math.abs(instituteAmount), 1)
  const foreignWidth = Math.min((Math.abs(foreignAmount) / max) * 100, 100)
  const instituteWidth = Math.min((Math.abs(instituteAmount) / max) * 100, 100)

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
          외국인
        </div>
        <div
          className={`mb-1 text-[16px] font-bold tabular-nums ${
            foreignAmount > 0 ? 'text-red-600' : 'text-blue-600'
          }`}
        >
          {foreignAmount > 0 ? '+' : ''}
          {(foreignAmount / 1e8).toFixed(0)}억
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-gray-200">
          <div
            className={`h-full rounded-full ${foreignAmount > 0 ? 'bg-red-600' : 'bg-blue-600'}`}
            style={{ width: `${foreignWidth}%` }}
          />
        </div>
        <div className="mt-1.5 text-[10px] text-gray-500">
          {investor.foreign?.buyDays ?? 0}일 매수 / 5일 누적
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
          기관
        </div>
        <div
          className={`mb-1 text-[16px] font-bold tabular-nums ${
            instituteAmount > 0 ? 'text-red-600' : 'text-blue-600'
          }`}
        >
          {instituteAmount > 0 ? '+' : ''}
          {(instituteAmount / 1e8).toFixed(0)}억
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-gray-200">
          <div
            className={`h-full rounded-full ${instituteAmount > 0 ? 'bg-red-600' : 'bg-blue-600'}`}
            style={{ width: `${instituteWidth}%` }}
          />
        </div>
        <div className="mt-1.5 text-[10px] text-gray-500">
          {investor.institute?.buyDays ?? 0}일 매수 / 5일 누적
        </div>
      </div>
    </div>
  )
}

export function Range52Week({
  week52,
  currentPrice,
}: {
  week52: ProStockSummary['week52']
  currentPrice: number
}) {
  if (!week52?.high52w || !week52?.low52w || !currentPrice) return null

  const range = week52.high52w - week52.low52w
  if (range <= 0) return null

  const position = ((currentPrice - week52.low52w) / range) * 100
  const clampedPos = Math.min(Math.max(position, 0), 100)
  const pctFromHigh = ((currentPrice - week52.high52w) / week52.high52w) * 100

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3.5">
      <div className="relative h-1.5 rounded-full bg-gradient-to-r from-blue-200 via-amber-200 to-red-200">
        <div
          className="absolute -top-1 h-3.5 w-3 rounded-sm bg-gray-900"
          style={{ left: `${clampedPos}%`, transform: 'translateX(-50%)' }}
        />
        <div
          className="absolute -top-9 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-[10px] font-bold text-white"
          style={{ left: `${clampedPos}%`, transform: 'translateX(-50%)' }}
        >
          {currentPrice.toLocaleString()}원
          <div
            className="absolute -bottom-1 left-1/2 h-2 w-2 rotate-45 bg-gray-900"
            style={{ transform: 'translateX(-50%) rotate(45deg)' }}
          />
        </div>
      </div>
      <div className="mt-3 flex justify-between text-[10px] tabular-nums text-gray-500">
        <span>{week52.low52w.toLocaleString()}</span>
        <span className="font-semibold">{pctFromHigh.toFixed(1)}% from 최고</span>
        <span>{week52.high52w.toLocaleString()}</span>
      </div>
    </div>
  )
}

export function TechnicalIndicators({ code }: { code: string }) {
  const [tech, setTech] = useState<{
    rsi?: number | null
    macd?: number | null
    bollinger?: {
      middle: number
      upper: number
      lower: number
      current: number
    } | null
  } | null>(null)

  useEffect(() => {
    void fetchProStockTechnical(code)
      .then(setTech)
      .catch(() => setTech(null))
  }, [code])

  if (!tech) return null

  const getRsiStatus = (rsi: number) => {
    if (rsi > 70) return { label: '과매수', color: 'text-red-600' }
    if (rsi < 30) return { label: '과매도', color: 'text-blue-600' }
    return { label: '중립', color: 'text-gray-600' }
  }

  const getMacdStatus = (macd: number) => {
    if (macd > 0) return { label: '강세', color: 'text-red-600' }
    return { label: '약세', color: 'text-blue-600' }
  }

  const getBollingerStatus = (b: NonNullable<typeof tech>['bollinger']) => {
    if (!b) return { label: '—', color: 'text-gray-400' }
    const { current, upper, lower } = b
    if (current >= upper * 0.98) return { label: '상단 근접', color: 'text-red-600' }
    if (current <= lower * 1.02) return { label: '하단 근접', color: 'text-blue-600' }
    return { label: '중간대', color: 'text-gray-600' }
  }

  const rsiStatus =
    tech.rsi != null ? getRsiStatus(tech.rsi) : { label: '—', color: 'text-gray-400' }
  const macdStatus =
    tech.macd != null ? getMacdStatus(tech.macd) : { label: '—', color: 'text-gray-400' }
  const bollingerStatus = getBollingerStatus(tech.bollinger)

  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-center">
        <div className="mb-1 text-[9px] font-semibold uppercase text-gray-400">RSI(14)</div>
        <div className="text-[13px] font-bold tabular-nums text-gray-900">
          {tech.rsi != null ? tech.rsi.toFixed(1) : '—'}
        </div>
        <div className={`mt-0.5 text-[9px] font-semibold ${rsiStatus.color}`}>
          {rsiStatus.label}
        </div>
      </div>
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-center">
        <div className="mb-1 text-[9px] font-semibold uppercase text-gray-400">MACD</div>
        <div className="text-[13px] font-bold tabular-nums text-gray-900">
          {tech.macd != null ? tech.macd.toFixed(0) : '—'}
        </div>
        <div className={`mt-0.5 text-[9px] font-semibold ${macdStatus.color}`}>
          {macdStatus.label}
        </div>
      </div>
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-center">
        <div className="mb-1 text-[9px] font-semibold uppercase text-gray-400">볼린저</div>
        <div className="text-[13px] font-bold text-gray-900">{tech.bollinger ? '✓' : '—'}</div>
        <div className={`mt-0.5 text-[9px] font-semibold ${bollingerStatus.color}`}>
          {bollingerStatus.label}
        </div>
      </div>
    </div>
  )
}

export function ActionButtons({ code, name }: { code: string; name: string }) {
  const [inWatchlist, setInWatchlist] = useState(false)
  const { navigate } = useAppNavigation()

  useEffect(() => {
    void fetchProWatchlist()
      .then((list) => {
        setInWatchlist(list.some((w) => w.code === code))
      })
      .catch(() => setInWatchlist(false))
  }, [code])

  const toggleWatchlist = async () => {
    if (inWatchlist) {
      await removeProWatchlist(code)
      setInWatchlist(false)
    } else {
      await addProWatchlist(code)
      setInWatchlist(true)
    }
  }

  return (
    <div className="flex gap-2 border-t border-gray-100 px-5 py-4">
      <button
        type="button"
        onClick={() =>
          navigate(`/pro/chat?stock=${code}&name=${encodeURIComponent(name)}`)
        }
        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white py-2.5 text-[12px] font-semibold text-gray-700 hover:border-gray-400"
      >
        <MessageCircle size={13} strokeWidth={1.8} />
        <span>채팅 분석</span>
      </button>

      <button
        type="button"
        onClick={() => void toggleWatchlist()}
        className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-[12px] font-semibold transition-colors ${
          inWatchlist
            ? 'border border-amber-300 bg-amber-100 text-amber-800'
            : 'border border-gray-300 bg-white text-gray-700 hover:border-gray-400'
        }`}
      >
        {inWatchlist ? (
          <Check size={13} strokeWidth={2} />
        ) : (
          <Bookmark size={13} strokeWidth={1.8} />
        )}
        <span>{inWatchlist ? '관심 등록됨' : '관심 종목'}</span>
      </button>

      <button
        type="button"
        onClick={() => alert('알림 기능 준비 중 (다음 Day 작업)')}
        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gray-900 py-2.5 text-[12px] font-semibold text-white hover:bg-gray-800"
      >
        <Bell size={13} strokeWidth={1.8} />
        <span>알림 설정</span>
      </button>
    </div>
  )
}
