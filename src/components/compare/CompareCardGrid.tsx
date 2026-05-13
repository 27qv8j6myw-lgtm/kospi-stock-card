import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Activity,
  Award,
  BarChart3,
  Building2,
  Flag,
  Layers,
  Loader2,
  Target,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { apiUrl } from '@/lib/apiBase'
import { formatSignedPct } from '@/lib/utils/format'

export type StockCompareData = {
  code: string
  name: string
  sector?: string
  currentPrice: number
  changePct: number
  totalScore: number
  entryStage: string
  expected1MPct: number
  subScores: {
    structure: number
    execution: number
    rsi: number
    atrGap: number
    market?: number
    supplyDemand?: number
  }
  supplyDemand3D: { foreign: number; institution: number }
  per: number
  fiveYearAvgPer?: number
  operatingMargin: number
  consensusUpside: number
}

type Props = { stockCodes: string[] }

function formatAmount(v: number): string {
  if (!Number.isFinite(v)) return '—'
  const abs = Math.abs(v)
  if (abs >= 1e12) return `${(v / 1e12).toFixed(1)}조`
  if (abs >= 1e8) return `${Math.round(v / 1e8)}억`
  return v.toLocaleString('ko-KR')
}

function koreanSignedClass(v: number): string {
  if (v > 0) return 'text-price-up'
  if (v < 0) return 'text-price-down'
  return 'text-primary'
}

function entryStageClass(stage: string): string {
  const s = stage.trim()
  if (s.includes('적극 매수')) return 'text-emerald-700'
  if (s.includes('신규 매수') || s.includes('분할 매수')) return 'text-blue-700'
  if (s.includes('관망') || s.includes('과열')) return 'text-amber-800'
  if (s.includes('회피')) return 'text-rose-700'
  return 'text-primary'
}

type MetricItemProps = {
  icon: ReactNode
  label: string
  value: string
  valueClassName?: string
  isBest?: boolean
  emphasize?: boolean
  small?: boolean
}

function MetricItem({ icon, label, value, valueClassName = 'text-primary', isBest, emphasize, small }: MetricItemProps) {
  const size = small ? 'text-[12px]' : 'text-sm'
  const valWt = emphasize ? 'text-base font-bold' : 'font-semibold'
  return (
    <div className={`flex items-start gap-2 rounded-lg border border-default/80 bg-app/60 px-2.5 py-2 ${size}`}>
      <span className="mt-0.5 shrink-0 text-secondary [&>svg]:size-4">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-secondary">{label}</p>
        <p className={`mt-0.5 break-words font-sans-en tabular-nums ${valWt} ${valueClassName}`}>
          {value}
          {isBest ? (
            <span className="ml-0.5 text-amber-500" aria-label="최고">
              ★
            </span>
          ) : null}
        </p>
      </div>
    </div>
  )
}

