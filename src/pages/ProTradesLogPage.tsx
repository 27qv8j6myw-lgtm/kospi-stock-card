'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  ReceiptText,
  RotateCw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAppNavigation } from '@/hooks/useAppNavigation'
import { useResumeAiResult } from '@/hooks/useResumeAiResult'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'
import { PRO_CONTENT_WRAP } from '@/lib/proStockDesign'

type TradeRow = {
  id: string
  code: string
  name?: string | null
  group_id?: string | null
  side: 'buy' | 'sell'
  quantity: number
  price: number
  traded_at: string
  memo?: string | null
  realized_profit?: number | null
  avg_price_at_trade?: number | null
}

type TradeReviewSummary = {
  sellPrice: number
  currentPrice: number | null
  maxPrice: number | null
  changeToCurrentPct: number | null
  changeToMaxPct: number | null
  barsAfter: number
}

type TradeReviewDiagnosis = {
  date: string
  verdict: string | null
  summary: string | null
  diagPrice: number | null
}

type ProGroup = { id: string; name: string }

type HoldingRow = { code: string }

type PeriodKey = 'day' | 'week' | 'month' | 'year'

const PERIOD_META: { key: PeriodKey; label: string; scopeLabel: string }[] = [
  { key: 'day', label: '일', scopeLabel: '오늘' },
  { key: 'week', label: '주', scopeLabel: '이번 주' },
  { key: 'month', label: '월', scopeLabel: '이번 달' },
  { key: 'year', label: '년', scopeLabel: '올해' },
]

type StockGroup = {
  code: string
  name: string
  trades: TradeRow[]
  buyCount: number
  sellCount: number
  realizedSum: number
  held: boolean
  lastTradedAt: string
}

function formatTradeDate(d: string): string {
  if (!d || d.length < 10) return d || '—'
  return `${d.slice(2, 4)}.${d.slice(5, 7)}.${d.slice(8, 10)}`
}

function pnlClass(n: number): string {
  if (n > 0) return 'text-red-600'
  if (n < 0) return 'text-blue-600'
  return 'text-gray-600'
}

function formatSigned(n: number): string {
  return `${n >= 0 ? '+' : ''}${Math.round(n).toLocaleString('ko-KR')}원`
}

/** 매도 실현 수익률(%) — 매도 시점 평단 기준. 계산 불가 시 null */
function realizedPct(trade: TradeRow): number | null {
  const realized = Number(trade.realized_profit)
  const avgAt = Number(trade.avg_price_at_trade)
  const qty = Number(trade.quantity)
  if (!Number.isFinite(realized) || !Number.isFinite(avgAt) || avgAt <= 0 || qty <= 0) return null
  return (realized / (avgAt * qty)) * 100
}

function normalizeCode6(raw: string): string {
  const digits = String(raw ?? '').replace(/\D/g, '')
  return digits ? digits.padStart(6, '0') : String(raw ?? '')
}

function seoulToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function sumRealized(list: TradeRow[]): number {
  return list.reduce((s, t) => {
    const v = Number(t.realized_profit)
    return s + (Number.isFinite(v) ? v : 0)
  }, 0)
}

function buildStockGroups(list: TradeRow[], heldCodes: Set<string>): StockGroup[] {
  const map = new Map<string, StockGroup>()
  for (const t of list) {
    const code = normalizeCode6(t.code)
    if (!map.has(code)) {
      map.set(code, {
        code,
        name: t.name || code,
        trades: [],
        buyCount: 0,
        sellCount: 0,
        realizedSum: 0,
        held: heldCodes.has(code),
        lastTradedAt: t.traded_at,
      })
    }
    const g = map.get(code)!
    g.trades.push(t)
    if (t.name && (g.name === code || !g.name)) g.name = t.name
    if (t.side === 'buy') g.buyCount += 1
    else g.sellCount += 1
    const realized = Number(t.realized_profit)
    if (Number.isFinite(realized)) g.realizedSum += realized
    if (t.traded_at > g.lastTradedAt) g.lastTradedAt = t.traded_at
  }
  return [...map.values()]
}

type TradeStats = {
  totalRealized: number
  sellCount: number
  winCount: number
  lossCount: number
  winRate: number | null
  avgWin: number | null
  avgLoss: number | null
  payoffRatio: number | null
  avgHoldingDays: number | null
}

type MonthlyPoint = { month: string; realized: number; cumulative: number }

function daysBetween(a: string, b: string): number {
  const t1 = new Date(`${a}T00:00:00Z`).getTime()
  const t2 = new Date(`${b}T00:00:00Z`).getTime()
  if (!Number.isFinite(t1) || !Number.isFinite(t2)) return 0
  return Math.max(0, Math.round((t2 - t1) / 86_400_000))
}

/**
 * 종목별 매수→매도 FIFO 매칭으로 수량 가중 평균 보유기간(일) 계산.
 * 로드된 거래 범위 밖에서 매수된 물량은 매칭되지 않아 제외됩니다.
 */
function computeAvgHoldingDays(list: TradeRow[]): number | null {
  const byCode = new Map<string, TradeRow[]>()
  for (const t of list) {
    const code = normalizeCode6(t.code)
    if (!byCode.has(code)) byCode.set(code, [])
    byCode.get(code)!.push(t)
  }
  let weightedDays = 0
  let matchedQty = 0
  for (const trades of byCode.values()) {
    const ordered = [...trades].sort((a, b) => a.traded_at.localeCompare(b.traded_at))
    /** @type FIFO 매수 로트 큐 */
    const lots: { date: string; qty: number }[] = []
    for (const t of ordered) {
      const qty = Number(t.quantity) || 0
      if (qty <= 0) continue
      if (t.side === 'buy') {
        lots.push({ date: t.traded_at, qty })
      } else {
        let remaining = qty
        while (remaining > 0 && lots.length > 0) {
          const lot = lots[0]
          const used = Math.min(lot.qty, remaining)
          weightedDays += daysBetween(lot.date, t.traded_at) * used
          matchedQty += used
          lot.qty -= used
          remaining -= used
          if (lot.qty <= 0) lots.shift()
        }
      }
    }
  }
  return matchedQty > 0 ? weightedDays / matchedQty : null
}

