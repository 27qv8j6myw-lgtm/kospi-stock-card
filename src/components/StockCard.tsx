import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type ElementType,
  type ReactNode,
} from 'react'
import { useKisQuote } from '../hooks/useKisQuote'
import { useKisChart, type Timeframe } from '../hooks/useKisChart'
import { useKisLogicIndicators } from '../hooks/useKisLogicIndicators'
import {
  executionUiFromAiLoose,
  marketScoreFromLogicIndicators,
} from '../lib/signalLogic'
import { ChartMountShell } from './chart/ChartMountShell'
import { UnifiedEntryStageCard } from './ExecutionStageCard'
import { StockNameSearch } from './StockNameSearch'
import {
  Activity,
  BarChart3,
  Building2,
  CalendarDays,
  CandlestickChart,
  FileSpreadsheet,
  Globe2,
  Info,
  Layers,
  LineChart,
  PieChart,
  Percent,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Waves,
  Zap,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { UnifiedEntryStageTier } from '../types/stock'

const TIMEFRAMES: Timeframe[] = ['5D', '1M', '3M', '1Y']

/** 레퍼런스: 라운드 화이트 카드, 얇은 보더 */
const cardShell =
  'rounded-xl border border-default/95 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.05)]'
const tileCard =
  'rounded-lg border border-default/90 bg-card'

function digitsOnly(s: string) {
  return s.replace(/\D/g, '').slice(0, 6)
}

function toPaddedCode(s: string) {
  const d = digitsOnly(s)
  if (!d.length) return ''
  return d.padStart(6, '0')
}

/** "005930", "삼성전자 (005930)" 등 6자리 종목코드 덩어리만 인식 (더 긴 숫자열 안의 부분 문자열은 제외) */
function extractIsolatedSixDigitCode(s: string): string | null {
  const m = s.match(/(?<!\d)(\d{6})(?!\d)/)
  return m ? m[1] : null
}

/** KIS 일봉 ts(YYYYMMDD)와 맞추기 위해 달력 기준일 */
function koreaYmd(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(d)
    .replace(/\D/g, '')
}

function formatKrw(n: number) {
  return (
    '₩' +
    n.toLocaleString('ko-KR', {
      maximumFractionDigits: 0,
    })
  )
}

function changeStyle(change: number, changePercent: number) {
  if (change === 0 && changePercent === 0) {
    return {
      arrow: '—',
      line: `0 (0.00%)`,
      className: 'text-tertiary',
    }
  }
  const up = change > 0 || (change === 0 && changePercent > 0)
  const arrow = up ? '▲' : '▼'
  const sign = change > 0 ? '+' : change < 0 ? '' : changePercent > 0 ? '+' : ''
  const absCh = Math.abs(change)
  const absPct = Math.abs(changePercent)
  const line = `${sign}${absCh.toLocaleString('ko-KR')} (${sign}${absPct.toFixed(2)}%)`
  return {
    arrow,
    line,
    className: up ? 'text-price-up' : 'text-price-down',
  }
}

function extractRsi(s?: string) {
  if (!s) return null
  const m = s.match(/RSI\s*[:：]?\s*([\d.]+)/i)
  return m ? m[1] : null
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[15px] font-bold tracking-tight text-primary">{children}</h3>
  )
}

function heroTierBadgeClass(tier: UnifiedEntryStageTier): string {
  switch (tier) {
    case 'NEW_ENTRY':
      return 'border-emerald-300 bg-emerald-50 text-emerald-900'
    case 'SCALE_IN':
      return 'border-teal-300 bg-teal-50 text-teal-900'
    case 'HOLD_STEADY':
      return 'border-default bg-neutral-bg text-primary'
    case 'SCALE_OUT':
      return 'border-amber-300 bg-amber-50 text-amber-900'
    default:
      return 'border-red-300 bg-card text-red-600'
  }
}