function StockCompareCard({
  stock,
  best,
  multi,
}: {
  stock: StockCompareData
  best: Record<string, number | null>
  multi: boolean
}) {
  const sub = stock.subScores
  const isBest = (key: string, v: number, mode: 'max' | 'min' = 'max') => {
    if (!multi) return false
    const t = best[key]
    if (t == null || !Number.isFinite(v)) return false
    return mode === 'max' ? v === t : v === t
  }

  return (
    <article className="flex min-w-0 flex-col rounded-2xl border border-default bg-card p-4 shadow-sm">
      <header className="border-b border-default pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold text-primary">{stock.name}</h3>
            {stock.sector ? <p className="mt-0.5 text-[11px] text-secondary">{stock.sector}</p> : null}
          </div>
          <span className="font-sans-en text-xs tabular-nums text-secondary">{stock.code}</span>
        </div>
        <p className="mt-2 font-sans-en text-lg font-bold tabular-nums text-primary">
          {stock.currentPrice.toLocaleString('ko-KR')}원
          <span className={`ml-2 text-sm font-semibold ${koreanSignedClass(stock.changePct)}`}>
            {formatSignedPct(stock.changePct, 2)}
          </span>
        </p>
      </header>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <MetricItem
          icon={<Award aria-hidden />}
          label="종합점수"
          value={`${stock.totalScore}점`}
          isBest={isBest('totalScore', stock.totalScore)}
          emphasize
        />
        <MetricItem
          icon={<Target aria-hidden />}
          label="진입판단"
          value={stock.entryStage}
          valueClassName={entryStageClass(stock.entryStage)}
        />
        <MetricItem
          icon={<TrendingUp aria-hidden />}
          label="1M 기대수익"
          value={formatSignedPct(stock.expected1MPct, 0)}
          valueClassName="text-price-up"
          isBest={isBest('expected1MPct', stock.expected1MPct)}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <MetricItem
          icon={<Layers aria-hidden />}
          label="구조"
          value={String(Math.round(sub.structure))}
          isBest={isBest('structure', sub.structure)}
          small
        />
        <MetricItem
          icon={<Activity aria-hidden />}
          label="실행"
          value={String(Math.round(sub.execution))}
          isBest={isBest('execution', sub.execution)}
          small
        />
        <MetricItem
          icon={<BarChart3 aria-hidden />}
          label="RSI"
          value={Number.isFinite(sub.rsi) ? Number(sub.rsi).toFixed(0) : '—'}
          small
        />
        <MetricItem
          icon={<Zap aria-hidden />}
          label="ATR 이격"
          value={Number.isFinite(sub.atrGap) ? `${sub.atrGap.toFixed(1)}%` : '—'}
          isBest={isBest('atrGap', sub.atrGap, 'min')}
          small
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <MetricItem
          icon={<Users aria-hidden />}
          label="외국인 3D"
          value={formatAmount(stock.supplyDemand3D.foreign)}
          valueClassName={koreanSignedClass(stock.supplyDemand3D.foreign)}
          isBest={isBest('foreign', stock.supplyDemand3D.foreign)}
          small
        />
        <MetricItem
          icon={<Building2 aria-hidden />}
          label="기관 3D"
          value={formatAmount(stock.supplyDemand3D.institution)}
          valueClassName={koreanSignedClass(stock.supplyDemand3D.institution)}
          isBest={isBest('institution', stock.supplyDemand3D.institution)}
          small
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <MetricItem
          icon={<BarChart3 aria-hidden />}
          label="PER"
          value={stock.per > 0 ? `${stock.per.toFixed(1)}x` : '—'}
          isBest={isBest('per', stock.per, 'min')}
          small
        />
        <MetricItem
          icon={<Flag aria-hidden />}
          label="영업이익률"
          value={`${stock.operatingMargin.toFixed(1)}%`}
          isBest={isBest('operatingMargin', stock.operatingMargin)}
          small
        />
        <MetricItem
          icon={<TrendingUp aria-hidden />}
          label="컨센 여력"
          value={
            stock.consensusUpside === 0
              ? '—'
              : `${stock.consensusUpside > 0 ? '+' : ''}${stock.consensusUpside.toFixed(0)}%`
          }
          valueClassName={stock.consensusUpside === 0 ? 'text-primary' : koreanSignedClass(stock.consensusUpside)}
          isBest={isBest('consensusUpside', stock.consensusUpside)}
          small
        />
      </div>
    </article>
  )
}

function CompareCardSlot({
  code,
  row,
  emsg,
  best,
  multi,
}: {
  code: string
  row: StockCompareData | null
  emsg?: string
  best: Record<string, number | null>
  multi: boolean
}) {
  if (!row) {
    return (
      <div
        className="flex min-h-[10rem] min-w-0 flex-col items-center justify-center rounded-2xl border border-dashed border-default bg-app/40 p-4 text-center text-sm text-secondary"
      >
        <span className="font-mono tabular-nums">{code}</span>
        {emsg ? <span className="mt-2 text-xs text-rose-700">{emsg}</span> : <span className="mt-2 text-xs">…</span>}
      </div>
    )
  }
  return <StockCompareCard stock={row} best={best} multi={multi} />
}