function computeTradeStats(list: TradeRow[]): TradeStats {
  let totalRealized = 0
  let sellCount = 0
  let winCount = 0
  let lossCount = 0
  let winSum = 0
  let lossSum = 0
  for (const t of list) {
    if (t.side !== 'sell') continue
    const realized = Number(t.realized_profit)
    if (!Number.isFinite(realized)) continue
    sellCount += 1
    totalRealized += realized
    if (realized > 0) {
      winCount += 1
      winSum += realized
    } else if (realized < 0) {
      lossCount += 1
      lossSum += realized
    }
  }
  const avgWin = winCount > 0 ? winSum / winCount : null
  const avgLoss = lossCount > 0 ? lossSum / lossCount : null
  return {
    totalRealized,
    sellCount,
    winCount,
    lossCount,
    winRate: winCount + lossCount > 0 ? (winCount / (winCount + lossCount)) * 100 : null,
    avgWin,
    avgLoss,
    payoffRatio: avgWin != null && avgLoss != null && avgLoss !== 0 ? avgWin / Math.abs(avgLoss) : null,
    avgHoldingDays: computeAvgHoldingDays(list),
  }
}

function buildMonthlySeries(list: TradeRow[]): MonthlyPoint[] {
  const map = new Map<string, number>()
  for (const t of list) {
    if (t.side !== 'sell') continue
    const realized = Number(t.realized_profit)
    if (!Number.isFinite(realized)) continue
    const month = t.traded_at.slice(0, 7)
    if (!month) continue
    map.set(month, (map.get(month) || 0) + realized)
  }
  const months = [...map.keys()].sort()
  let cumulative = 0
  return months.map((month) => {
    cumulative += map.get(month) || 0
    return { month, realized: Math.round(map.get(month) || 0), cumulative: Math.round(cumulative) }
  })
}