function MetricTile({
  icon: Icon,
  label,
  iconClassName = 'text-blue-600',
  children,
}: {
  icon: ElementType
  label: string
  iconClassName?: string
  children: ReactNode
}) {
  return (
    <div
      className={`flex min-h-[5.25rem] flex-col justify-between p-3 sm:min-h-[5.5rem] sm:p-3.5 ${tileCard}`}
    >
      <div className="flex items-center gap-2">
        <Icon className={`size-4 shrink-0 ${iconClassName}`} strokeWidth={2} />
        <span className="text-[11px] font-medium text-secondary">{label}</span>
      </div>
      <div className="mt-2 text-[13px] font-semibold leading-snug text-primary">
        {children}
      </div>
    </div>
  )
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value?: unknown }[]
  label?: string | number
}) {
  if (!active || !payload?.length) return null
  const row = payload[0]
  const raw = row?.value
  if (raw === null || raw === undefined) return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  return (
    <div className="rounded-lg border border-default bg-card px-3 py-2 shadow-md">
      <p className="text-[11px] font-medium text-secondary">{String(label)}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums tracking-tight text-primary">
        {formatKrw(n)}
      </p>
    </div>
  )
}

export type StockCardProps = {
  stockCode?: string
  stockName?: string
}

type AIFillTarget = {
  horizon: string
  sub?: string
  price: number
  pct: number
  rate: number
  n: number
}

type AIFinalOpinion = {
  finalGrade?: string
  strategy?: 'BUY' | 'WATCH' | string
  entryStage?: '신규진입' | '보유' | '관망' | '익절' | string
  keyReasons?: string[]
  risks?: string[]
}

type AIExecutionSignals = {
  decision?: '신규진입' | '보유' | '관망' | '익절' | string
  upsideScore?: number
  targetReturnPct?: number
  stopLossPct?: number
}

type AIFillData = {
  summaryTitle?: string
  summaryBody?: string
  finalGrade?: string
  strategy?: string
  entryStage?: string
  reason?: string
  finalOpinion?: AIFinalOpinion
  executionSignals?: AIExecutionSignals
  executionPlan?: string
  logicIndicators?: AILogicIndicators
  executionStrategy?: AIExecutionStrategy
  targets?: AIFillTarget[]
}

type AILogicIndicators = {
  structure?: string
  execution?: string
  market?: string
  flow?: string
  technical?: string
  stats?: string
  rsi?: string
  volume?: string
  volatility?: string
  foreign?: string
  institution?: string
  momentum?: string
  candle?: string
}

type AIExecutionStrategy = {
  positionSize?: { percent?: number; amountKrw?: number; note?: string }
  oneRLossKrw?: number
  oneRLossNote?: string
  basePlan?: string
  maxPositionPercent?: number
  maxPositionNote?: string
}