export function CompareCardGrid({ stockCodes }: Props) {
  const [byCode, setByCode] = useState<Record<string, StockCompareData | null>>({})
  const [errorsByCode, setErrorsByCode] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [snapIdx, setSnapIdx] = useState(0)
  const key = stockCodes.join(',')

  useEffect(() => {
    if (stockCodes.length === 0) {
      setByCode({})
      setErrorsByCode({})
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      const next: Record<string, StockCompareData | null> = {}
      const err: Record<string, string> = {}
      await Promise.all(
        stockCodes.map(async (code) => {
          try {
            const res = await fetch(apiUrl(`/api/compare-stock?code=${encodeURIComponent(code)}`))
            const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
            if (!res.ok) {
              err[code] = typeof json.error === 'string' ? json.error : `HTTP ${res.status}`
              next[code] = null
              return
            }
            next[code] = json as StockCompareData
          } catch (e) {
            err[code] = e instanceof Error ? e.message : '요청 실패'
            next[code] = null
          }
        }),
      )
      if (cancelled) return
      setByCode(next)
      setErrorsByCode(err)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [key, stockCodes])

  const stocks = stockCodes.map((c) => byCode[c]).filter((x): x is StockCompareData => Boolean(x))
  const multi = stocks.length >= 2

  const best: Record<string, number | null> = {
    totalScore: null,
    expected1MPct: null,
    structure: null,
    execution: null,
    atrGap: null,
    foreign: null,
    institution: null,
    per: null,
    operatingMargin: null,
    consensusUpside: null,
  }

  if (multi && stocks.length) {
    best.totalScore = Math.max(...stocks.map((s) => s.totalScore))
    best.expected1MPct = Math.max(...stocks.map((s) => s.expected1MPct))
    best.structure = Math.max(...stocks.map((s) => s.subScores.structure))
    best.execution = Math.max(...stocks.map((s) => s.subScores.execution))
    best.atrGap = Math.min(...stocks.map((s) => s.subScores.atrGap))
    best.foreign = Math.max(...stocks.map((s) => s.supplyDemand3D.foreign))
    best.institution = Math.max(...stocks.map((s) => s.supplyDemand3D.institution))
    const pers = stocks.map((s) => s.per).filter((p) => p > 0)
    best.per = pers.length ? Math.min(...pers) : null
    best.operatingMargin = Math.max(...stocks.map((s) => s.operatingMargin))
    const cu = stocks.map((s) => s.consensusUpside).filter((x) => x !== 0 && Number.isFinite(x))
    best.consensusUpside = cu.length ? Math.max(...cu) : null
  }

  if (loading && stocks.length === 0) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center rounded-2xl border border-default bg-card/60">
        <Loader2 className="size-8 animate-spin text-secondary" aria-hidden />
        <span className="sr-only">불러오는 중</span>
      </div>
    )
  }

  const anyErr = stockCodes.some((c) => errorsByCode[c])

  const onCarouselScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el || stockCodes.length === 0) return
    const first = el.querySelector<HTMLElement>('[data-compare-snap-card]')
    if (!first) return
    const gap = 12
    const step = first.offsetWidth + gap
    if (step <= 0) return
    const idx = Math.round(el.scrollLeft / step)
    const next = Math.min(stockCodes.length - 1, Math.max(0, idx))
    setSnapIdx((prev) => (prev === next ? prev : next))
  }, [stockCodes.length])

  useEffect(() => {
    onCarouselScroll()
  }, [key, stockCodes, onCarouselScroll])

  return (
    <div className="space-y-3">
      {anyErr ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          일부 종목을 불러오지 못했습니다. API·KIS 설정을 확인해 주세요.
        </p>
      ) : null}

      <div className="lg:hidden">
        <div
          ref={scrollRef}
          onScroll={onCarouselScroll}
          className="scrollbar-none -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2"
          style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
        >
          {stockCodes.map((code) => (
            <div
              key={code}
              data-compare-snap-card
              className="w-[85vw] max-w-md shrink-0 snap-center snap-always"
            >
              <CompareCardSlot code={code} row={byCode[code]} emsg={errorsByCode[code]} best={best} multi={multi} />
            </div>
          ))}
        </div>
        {stockCodes.length > 1 ? (
          <p className="mt-1 text-center text-xs text-secondary">좌우로 스와이프 · {stockCodes.length}개 종목</p>
        ) : null}
        {stockCodes.length > 1 ? (
          <div className="mt-2 flex justify-center gap-1.5" aria-hidden>
            {stockCodes.map((_, i) => (
              <span
                key={i}
                className={`size-1.5 rounded-full ${i === snapIdx ? 'bg-primary' : 'bg-secondary/40'}`}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="hidden min-w-0 gap-4 lg:grid lg:grid-cols-2 xl:grid-cols-3">
        {stockCodes.map((code) => (
          <CompareCardSlot key={code} code={code} row={byCode[code]} emsg={errorsByCode[code]} best={best} multi={multi} />
        ))}
      </div>
    </div>
  )
}