export default function ProTradesLogPage() {
  const { navigate } = useAppNavigation()
  const [trades, setTrades] = useState<TradeRow[]>([])
  const [groups, setGroups] = useState<ProGroup[]>([])
  const [heldCodes, setHeldCodes] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tableMissing, setTableMissing] = useState(false)
  const [activePeriod, setActivePeriod] = useState<PeriodKey | null>(null)
  const [monthOffset, setMonthOffset] = useState(0)
  const [yearOffset, setYearOffset] = useState(0)
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string> | null>(null)
  const [showGroupFilter, setShowGroupFilter] = useState(false)
  const knownGroupIdsRef = useRef<Set<string> | null>(null)
  const [insight, setInsight] = useState<string | null>(null)
  const [insightLoading, setInsightLoading] = useState(false)
  const [insightError, setInsightError] = useState<string | null>(null)
  const [insightGeneratedAt, setInsightGeneratedAt] = useState<string | null>(null)
  const [showStats, setShowStats] = useState(false)
  const [reviewTrade, setReviewTrade] = useState<TradeRow | null>(null)
  const [reviewText, setReviewText] = useState<string | null>(null)
  const [reviewSummary, setReviewSummary] = useState<TradeReviewSummary | null>(null)
  const [reviewDiagnoses, setReviewDiagnoses] = useState<TradeReviewDiagnosis[]>([])
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    setError(null)
    try {
      const [tRes, gRes, hRes] = await Promise.all([
        authFetch(apiUrl('/api/pro-trades?limit=500')),
        authFetch(apiUrl('/api/pro-groups')),
        authFetch(apiUrl('/api/pro-holdings')),
      ])

      if (!tRes.ok) {
        const body = (await tRes.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error || tRes.statusText)
      }
      const td = (await tRes.json()) as { trades?: TradeRow[]; tableMissing?: boolean }
      setTrades(td.trades || [])
      setTableMissing(Boolean(td.tableMissing))

      if (gRes.ok) {
        const gd = (await gRes.json()) as { groups?: ProGroup[] }
        setGroups(gd.groups || [])
      }
      if (hRes.ok) {
        const hd = (await hRes.json()) as { holdings?: HoldingRow[] }
        setHeldCodes(new Set((hd.holdings || []).map((h) => normalizeCode6(h.code))))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // 그룹 목록 변동 시 필터 동기화 — 새 그룹만 자동 선택, 해제 상태 유지
  useEffect(() => {
    if (groups.length === 0) return
    const allIds = groups.map((g) => g.id)
    const known = knownGroupIdsRef.current
    knownGroupIdsRef.current = new Set(allIds)
    setSelectedGroupIds((prev) => {
      if (prev === null) return null
      const next = new Set(prev)
      for (const id of allIds) {
        if (!known?.has(id)) next.add(id)
      }
      return next
    })
  }, [groups])

  const handleRefresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      await load({ silent: true })
    } finally {
      setRefreshing(false)
    }
  }

  const deleteTrade = async (id: string) => {
    if (
      !window.confirm(
        '이 거래 기록을 삭제할까요?\n보유 수량·평단·실현손익이 기록 전 상태로 되돌아갑니다.',
      )
    )
      return
    try {
      const r = await authFetch(apiUrl(`/api/pro-trades?id=${encodeURIComponent(id)}`), {
        method: 'DELETE',
      })
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { error?: string }
        window.alert(d.error || '삭제 실패')
        return
      }
      await load({ silent: true })
    } catch {
      window.alert('삭제 요청에 실패했습니다')
    }
  }

  const allGroupsSelected =
    groups.length > 0 &&
    (selectedGroupIds === null ||
      (selectedGroupIds.size >= groups.length && groups.every((g) => selectedGroupIds.has(g.id))))

  const toggleGroup = (id: string) => {
    setSelectedGroupIds((prev) => {
      const base = prev === null ? new Set(groups.map((g) => g.id)) : new Set(prev)
      if (base.has(id)) base.delete(id)
      else base.add(id)
      return base
    })
  }

  const toggleAllGroups = () => {
    if (allGroupsSelected) setSelectedGroupIds(new Set())
    else setSelectedGroupIds(new Set(groups.map((g) => g.id)))
  }

  // 서울 기준 일/주/월/년 범위 (월·년은 offset 으로 과거 선택 가능)
  const ranges = useMemo(() => {
    const today = seoulToday()
    const base = new Date(`${today}T00:00:00Z`)
    const dow = base.getUTCDay()
    const diff = dow === 0 ? 6 : dow - 1
    const monday = new Date(base)
    monday.setUTCDate(base.getUTCDate() - diff)

    const mDate = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + monthOffset, 1))
    const mY = mDate.getUTCFullYear()
    const mM = mDate.getUTCMonth() + 1
    const mStart = `${mY}-${String(mM).padStart(2, '0')}-01`
    const mEnd = new Date(Date.UTC(mY, mM, 0)).toISOString().slice(0, 10)

    const yY = base.getUTCFullYear() + yearOffset

    return {
      day: { start: today, end: today, label: '오늘' },
      week: { start: monday.toISOString().slice(0, 10), end: today, label: '이번 주' },
      month: { start: mStart, end: mEnd, label: `${mY}.${String(mM).padStart(2, '0')}` },
      year: { start: `${yY}-01-01`, end: `${yY}-12-31`, label: `${yY}` },
    } as Record<PeriodKey, { start: string; end: string; label: string }>
  }, [monthOffset, yearOffset])

  // 그룹 필터만 적용한 기준 거래 (기간 패인 합계용)
  const groupFilteredTrades = useMemo(() => {
    if (selectedGroupIds === null || allGroupsSelected) return trades
    return trades.filter((t) => t.group_id && selectedGroupIds.has(t.group_id))
  }, [trades, selectedGroupIds, allGroupsSelected])

  // 매매 통계 — 그룹 필터만 적용(기간 무시, 전체 기간 추이)
  const tradeStats = useMemo(() => computeTradeStats(groupFilteredTrades), [groupFilteredTrades])
  const monthlySeries = useMemo(() => buildMonthlySeries(groupFilteredTrades), [groupFilteredTrades])

  const periodCells = useMemo(() => {
    return PERIOD_META.map((p) => {
      const r = ranges[p.key]
      const inRange = groupFilteredTrades.filter(
        (t) => t.traded_at >= r.start && t.traded_at <= r.end,
      )
      return {
        ...p,
        scopeLabel: r.label,
        sum: sumRealized(inRange),
        count: inRange.length,
      }
    })
  }, [groupFilteredTrades, ranges])

  // 그룹 + 활성 기간까지 적용한 거래 (평탄 목록) → 종목별 그룹핑·일자별 내역의 공통 입력
  const scopeTrades = useMemo(() => {
    const r = activePeriod ? ranges[activePeriod] : null
    return r
      ? groupFilteredTrades.filter((t) => t.traded_at >= r.start && t.traded_at <= r.end)
      : groupFilteredTrades
  }, [groupFilteredTrades, activePeriod, ranges])

  const scopedGroups = useMemo(
    () => buildStockGroups(scopeTrades, heldCodes),
    [scopeTrades, heldCodes],
  )

  const summaryGroups = useMemo(
    () => [...scopedGroups].sort((a, b) => b.realizedSum - a.realizedSum || b.lastTradedAt.localeCompare(a.lastTradedAt)),
    [scopedGroups],
  )

  const scopeTotal = useMemo(
    () => scopedGroups.reduce((s, g) => s + g.realizedSum, 0),
    [scopedGroups],
  )

  // 기간(+그룹) 범위의 총 매수/매도 거래대금 (수량×가격)
  const scopeBuyTotal = useMemo(
    () =>
      scopeTrades
        .filter((t) => t.side === 'buy')
        .reduce((s, t) => s + Number(t.quantity) * Number(t.price), 0),
    [scopeTrades],
  )
  const scopeSellTotal = useMemo(
    () =>
      scopeTrades
        .filter((t) => t.side === 'sell')
        .reduce((s, t) => s + Number(t.quantity) * Number(t.price), 0),
    [scopeTrades],
  )

  // 인사이트 요청 범위 — 현재 화면 거래의 최소·최대 일자 (활성 기간/그룹 반영)
  const scopeRange = useMemo(() => {
    if (scopeTrades.length === 0) return null
    let start = scopeTrades[0].traded_at
    let end = scopeTrades[0].traded_at
    for (const t of scopeTrades) {
      if (t.traded_at < start) start = t.traded_at
      if (t.traded_at > end) end = t.traded_at
    }
    return { start, end }
  }, [scopeTrades])

  const scopeSellCount = useMemo(
    () => scopeTrades.reduce((n, t) => n + (t.side === 'sell' ? 1 : 0), 0),
    [scopeTrades],
  )

  const requestGroupIds = useMemo(
    () =>
      allGroupsSelected || selectedGroupIds === null ? undefined : [...selectedGroupIds],
    [allGroupsSelected, selectedGroupIds],
  )

  /** 복귀 조회 — 서버가 백그라운드로 끝낸 인사이트가 캐시에 있을 때만 반환 (재생성 없음) */
  const fetchCachedInsight = useCallback(async () => {
    if (!scopeRange) return null
    const r = await authFetch(apiUrl('/api/pro-trades-insight'), {
      method: 'POST',
      body: JSON.stringify({
        start: scopeRange.start,
        end: scopeRange.end,
        groupIds: requestGroupIds,
        cachedOnly: true,
      }),
    })
    const d = (await r.json().catch(() => null)) as {
      insight?: string | null
      generatedAt?: string | null
      pending?: boolean
    } | null
    if (!r.ok || !d?.insight) return null
    return d
  }, [scopeRange, requestGroupIds])

  const {
    pending: insightResuming,
    start: markInsightStarted,
    finish: markInsightFinished,
  } = useResumeAiResult<{ insight?: string | null; generatedAt?: string | null }>({
    key: 'trades-insight',
    enabled: Boolean(scopeRange),
    fetchCached: fetchCachedInsight,
    onResolved: (d) => {
      setInsight(d.insight ?? null)
      setInsightGeneratedAt(d.generatedAt ?? null)
      setInsightError(null)
      setInsightLoading(false)
    },
  })

  const generateInsight = useCallback(
    async (force = false) => {
      if (!scopeRange || insightLoading) return
      setInsightLoading(true)
      setInsightError(null)
      markInsightStarted()
      try {
        const r = await authFetch(apiUrl('/api/pro-trades-insight'), {
          method: 'POST',
          body: JSON.stringify({
            start: scopeRange.start,
            end: scopeRange.end,
            groupIds: requestGroupIds,
            force,
          }),
        })
        const d = (await r.json().catch(() => ({}))) as {
          insight?: string | null
          generatedAt?: string | null
          message?: string
          error?: string
        }
        if (!r.ok) throw new Error(d.error || r.statusText)
        if (d.insight) {
          setInsight(d.insight)
          setInsightGeneratedAt(d.generatedAt ?? null)
        } else {
          setInsight(null)
          setInsightGeneratedAt(null)
          setInsightError(d.message || '인사이트를 생성할 수 없습니다.')
        }
        markInsightFinished()
      } catch (e) {
        // 표식은 유지 — 화면이 꺼져 끊긴 경우 복귀 시 캐시에서 결과를 살린다
        setInsightError(e instanceof Error ? e.message : String(e))
      } finally {
        setInsightLoading(false)
      }
    },
    [scopeRange, requestGroupIds, insightLoading, markInsightFinished, markInsightStarted],
  )

  // 기간/그룹 범위가 바뀌면 기존 인사이트를 비워 범위 불일치를 방지
  useEffect(() => {
    setInsight(null)
    setInsightError(null)
    setInsightGeneratedAt(null)
  }, [activePeriod, monthOffset, yearOffset, selectedGroupIds])

  const openReview = useCallback(async (trade: TradeRow) => {
    setReviewTrade(trade)
    setReviewText(null)
    setReviewSummary(null)
    setReviewDiagnoses([])
    setReviewError(null)
    setReviewLoading(true)
    try {
      const r = await authFetch(apiUrl('/api/pro-trade-review'), {
        method: 'POST',
        body: JSON.stringify({ tradeId: trade.id }),
      })
      const d = (await r.json().catch(() => ({}))) as {
        review?: string | null
        summary?: TradeReviewSummary | null
        diagnoses?: TradeReviewDiagnosis[] | null
        message?: string
        error?: string
      }
      if (!r.ok) throw new Error(d.error || r.statusText)
      setReviewDiagnoses(Array.isArray(d.diagnoses) ? d.diagnoses : [])
      if (d.review) {
        setReviewText(d.review)
        setReviewSummary(d.summary ?? null)
      } else {
        setReviewError(d.message || '복기를 생성할 수 없습니다.')
        setReviewSummary(d.summary ?? null)
      }
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : String(e))
    } finally {
      setReviewLoading(false)
    }
  }, [])

  const selectedGroup = useMemo(
    () => (selectedCode ? scopedGroups.find((g) => g.code === selectedCode) : undefined),
    [scopedGroups, selectedCode],
  )

  const nameByCode = useMemo(() => {
    const m = new Map<string, string>()
    for (const g of scopedGroups) m.set(g.code, g.name)
    return m
  }, [scopedGroups])

  const periodScopeLabel = activePeriod ? ranges[activePeriod].label : '전체 기간'
  const groupScopeLabel =
    selectedGroupIds === null || allGroupsSelected ? '전체 그룹' : `${selectedGroupIds.size}개 그룹`

  // 일자별 거래 내역 — 종목 선택 시 해당 종목으로 좁힘, 날짜 내림차순 그룹핑 + 그날 실현손익 소계
  const dailyGroups = useMemo(() => {
    const list = selectedCode
      ? scopeTrades.filter((t) => normalizeCode6(t.code) === selectedCode)
      : scopeTrades
    const map = new Map<string, { date: string; trades: TradeRow[]; dayRealized: number }>()
    for (const t of list) {
      if (!map.has(t.traded_at)) {
        map.set(t.traded_at, { date: t.traded_at, trades: [], dayRealized: 0 })
      }
      const g = map.get(t.traded_at)!
      g.trades.push(t)
      const realized = Number(t.realized_profit)
      if (Number.isFinite(realized)) g.dayRealized += realized
    }
    return [...map.values()].sort((a, b) => b.date.localeCompare(a.date))
  }, [scopeTrades, selectedCode])

  return (
    <div className="min-h-screen w-full min-w-0 max-w-full bg-gray-50">
      <div className="max-md:min-h-[calc(100dvh-2rem)] max-md:overflow-y-auto">
        <div className={`${PRO_CONTENT_WRAP} min-w-0 py-4 pb-12`}>
          <div className="mb-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/pro')}
              className="flex-shrink-0 rounded-lg p-1.5 hover:bg-gray-100"
              aria-label="Pro 홈"
            >
              <ArrowLeft size={20} className="text-gray-600" />
            </button>
            <ReceiptText
              size={22}
              className="flex-shrink-0 text-violet-600"
              strokeWidth={1.8}
              aria-hidden
            />
            <h1 className="min-w-0 truncate text-[16px] font-bold text-gray-900 sm:text-[20px]">
              매매일지
            </h1>
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={refreshing}
              aria-label="새로고침"
              title="새로고침"
              className="flex-shrink-0 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
            >
              <RotateCw
                size={16}
                strokeWidth={2}
                className={refreshing ? 'animate-spin' : undefined}
                aria-hidden
              />
            </button>

            <div className="relative ml-auto flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowGroupFilter((v) => !v)}
                aria-label="그룹 보기"
                className="flex flex-shrink-0 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[12px] font-bold text-gray-700 hover:border-gray-400 sm:px-3"
              >
                <Filter size={14} strokeWidth={2} aria-hidden />
                <span className="hidden sm:inline">
                  그룹 보기
                  {!allGroupsSelected && selectedGroupIds ? (
                    <span className="text-[10px] text-blue-600"> ({selectedGroupIds.size})</span>
                  ) : null}
                </span>
              </button>

              {showGroupFilter ? (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-10"
                    aria-label="그룹 필터 닫기"
                    onClick={() => setShowGroupFilter(false)}
                  />
                  <div className="absolute top-full right-0 z-20 mt-1 min-w-[160px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                    <button
                      type="button"
                      onClick={toggleAllGroups}
                      className="flex w-full items-center gap-2 px-3 py-2 text-[13px] hover:bg-gray-50"
                    >
                      <div
                        className={`flex h-4 w-4 items-center justify-center rounded border ${
                          allGroupsSelected ? 'border-gray-900 bg-gray-900' : 'border-gray-300'
                        }`}
                      >
                        {allGroupsSelected ? (
                          <Check size={11} className="text-white" strokeWidth={3} aria-hidden />
                        ) : null}
                      </div>
                      <span className="font-bold">전체</span>
                    </button>
                    <div className="my-1 border-t border-gray-100" />
                    {groups.map((g) => {
                      const checked = selectedGroupIds === null || selectedGroupIds.has(g.id)
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => toggleGroup(g.id)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-[13px] hover:bg-gray-50"
                        >
                          <div
                            className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                              checked ? 'border-gray-900 bg-gray-900' : 'border-gray-300'
                            }`}
                          >
                            {checked ? (
                              <Check size={11} className="text-white" strokeWidth={3} aria-hidden />
                            ) : null}
                          </div>
                          <span className="truncate">{g.name}</span>
                        </button>
                      )
                    })}
                  </div>
                </>
              ) : null}
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-[13px] text-gray-400">로딩 중...</div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-6 text-center text-[13px] text-red-700">
              {error}
            </div>
          ) : tableMissing ? (
            <div className="rounded-2xl border border-gray-200 bg-white py-12 text-center text-[13px] text-gray-400">
              매매일지 테이블이 아직 준비되지 않았습니다.
            </div>
          ) : (
            <>
              {/* 기간 — 일/주/월/년 가로 바 */}
              <section className="mb-3 rounded-2xl border border-gray-200 bg-white p-4">
                <div className="mb-3 flex items-center gap-2">
                  <h2 className="text-[14px] font-bold text-gray-900">기간</h2>
                  {activePeriod ? (
                    <button
                      type="button"
                      onClick={() => setActivePeriod(null)}
                      className="ml-auto text-[11px] font-semibold text-violet-600 hover:text-violet-700"
                    >
                      전체 보기
                    </button>
                  ) : (
                    <span className="ml-auto text-[11px] text-gray-400">실현손익</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {periodCells.map((p) => {
                    const active = activePeriod === p.key
                    const navigable = p.key === 'month' || p.key === 'year'
                    const offset = p.key === 'month' ? monthOffset : p.key === 'year' ? yearOffset : 0
                    const shift = (delta: number) => {
                      if (p.key === 'month') setMonthOffset((v) => Math.min(0, v + delta))
                      else if (p.key === 'year') setYearOffset((v) => Math.min(0, v + delta))
                      setActivePeriod(p.key)
                    }
                    const toggle = () => setActivePeriod((prev) => (prev === p.key ? null : p.key))
                    return (
                      <div
                        key={p.key}
                        role="button"
                        tabIndex={0}
                        onClick={toggle}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            toggle()
                          }
                        }}
                        className={`cursor-pointer rounded-xl border p-3 text-left transition-colors ${
                          active
                            ? 'border-violet-400 bg-violet-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          <span className="text-[13px] font-bold text-gray-900">{p.label}</span>
                          {navigable ? (
                            <div className="ml-auto flex items-center gap-0.5">
                              <button
                                type="button"
                                aria-label="이전"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  shift(-1)
                                }}
                                className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                              >
                                <ChevronLeft size={14} strokeWidth={2} aria-hidden />
                              </button>
                              <span className="min-w-[48px] text-center text-[11px] font-semibold tabular-nums text-gray-600">
                                {p.scopeLabel}
                              </span>
                              <button
                                type="button"
                                aria-label="다음"
                                disabled={offset >= 0}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  shift(1)
                                }}
                                className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent"
                              >
                                <ChevronRight size={14} strokeWidth={2} aria-hidden />
                              </button>
                            </div>
                          ) : (
                            <span className="ml-auto text-[10px] text-gray-400">{p.scopeLabel}</span>
                          )}
                        </div>
                        <div
                          className={`mt-1 text-[15px] font-bold tabular-nums ${pnlClass(p.sum)}`}
                        >
                          {formatSigned(p.sum)}
                        </div>
                        <div className="text-[10px] tabular-nums text-gray-400">{p.count}건</div>
                      </div>
                    )
                  })}
                </div>
              </section>

              {/* 매매 통계 */}
              <section className="mb-3 rounded-2xl border border-gray-200 bg-white p-4">
                <button
                  type="button"
                  onClick={() => setShowStats((v) => !v)}
                  className="flex w-full items-center gap-2"
                >
                  <BarChart3 size={16} className="flex-shrink-0 text-gray-600" strokeWidth={2} aria-hidden />
                  <h2 className="text-[14px] font-bold text-gray-900">매매 통계</h2>
                  <span className="text-[11px] text-gray-400">{groupScopeLabel} · 전체 기간</span>
                  <span className="ml-auto text-[11px] font-semibold text-violet-600">
                    {showStats ? '접기' : '펼치기'}
                  </span>
                </button>

                {showStats ? (
                  tradeStats.sellCount === 0 ? (
                    <p className="py-6 text-center text-[12px] text-gray-400">
                      실현된 매도 거래가 없어 통계를 표시할 수 없습니다.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-4">
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                          <div className="text-[10px] text-gray-400">총 실현손익</div>
                          <div
                            className={`text-[15px] font-bold tabular-nums ${pnlClass(tradeStats.totalRealized)}`}
                          >
                            {formatSigned(tradeStats.totalRealized)}
                          </div>
                          <div className="text-[10px] tabular-nums text-gray-400">
                            매도 {tradeStats.sellCount}건
                          </div>
                        </div>
                        <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                          <div className="text-[10px] text-gray-400">승률</div>
                          <div className="text-[15px] font-bold tabular-nums text-gray-900">
                            {tradeStats.winRate != null ? `${tradeStats.winRate.toFixed(0)}%` : '—'}
                          </div>
                          <div className="text-[10px] tabular-nums text-gray-400">
                            <span className="text-red-600">{tradeStats.winCount}승</span>{' '}
                            <span className="text-blue-600">{tradeStats.lossCount}패</span>
                          </div>
                        </div>
                        <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                          <div className="text-[10px] text-gray-400">손익비</div>
                          <div className="text-[15px] font-bold tabular-nums text-gray-900">
                            {tradeStats.payoffRatio != null
                              ? `${tradeStats.payoffRatio.toFixed(2)}`
                              : '—'}
                          </div>
                          <div className="text-[10px] tabular-nums text-gray-400">
                            평균 손익 비율
                          </div>
                        </div>
                        <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                          <div className="text-[10px] text-gray-400">평균 보유기간</div>
                          <div className="text-[15px] font-bold tabular-nums text-gray-900">
                            {tradeStats.avgHoldingDays != null
                              ? `${tradeStats.avgHoldingDays.toFixed(1)}일`
                              : '—'}
                          </div>
                          <div className="text-[10px] tabular-nums text-gray-400">매수→매도</div>
                        </div>
                      </div>

                      {monthlySeries.length > 0 ? (
                        <div>
                          <div className="mb-1 text-[11px] text-gray-400">
                            월별 실현손익 (막대) · 누적 (선)
                          </div>
                          <ResponsiveContainer width="100%" height={220}>
                            <ComposedChart
                              data={monthlySeries}
                              margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                              <XAxis
                                dataKey="month"
                                tick={{ fontSize: 10, fill: '#9ca3af' }}
                                tickFormatter={(m: string) => m.slice(2)}
                              />
                              <YAxis
                                tick={{ fontSize: 10, fill: '#9ca3af' }}
                                tickFormatter={(v: number) => `${Math.round(v / 10000)}만`}
                                width={40}
                              />
                              <Tooltip
                                formatter={(value, name) => [
                                  `${Math.round(Number(value) || 0).toLocaleString('ko-KR')}원`,
                                  name === 'realized' ? '월 실현손익' : '누적',
                                ]}
                                labelFormatter={(label) => String(label)}
                              />
                              <ReferenceLine y={0} stroke="#d1d5db" />
                              <Bar dataKey="realized" fill="#a78bfa" radius={[3, 3, 0, 0]} />
                              <Line
                                type="monotone"
                                dataKey="cumulative"
                                stroke="#7c3aed"
                                strokeWidth={2}
                                dot={false}
                              />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      ) : null}

                      <p className="text-[10px] text-gray-400">
                        평균 익절{' '}
                        {tradeStats.avgWin != null ? formatSigned(tradeStats.avgWin) : '—'} · 평균 손절{' '}
                        {tradeStats.avgLoss != null ? formatSigned(tradeStats.avgLoss) : '—'}
                      </p>
                    </div>
                  )
                ) : null}
              </section>

              {/* AI 인사이트 */}
              <section className="mb-3 rounded-2xl border border-violet-200 bg-violet-50/40 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles size={16} className="flex-shrink-0 text-violet-600" strokeWidth={2} aria-hidden />
                  <h2 className="text-[14px] font-bold text-gray-900">AI 인사이트</h2>
                  <span className="text-[11px] text-gray-400">
                    {periodScopeLabel} · {groupScopeLabel}
                  </span>
                  {insight && !insightLoading ? (
                    <button
                      type="button"
                      onClick={() => void generateInsight(true)}
                      className="ml-auto flex-shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold text-violet-600 hover:bg-violet-100"
                    >
                      다시 생성
                    </button>
                  ) : null}
                </div>

                {insightLoading ? (
                  <p className="py-3 text-[13px] text-gray-500">매매 인사이트를 분석하고 있습니다...</p>
                ) : insightResuming && !insight ? (
                  <p className="py-3 text-[13px] text-gray-500">
                    백그라운드에서 분석 중입니다. 완료되면 자동으로 표시됩니다.
                  </p>
                ) : insight ? (
                  <>
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-gray-700">
                      {insight}
                    </p>
                    {insightGeneratedAt ? (
                      <p className="mt-2 text-[10px] text-gray-400">
                        생성:{' '}
                        {new Date(insightGeneratedAt).toLocaleString('ko-KR', {
                          timeZone: 'Asia/Seoul',
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <div className="flex flex-col items-start gap-2">
                    <p className="text-[12px] text-gray-500">
                      {scopeSellCount > 0
                        ? '선택한 기간·그룹의 매매 성과와 습관을 AI가 분석해 요약해 드립니다.'
                        : '매도 거래가 있어야 인사이트를 생성할 수 있습니다.'}
                    </p>
                    {insightError ? (
                      <p className="text-[12px] text-red-600">{insightError}</p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void generateInsight(false)}
                      disabled={scopeSellCount === 0 || insightLoading}
                      className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Sparkles size={14} strokeWidth={2} aria-hidden />
                      AI 인사이트 생성
                    </button>
                  </div>
                )}
              </section>

              {/* 본문 2단: 종목별 합계(좌) + 일자별 거래 내역(우) */}
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
                {/* 종목별 합계 */}
                <section className="rounded-2xl border border-gray-200 bg-white p-4 lg:col-span-2">
                  <div className="mb-1 flex items-center gap-2">
                    <h2 className="text-[14px] font-bold text-gray-900">종목별 합계</h2>
                    <span
                      className={`ml-auto text-[14px] font-bold tabular-nums ${pnlClass(scopeTotal)}`}
                    >
                      {formatSigned(scopeTotal)}
                    </span>
                  </div>
                  <p className="mb-1.5 text-[11px] text-gray-400">
                    {periodScopeLabel} · {groupScopeLabel} · {summaryGroups.length}종목
                  </p>
                  <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] tabular-nums">
                    <span className="text-red-600">
                      매수 {Math.round(scopeBuyTotal).toLocaleString('ko-KR')}원
                    </span>
                    <span className="text-blue-600">
                      매도 {Math.round(scopeSellTotal).toLocaleString('ko-KR')}원
                    </span>
                  </div>

                  {summaryGroups.length === 0 ? (
                    <p className="py-8 text-center text-[12px] text-gray-400">
                      해당 범위에 거래 기록이 없습니다.
                    </p>
                  ) : (
                    <ul className="max-h-[440px] space-y-1 overflow-y-auto">
                      {summaryGroups.map((sg) => {
                        const active = selectedCode === sg.code
                        return (
                          <li key={sg.code}>
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedCode((prev) => (prev === sg.code ? null : sg.code))
                              }
                              className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors ${
                                active ? 'bg-violet-50 ring-1 ring-violet-200' : 'hover:bg-gray-50'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="truncate text-[13px] font-bold text-gray-900">
                                    {sg.name}
                                  </span>
                                  {!sg.held ? (
                                    <span className="shrink-0 rounded bg-gray-100 px-1 py-0.5 text-[9px] font-bold text-gray-500">
                                      전량매도
                                    </span>
                                  ) : null}
                                </div>
                                <div className="truncate text-[10px] tabular-nums text-gray-400">
                                  {sg.code} · 매수 {sg.buyCount} · 매도 {sg.sellCount}
                                </div>
                              </div>
                              {sg.sellCount > 0 ? (
                                <span
                                  className={`shrink-0 text-[13px] font-bold tabular-nums ${pnlClass(sg.realizedSum)}`}
                                >
                                  {formatSigned(sg.realizedSum)}
                                </span>
                              ) : (
                                <span className="shrink-0 text-[11px] text-gray-300">미실현</span>
                              )}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>

                {/* 일자별 거래 내역 */}
                <section className="rounded-2xl border border-gray-200 bg-white p-4 lg:col-span-3">
                  <div className="mb-1 flex items-center gap-2">
                    <h2 className="text-[14px] font-bold text-gray-900">거래 내역</h2>
                    {selectedGroup ? (
                      <button
                        type="button"
                        onClick={() => setSelectedCode(null)}
                        className="ml-auto rounded-lg px-2 py-1 text-[11px] font-semibold text-violet-600 hover:bg-violet-50"
                      >
                        {selectedGroup.name}만 보기 · 닫기
                      </button>
                    ) : null}
                  </div>
                  <p className="mb-3 text-[11px] text-gray-400">
                    {periodScopeLabel} · {groupScopeLabel}
                    {selectedGroup ? ` · ${selectedGroup.name}` : ''}
                  </p>

                  {dailyGroups.length === 0 ? (
                    <p className="py-8 text-center text-[12px] text-gray-400">
                      해당 범위에 거래 기록이 없습니다.
                    </p>
                  ) : (
                    <div className="max-h-[560px] space-y-4 overflow-y-auto">
                      {dailyGroups.map((d) => (
                        <div key={d.date}>
                          <div className="mb-1 flex items-center gap-2 border-b border-gray-100 pb-1">
                            <span className="text-[12px] font-bold text-gray-700">
                              {formatTradeDate(d.date)}
                            </span>
                            {d.dayRealized !== 0 ? (
                              <span
                                className={`ml-auto text-[11px] font-bold tabular-nums ${pnlClass(d.dayRealized)}`}
                              >
                                {formatSigned(d.dayRealized)}
                              </span>
                            ) : null}
                          </div>
                          <ul className="divide-y divide-gray-100">
                            {d.trades.map((t) => {
                              const code = normalizeCode6(t.code)
                              const realized = Number(t.realized_profit)
                              return (
                                <li key={t.id} className="flex items-center gap-2.5 py-2">
                                  <span
                                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                      t.side === 'buy'
                                        ? 'bg-red-50 text-red-600'
                                        : 'bg-blue-50 text-blue-600'
                                    }`}
                                  >
                                    {t.side === 'buy' ? '매수' : '매도'}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => navigate(`/pro/stock/${code}`)}
                                        className="min-w-0 truncate text-left text-[13px] font-bold text-gray-900"
                                      >
                                        {nameByCode.get(code) || t.name || code}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => void deleteTrade(t.id)}
                                        className="shrink-0 rounded p-0.5 text-gray-300 hover:text-red-500"
                                        aria-label="거래 기록 삭제"
                                      >
                                        <Trash2 size={12} strokeWidth={1.8} />
                                      </button>
                                      {t.side === 'sell' ? (
                                        <button
                                          type="button"
                                          onClick={() => void openReview(t)}
                                          className="shrink-0 rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-600 hover:bg-violet-100"
                                        >
                                          복기
                                        </button>
                                      ) : null}
                                    </div>
                                    <div className="truncate text-[11px] tabular-nums text-gray-500">
                                      {Number(t.quantity).toLocaleString('ko-KR')}주 ·{' '}
                                      {Number(t.price).toLocaleString('ko-KR')}원
                                      {t.memo ? ` · ${t.memo}` : ''}
                                    </div>
                                    {(() => {
                                      const qty = Number(t.quantity)
                                      const px = Number(t.price)
                                      const tradeAmount = qty * px
                                      const avg = Number(t.avg_price_at_trade)
                                      const costAmount =
                                        Number.isFinite(avg) && avg > 0 ? avg * qty : null
                                      if (t.side === 'buy') {
                                        return (
                                          <div className="truncate text-[11px] tabular-nums text-red-600">
                                            매수금액 {tradeAmount.toLocaleString('ko-KR')}원
                                          </div>
                                        )
                                      }
                                      return (
                                        <div className="truncate text-[11px] tabular-nums text-gray-500">
                                          {costAmount != null ? (
                                            <>매입원금 {costAmount.toLocaleString('ko-KR')}원 · </>
                                          ) : null}
                                          <span className="text-blue-600">
                                            매도금액 {tradeAmount.toLocaleString('ko-KR')}원
                                          </span>
                                        </div>
                                      )
                                    })()}
                                  </div>
                                  {t.side === 'sell' && Number.isFinite(realized) ? (
                                    <div className="shrink-0 text-right">
                                      <div
                                        className={`text-[12px] font-bold tabular-nums ${pnlClass(realized)}`}
                                      >
                                        {formatSigned(realized)}
                                      </div>
                                      {(() => {
                                        const pct = realizedPct(t)
                                        return pct != null ? (
                                          <div
                                            className={`text-[10px] tabular-nums ${pnlClass(pct)}`}
                                          >
                                            {pct >= 0 ? '+' : ''}
                                            {pct.toFixed(1)}%
                                          </div>
                                        ) : null
                                      })()}
                                    </div>
                                  ) : null}
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
        </div>
      </div>

      {reviewTrade ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center"
          onClick={() => setReviewTrade(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start gap-2">
              <Sparkles size={16} className="mt-0.5 flex-shrink-0 text-violet-600" strokeWidth={2} aria-hidden />
              <div className="min-w-0 flex-1">
                <h3 className="text-[14px] font-bold text-gray-900">AI 매매 복기</h3>
                <p className="truncate text-[11px] text-gray-500">
                  {(nameByCode.get(normalizeCode6(reviewTrade.code)) ||
                    reviewTrade.name ||
                    normalizeCode6(reviewTrade.code))}{' '}
                  · {formatTradeDate(reviewTrade.traded_at)} 매도 ·{' '}
                  {Number(reviewTrade.price).toLocaleString('ko-KR')}원
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReviewTrade(null)}
                className="shrink-0 rounded p-1 text-gray-400 hover:text-gray-700"
                aria-label="닫기"
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            {reviewLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-[13px] text-gray-500">
                <Loader2 size={16} className="animate-spin" />
                매도 후 흐름을 분석하고 있습니다…
              </div>
            ) : reviewError ? (
              <p className="py-6 text-center text-[13px] text-red-500">{reviewError}</p>
            ) : (
              <div className="space-y-3">
                {reviewSummary ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                      <div className="text-[10px] text-gray-400">매도 후 현재가</div>
                      <div className="text-[13px] font-bold tabular-nums text-gray-900">
                        {reviewSummary.currentPrice != null
                          ? `${reviewSummary.currentPrice.toLocaleString('ko-KR')}원`
                          : '—'}
                      </div>
                      <div
                        className={`text-[10px] tabular-nums ${pnlClass(reviewSummary.changeToCurrentPct ?? 0)}`}
                      >
                        {reviewSummary.changeToCurrentPct != null
                          ? `${reviewSummary.changeToCurrentPct >= 0 ? '+' : ''}${reviewSummary.changeToCurrentPct.toFixed(1)}%`
                          : '—'}
                      </div>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                      <div className="text-[10px] text-gray-400">매도 후 최고가</div>
                      <div className="text-[13px] font-bold tabular-nums text-gray-900">
                        {reviewSummary.maxPrice != null
                          ? `${reviewSummary.maxPrice.toLocaleString('ko-KR')}원`
                          : '—'}
                      </div>
                      <div
                        className={`text-[10px] tabular-nums ${pnlClass(reviewSummary.changeToMaxPct ?? 0)}`}
                      >
                        {reviewSummary.changeToMaxPct != null
                          ? `${reviewSummary.changeToMaxPct >= 0 ? '+' : ''}${reviewSummary.changeToMaxPct.toFixed(1)}%`
                          : '—'}
                      </div>
                    </div>
                  </div>
                ) : null}
                {reviewDiagnoses.length > 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    <div className="mb-1.5 text-[11px] font-bold text-amber-800">당시 AI 진단</div>
                    <ul className="space-y-1.5">
                      {reviewDiagnoses.map((d, i) => (
                        <li key={`${d.date}-${i}`} className="text-[12px] leading-relaxed text-gray-700">
                          <span className="tabular-nums text-gray-400">{d.date}</span>
                          {d.verdict ? (
                            <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                              {d.verdict}
                            </span>
                          ) : null}
                          {d.diagPrice != null ? (
                            <span className="ml-1.5 tabular-nums text-gray-400">
                              진단가 {d.diagPrice.toLocaleString('ko-KR')}원
                            </span>
                          ) : null}
                          {d.summary ? (
                            <span className="mt-0.5 block text-gray-600">{d.summary}</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {reviewText ? (
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-gray-700">
                    {reviewText}
                  </p>
                ) : null}
                <p className="text-[10px] text-gray-400">
                  매도 후 실제 주가 흐름을 바탕으로 한 결과론적 분석이며 투자 권유가 아닙니다.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