export function StockCard({
  stockCode = '005930',
  stockName = '삼성전자',
}: StockCardProps) {
  const chartGradId = useId().replace(/:/g, '')
  const normalizedInitial = useMemo(
    () => toPaddedCode(stockCode) || '005930',
    [stockCode],
  )
  const [queryCode, setQueryCode] = useState(normalizedInitial)
  const [searchDisplay, setSearchDisplay] = useState(
    () => `${stockName} (${normalizedInitial})`,
  )
  const [pickedName, setPickedName] = useState<string | null>(null)

  const [tf, setTf] = useState<Timeframe>('5D')
  const { state: quoteState } = useKisQuote(queryCode)
  const { state: logicState } = useKisLogicIndicators(queryCode)

  const [aiFill, setAiFill] = useState<AIFillData | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  const runAIFill = useCallback(async (code: string) => {
    const c = toPaddedCode(code)
    if (c.length !== 6) return
    setAiLoading(true)
    setAiError(null)
    try {
      const res = await fetch(`/api/ai-fill?code=${encodeURIComponent(c)}`)
      const json = await res.json()
      if (!res.ok) {
        const base = json?.error || `HTTP ${res.status}`
        const hint =
          typeof json?.hint === 'string' && json.hint.trim()
            ? ` ${json.hint.trim()}`
            : ''
        throw new Error(base + hint)
      }
      setAiFill((json?.ai || null) as AIFillData | null)
    } catch (e) {
      setAiError(e instanceof Error ? e.message : String(e))
    } finally {
      setAiLoading(false)
    }
  }, [])

  /** 검색창에 6자리 코드가 들어오면 목록 클릭 없이도 종목 전환 */
  useEffect(() => {
    const isolated = extractIsolatedSixDigitCode(searchDisplay)
    if (!isolated) return
    const next = toPaddedCode(isolated)
    if (next.length !== 6 || next === queryCode) return
    const t = setTimeout(() => {
      setPickedName(null)
      setQueryCode(next)
    }, 300)
    return () => clearTimeout(t)
  }, [searchDisplay, queryCode])

  useEffect(() => {
    const c = toPaddedCode(queryCode)
    if (c.length !== 6) return
    const t = setTimeout(() => {
      void runAIFill(c)
    }, 280)
    return () => clearTimeout(t)
  }, [queryCode, runAIFill])

  const basePrice =
    quoteState.status === 'ok' ? quoteState.data.price : 71_200
  const { chartState } = useKisChart(queryCode, tf)
  const chartSeriesData = useMemo(() => {
    const base =
      chartState.status === 'ok' && chartState.mode === 'daily' && chartState.points.length
        ? chartState.points
        : null

    if (!base) {
      return [{ label: '—', price: Math.round(basePrice), ts: '' }]
    }

    const last = base[base.length - 1]
    const today = koreaYmd()
    if (!last?.ts || String(last.ts).length !== 8) {
      return base
    }
    if (String(last.ts) >= today) return base

    const extendPrice =
      quoteState.status === 'ok'
        ? Math.round(quoteState.data.price)
        : last.price != null && Number.isFinite(Number(last.price))
          ? Math.round(Number(last.price))
          : Math.round(basePrice)

    const label = `${today.slice(4, 6)}.${today.slice(6, 8)}`
    return [...base, { label, price: extendPrice, ts: today }]
  }, [tf, chartState, quoteState, basePrice])

  const displayName =
    quoteState.status === 'ok' && quoteState.data.nameKr
      ? quoteState.data.nameKr
      : pickedName ??
        (queryCode === normalizedInitial ? stockName : `종목 ${queryCode}`)
  const avatarChar = [...displayName][0] ?? '?'
  const [logoFailed, setLogoFailed] = useState(false)
  const logoSrc = `/logos/${queryCode}.png`

  useEffect(() => {
    setLogoFailed(false)
  }, [queryCode])

  const marketLabel =
    quoteState.status === 'ok' && quoteState.data.market
      ? quoteState.data.market.includes('코스피')
        ? 'KOSPI'
        : quoteState.data.market
      : 'KOSPI'

  const ch =
    quoteState.status === 'ok'
      ? changeStyle(quoteState.data.change, quoteState.data.changePercent)
      : changeStyle(-1240, -1.71)

  const targets: AIFillTarget[] =
    aiFill?.targets && aiFill.targets.length >= 4
      ? aiFill.targets
      : [
          { horizon: '1D', sub: '', price: 72_450, pct: 1.2, rate: 42, n: 128 },
          { horizon: '7D', sub: '', price: 73_800, pct: 3.6, rate: 38, n: 96 },
          {
            horizon: '1M',
            sub: '(21D)',
            price: 76_100,
            pct: 6.9,
            rate: 31,
            n: 64,
          },
          {
            horizon: '3M',
            sub: '(63D)',
            price: 79_400,
            pct: 11.5,
            rate: 24,
            n: 48,
          },
        ]

  const logic = logicState.status === 'ok' ? logicState.data : undefined
  const exec = aiFill?.executionStrategy
  const finalOpinion = aiFill?.finalOpinion
  const executionSignals = aiFill?.executionSignals

  const opinionStrategy =
    finalOpinion?.strategy || aiFill?.strategy || 'WATCH_ONLY'
  const opinionEntryStage =
    finalOpinion?.entryStage || aiFill?.entryStage || 'REJECT'
  const executionUiDemo = executionUiFromAiLoose(opinionStrategy, opinionEntryStage)

  const keyReasons =
    finalOpinion?.keyReasons?.slice(0, 3) || [
      aiFill?.reason ||
        '일부 점수는 유지되나 진입 근거는 아직 부족합니다.',
    ]

  const rsiText =
    logic?.rsi ??
    extractRsi(logic?.technical) ??
    (logic?.technical?.includes('RSI') ? logic.technical : '83')
  const volumeText =
    logic?.volume ??
    (logic?.stats && /거래|평균|x/i.test(logic.stats)
      ? logic.stats
      : '20일 평균 대비 1.42x')
  const foreignText =
    logic?.foreign ??
    (logic?.flow?.includes('외국인') ? logic.flow : '외국인 4일 연속 순매수')
  const instText =
    logic?.institution ??
    (logic?.flow?.includes('기관') ? logic.flow : '기관 2일 연속 순매도')
  const volatilityText = logic?.volatility || 'IV 밴드 수축 — 저변동 구간'
  const momentumText = logic?.momentum || '단기 모멘텀 0.62σ'
  const candleText = logic?.candle || '상승 장악형 · 저점 상향'

  const positionPct = Number.isFinite(exec?.positionSize?.percent)
    ? Math.round(Number(exec?.positionSize?.percent))
    : 14
  const maxPct = Number.isFinite(exec?.maxPositionPercent)
    ? Math.round(Number(exec?.maxPositionPercent))
    : 15
  const targetReturnPct = Number.isFinite(executionSignals?.targetReturnPct)
    ? Number(executionSignals?.targetReturnPct)
    : 10
  const stopLossPct = Number.isFinite(executionSignals?.stopLossPct)
    ? Math.abs(Number(executionSignals?.stopLossPct))
    : 4

  const stopPrice =
    quoteState.status === 'ok'
      ? Math.round(quoteState.data.price * (1 - stopLossPct / 100))
      : 69_600

  const supportPrice =
    quoteState.status === 'ok'
      ? Math.round(quoteState.data.price * 0.876)
      : 62_400

  const headerDateLabel = (() => {
    if (quoteState.status === 'ok') {
      const d = new Date(quoteState.data.fetchedAt)
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} 기준`
    }
    const d = new Date()
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} 기준`
  })()

  const lastChartPointIndex = useMemo(() => {
    for (let i = chartSeriesData.length - 1; i >= 0; i--) {
      const p = chartSeriesData[i]?.price
      if (p !== null && p !== undefined && Number.isFinite(Number(p))) return i
    }
    return -1
  }, [chartSeriesData])

  const oneRLossRaw = Number.isFinite(exec?.oneRLossKrw)
    ? Number(exec?.oneRLossKrw)
    : -31_000
  const oneRLossDisplay = `−${formatKrw(Math.abs(oneRLossRaw))}`

  const defaultExecHint = `목표 +${targetReturnPct}% · 시간 손절 5영업일 · 손절 -${stopLossPct}% · 분할 익절`

  const logicTiles = useMemo(
    () => [
      {
        label: '구조',
        icon: Layers,
        iconClass: 'text-blue-600',
        value: logic?.structure || '75 / 100',
      },
      {
        label: '실행',
        icon: Zap,
        iconClass: 'text-violet-600',
        value: logic?.execution || '11 / 100',
      },
      {
        label: '시장',
        icon: Target,
        iconClass:
          marketScoreFromLogicIndicators(logic) <= 44 ||
          Boolean(logic?.market?.includes('Caution')) ||
          Boolean(logic?.market?.includes('주의'))
            ? 'text-amber-500'
            : 'text-emerald-600',
        value: logic?.marketHeadline || logic?.market || '데이터 없음',
      },
      {
        label: '수급',
        icon: Waves,
        iconClass: 'text-sky-600',
        value: logic?.flow || '에너지 중립 (관망) | 체결강도 0.98x',
      },
      {
        label: 'RSI',
        icon: Activity,
        iconClass: 'text-emerald-600',
        value: rsiText.startsWith('RSI') ? rsiText : `RSI ${rsiText}`,
      },
      {
        label: '거래량',
        icon: BarChart3,
        iconClass: 'text-indigo-600',
        value: volumeText,
      },
      {
        label: '변동성',
        icon: LineChart,
        iconClass: 'text-orange-500',
        value: volatilityText,
      },
      {
        label: '외국인',
        icon: Globe2,
        iconClass: 'text-cyan-600',
        value: foreignText,
      },
      {
        label: '기관',
        icon: Building2,
        iconClass: 'text-teal-600',
        value: instText,
      },
      {
        label: '모멘텀',
        icon: TrendingUp,
        iconClass: 'text-rose-500',
        value: momentumText,
      },
      {
        label: '캔들',
        icon: CandlestickChart,
        iconClass: 'text-blue-700',
        value: candleText,
      },
      {
        label: '통계',
        icon: Percent,
        iconClass: 'text-secondary',
        value:
          logic?.stats || '유사 패턴 승률 68.4%, 참고 수익률 +2.9%',
      },
    ],
    [
      logic,
      rsiText,
      volumeText,
      foreignText,
      instText,
      volatilityText,
      momentumText,
      candleText,
    ],
  )

  const codeDisplay =
    quoteState.status === 'ok' ? quoteState.data.code : queryCode

  return (
    <article className={`relative min-w-0 max-w-full overflow-x-hidden ${cardShell}`}>
      <header className="flex items-start justify-between gap-4 border-b border-light px-6 py-4 sm:px-8">
        <h1 className="text-lg font-bold text-primary sm:text-xl">종목 카드</h1>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => void runAIFill(queryCode)}
            disabled={aiLoading}
            className="rounded-lg border border-default bg-card p-1.5 text-secondary hover:bg-neutral-bg disabled:opacity-50"
            title="AI 분석"
          >
            <Sparkles className="size-4" strokeWidth={2} />
          </button>
          <p className="text-sm text-tertiary">{headerDateLabel}</p>
        </div>
      </header>

      <div className="border-b border-light bg-card px-6 py-3 sm:px-8">
        <StockNameSearch
          compact
          value={searchDisplay}
          onChange={setSearchDisplay}
          onPick={(code, nameKr) => {
            setQueryCode(code)
            setPickedName(nameKr)
            setSearchDisplay(`${nameKr} (${code})`)
          }}
        />
      </div>

      <section className="border-b border-light px-6 py-5 sm:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-4">
            {!logoFailed ? (
              <img
                src={logoSrc}
                alt=""
                className="size-[52px] shrink-0 rounded-full border border-default bg-card object-contain p-1.5"
                loading="lazy"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <div
                className="flex size-[52px] shrink-0 items-center justify-center rounded-full border border-default bg-neutral-bg text-base font-bold text-secondary"
                aria-hidden
              >
                {avatarChar}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-mono text-lg font-bold tabular-nums tracking-tight text-primary">
                {codeDisplay}
              </p>
              <p className="mt-0.5 text-sm font-medium text-secondary">
                {displayName}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-md border border-default bg-neutral-bg px-2 py-0.5 text-[11px] font-medium text-secondary">
                  {marketLabel}
                </span>
                <span className="rounded-md border border-default bg-neutral-bg px-2 py-0.5 text-[11px] font-medium text-secondary">
                  국내주식
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1 sm:items-end">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 sm:justify-end">
              <p className="text-2xl font-bold tabular-nums tracking-tight text-primary sm:text-3xl">
                {quoteState.status === 'ok'
                  ? formatKrw(quoteState.data.price)
                  : quoteState.status === 'loading'
                    ? '···'
                    : formatKrw(basePrice)}
              </p>
              <span
                className={`rounded-md border px-2.5 py-0.5 text-xs font-bold ${heroTierBadgeClass(executionUiDemo.tier)}`}
              >
                {executionUiDemo.entryStageLabel}
              </span>
            </div>
            <p className={`text-sm font-semibold tabular-nums sm:text-right ${ch.className}`}>
              <span className="mr-1">{ch.arrow}</span>
              {ch.line}
            </p>
          </div>
        </div>
        {quoteState.status === 'error' ? (
          <p
            className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            role="alert"
          >
            시세를 가져오지 못했습니다: {quoteState.message}
          </p>
        ) : null}
        {aiError ? (
          <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            AI 오류: {aiError}
          </p>
        ) : null}
      </section>

      <div className="grid grid-cols-1 items-stretch md:grid-cols-2 md:divide-x md:divide-light">
        <section className="min-h-[280px] min-w-0 p-6 sm:p-8">
          <SectionTitle>한눈에 보기</SectionTitle>
          <p className="mt-3 text-[17px] font-bold leading-snug text-primary sm:text-lg">
            {aiFill?.summaryTitle || '지금은 보류가 더 좋은 구간'}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-secondary">
            {aiFill?.summaryBody ||
              '일부 점수는 유지되나 진입 근거는 아직 부족'}
          </p>
          <ul className="mt-6 space-y-4 border-t border-light pt-6">
            <li className="flex items-center gap-2 text-sm">
              <Activity className="size-4 shrink-0 text-blue-600" strokeWidth={2} />
              <span className="text-secondary">전략</span>
              <span className="ml-auto font-semibold text-blue-800">{executionUiDemo.strategyLabelKo}</span>
            </li>
            <li className="flex flex-col gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Target className="size-4 shrink-0 text-rose-500" strokeWidth={2} />
                <span className="text-secondary">진입 단계</span>
              </div>
              <UnifiedEntryStageCard ui={executionUiDemo} />
            </li>
            <li className="flex items-start gap-2 text-sm">
              <Info className="mt-0.5 size-4 shrink-0 text-tertiary" strokeWidth={2} />
              <div className="min-w-0 flex-1">
                <span className="text-secondary">핵심 근거</span>
                <p className="mt-1 font-medium leading-relaxed text-primary">
                  {keyReasons[0]}
                </p>
              </div>
            </li>
          </ul>
        </section>

        <section className="flex min-h-[280px] min-w-0 flex-col p-6 sm:min-h-[300px] sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <div className="flex w-full gap-1 sm:w-auto sm:justify-end">
              {TIMEFRAMES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTf(t)}
                  className={`min-w-[2.5rem] flex-1 rounded-md border-2 px-2 py-1.5 text-center text-[11px] font-bold sm:min-w-[2.75rem] sm:flex-none ${
                    tf === t
                      ? 'border-blue-500 bg-card text-blue-700 shadow-sm'
                      : 'border-transparent bg-app text-secondary hover:bg-neutral-bg/80'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          {chartState.status === 'error' ? (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              차트: {chartState.message}
            </p>
          ) : null}
          <ChartMountShell height={280} className="mt-3">
            <ResponsiveContainer width="100%" height={280} minHeight={280} minWidth={0}>
                <AreaChart
                  key={tf + queryCode}
                  data={chartSeriesData}
                  margin={{ top: 4, right: 8, left: 8, bottom: 22 }}
                >
                  <defs>
                    <linearGradient id={chartGradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgb(59, 130, 246)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="rgb(59, 130, 246)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="4 8"
                    vertical={false}
                    stroke="rgba(148,163,184,0.35)"
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: '#64748b', dy: 6 }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                    minTickGap={16}
                    tickMargin={14}
                    padding={{ left: 0, right: 0 }}
                  />
                  <YAxis hide width={0} domain={['auto', 'auto'] as const} />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{ stroke: 'rgba(59, 130, 246, 0.35)', strokeWidth: 1 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke="#2563eb"
                    strokeWidth={2}
                    fill={`url(#${chartGradId})`}
                    connectNulls
                    isAnimationActive
                    animationDuration={900}
                    animationEasing="ease-out"
                    dot={(props: {
                      cx?: number
                      cy?: number
                      index?: number
                    }) => {
                      const { cx, cy, index } = props
                      if (
                        index !== lastChartPointIndex ||
                        lastChartPointIndex < 0 ||
                        cx == null ||
                        cy == null
                      )
                        return null
                      return (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={4}
                          fill="#2563eb"
                          stroke="#fff"
                          strokeWidth={2}
                        />
                      )
                    }}
                    activeDot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
          </ChartMountShell>
        </section>
      </div>

      <section className="border-t border-light px-6 py-6 sm:px-8">
        <SectionTitle>로직 지표</SectionTitle>
        {logicState.status === 'error' ? (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            로직 지표: {logicState.message}
          </p>
        ) : null}
        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
          {logicTiles.map((tile) => (
            <MetricTile
              key={tile.label}
              icon={tile.icon}
              label={tile.label}
              iconClassName={tile.iconClass}
            >
              {tile.value}
            </MetricTile>
          ))}
        </div>
      </section>

      <section className="border-t border-light px-6 py-6 sm:px-8">
        <SectionTitle>실행 전략</SectionTitle>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: '추천 비중',
              value: `${positionPct}%`,
              hint:
                exec?.positionSize?.note ||
                `약 ${formatKrw(exec?.positionSize?.amountKrw ?? 1_020_000)} 기준`,
              icon: PieChart,
              iconClass: 'text-blue-600',
            },
            {
              title: '1R 손실',
              value: oneRLossDisplay,
              hint: exec?.oneRLossNote || '계좌·종목 변동성에 따른 1R 추정',
              icon: TrendingDown,
              iconClass: 'text-red-500',
            },
            {
              title: '기본 실행',
              value: '—',
              hint: exec?.basePlan || aiFill?.executionPlan || defaultExecHint,
              icon: CalendarDays,
              iconClass: 'text-secondary',
            },
            {
              title: '최대 비중',
              value: `${maxPct}%`,
              hint: exec?.maxPositionNote || '포트폴리오 상한',
              icon: TrendingUp,
              iconClass: 'text-emerald-600',
            },
          ].map((row) => {
            const ExecIcon = row.icon
            return (
              <div key={row.title} className={`flex min-h-[7.5rem] flex-col p-4 ${tileCard}`}>
                <div className="flex items-center gap-2">
                  <ExecIcon className={`size-4 shrink-0 ${row.iconClass}`} strokeWidth={2} />
                  <span className="text-xs font-medium text-secondary">{row.title}</span>
                </div>
                <p className="mt-3 text-xl font-bold tabular-nums text-primary">{row.value}</p>
                <p className="mt-2 text-xs leading-relaxed text-secondary">{row.hint}</p>
              </div>
            )
          })}
        </div>
      </section>

      <section className="border-t border-light px-6 py-6 sm:px-8">
        <SectionTitle>목표가</SectionTitle>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {targets.map((row) => (
            <div key={row.horizon + (row.sub ?? '')} className={`flex flex-col p-4 ${tileCard}`}>
              <p className="text-xs font-semibold text-secondary">
                {row.horizon}
                {row.sub ? (
                  <span className="ml-1 font-normal text-tertiary">{row.sub}</span>
                ) : null}
              </p>
              <p className="mt-2 text-xl font-bold tabular-nums text-emerald-600">
                {formatKrw(row.price)}
              </p>
              <p className="text-sm font-semibold tabular-nums text-emerald-600">+{row.pct}%</p>
              <div className="mt-3 flex items-center justify-between border-t border-light pt-3 text-xs text-secondary">
                <span>달성 확률</span>
                <span className="font-semibold tabular-nums text-primary">{row.rate}%</span>
              </div>
              <p className="mt-1 text-xs text-tertiary">N={row.n}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-lg border border-red-100 bg-red-50/90 px-4 py-3 text-sm text-red-900">
          <span className="font-semibold">손절</span>{' '}
          <span className="tabular-nums font-bold">{formatKrw(stopPrice)}</span>
          <span className="text-red-600"> (−{stopLossPct.toFixed(1)}%)</span>
          <span className="text-secondary"> [지지: {formatKrw(supportPrice)}]</span>
        </div>
      </section>

      <footer className="flex items-center justify-between border-t border-default bg-neutral-bg px-6 py-3 text-[13px] text-secondary sm:px-8">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="size-4 shrink-0 text-tertiary" strokeWidth={2} />
          <span>
            <span className="font-medium text-red-700">투자주의:</span>{' '}
            본 분석은 참고용이며 최종 투자 판단과 책임은 투자자 본인에게 있습니다.
          </span>
        </div>
        <button
          type="button"
          className="rounded-full p-1 text-tertiary hover:bg-neutral-bg/80"
          aria-label="안내"
        >
          <Info className="size-4" strokeWidth={2} />
        </button>
      </footer>
    </article>
  )
}
