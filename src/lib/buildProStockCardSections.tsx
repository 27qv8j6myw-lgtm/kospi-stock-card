import type { ReactNode } from 'react'
import {
  Activity,
  AlertTriangle,
  Building2,
  Calendar,
  ChartPie,
  CreditCard,
  Database,
  Flag,
  Globe,
  LogIn,
  MessageSquare,
  Percent,
  Shield,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import type { ProGridCard } from '@/components/stock/pro/ProSectionGrid'
import { formatKRW } from '@/lib/format'
import { deriveTradingStrategy, investorDaysLabel } from '@/lib/proStockDesign'

export type ProSummaryExtended = {
  code?: string
  name?: string
  quote?: {
    market?: string
    sector?: string
    currentPrice?: number
    changePct?: number
    marketCap?: number
    openPrice?: number | null
    dayHigh?: number | null
    dayLow?: number | null
    volume?: number | null
    tradingAmount?: number | null
    tradingValue?: number | null
    avgVolume20d?: number | null
  }
  week52?: { high52w?: number; low52w?: number; pctFromHigh?: number | null }
  investor?: {
    days?: number
    foreign?: { cumulativeNet?: number; buyDays?: number }
    institute?: { cumulativeNet?: number; buyDays?: number }
  }
  valuation?: { per?: number; pbr?: number; eps?: number }
  analyst?: {
    available?: boolean
    targetPrice?: number
    upside?: number
    opinion?: string | null
    reportCount?: number | null
  }
  foreignHolding?: { current?: number | null; change?: number | null } | null
  risk?: {
    shortRatio?: number | null
    shortChange?: number | null
    marginRatio?: number | null
  } | null
  sector?: { rank?: number | null; total?: number | null; name?: string | null } | null
  earnings?: {
    primary?: string | null
    sub?: string | null
    subEmphasis?: string | null
    riskBadge?: string | null
  } | null
  news?: Array<{ title: string; link: string; pubDate?: string }>
  newsSummary?: string | null
}

export type TechnicalSnapshot = {
  rsi?: number | null
  macd?: number | null
  bollinger?: { current: number; upper: number; lower: number } | null
} | null

function dash(v: string | number | null | undefined): string {
  if (v == null || v === '') return '—'
  return String(v)
}

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${Math.round(n).toLocaleString()}원`
}

function formatNumber(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString()
}

function pctBetween(from: number, to: number): string | null {
  if (!Number.isFinite(from) || from === 0 || !Number.isFinite(to)) return null
  const p = ((to - from) / from) * 100
  return `${p > 0 ? '+' : ''}${p.toFixed(1)}%`
}

function amountValueColor(amount: number | undefined): 'red' | 'blue' | 'default' {
  if (amount == null || !Number.isFinite(amount) || amount === 0) return 'default'
  return amount > 0 ? 'red' : 'blue'
}

function bollingerPosition(
  b: { current: number; upper: number; lower: number } | null | undefined,
): string {
  if (!b) return '—'
  if (b.current >= b.upper * 0.98) return '상단'
  if (b.current <= b.lower * 1.02) return '하단'
  return '중간대'
}

export function buildProStockCardSections(
  summary: ProSummaryExtended,
  technical: TechnicalSnapshot,
): {
  strategy: ProGridCard[]
  investor: ProGridCard[]
  valuation: ProGridCard[]
  technical: ProGridCard[]
  risk: ProGridCard[]
} {
  const strategy = deriveTradingStrategy(summary)
  const totalDays = summary.investor?.days ?? 5
  const foreignAmt = summary.investor?.foreign?.cumulativeNet
  const instAmt = summary.investor?.institute?.cumulativeNet
  const val = summary.valuation
  const analyst = summary.analyst
  const fh = summary.foreignHolding
  const risk = summary.risk
  const sector = summary.sector

  const strategyCards: ProGridCard[] = strategy
    ? [
        {
          key: 'entry',
          icon: <LogIn size={13} className="text-emerald-600" strokeWidth={2} />,
          label: '진입',
          value: formatPrice(strategy.entry),
          desc: '분할 진입',
          info: 'OPUS 분석 기반 추천 진입가',
        },
        {
          key: 'target',
          icon: <Flag size={13} className="text-red-600" strokeWidth={2} />,
          label: '목표',
          value: formatPrice(strategy.target),
          valueColor: 'red',
          desc: pctBetween(strategy.entry, strategy.target) ?? undefined,
          info: '단기 목표 (1-3개월)',
        },
        {
          key: 'stop',
          icon: <Shield size={13} className="text-blue-600" strokeWidth={2} />,
          label: '손절',
          value: formatPrice(strategy.stop),
          valueColor: 'blue',
          desc: pctBetween(strategy.entry, strategy.stop) ?? undefined,
          info: '52주·지지 기준',
        },
      ]
    : []

  const investorCards: ProGridCard[] = [
    {
      key: 'foreign',
      icon: <Globe size={13} className="text-blue-500" strokeWidth={2} />,
      label: '외국인',
      value: foreignAmt != null ? formatKRW(foreignAmt) : '—',
      valueColor: amountValueColor(foreignAmt),
      desc:
        foreignAmt != null
          ? investorDaysLabel(foreignAmt, summary.investor?.foreign?.buyDays ?? 0, totalDays)
          : undefined,
    },
    {
      key: 'institution',
      icon: <Building2 size={13} className="text-blue-500" strokeWidth={2} />,
      label: '기관',
      value: instAmt != null ? formatKRW(instAmt) : '—',
      valueColor: amountValueColor(instAmt),
      desc:
        instAmt != null
          ? investorDaysLabel(instAmt, summary.investor?.institute?.buyDays ?? 0, totalDays)
          : undefined,
    },
    {
      key: 'foreignHolding',
      icon: <Percent size={13} className="text-blue-500" strokeWidth={2} />,
      label: '보유율',
      value:
        fh?.current != null && Number.isFinite(fh.current) ? `${fh.current.toFixed(2)}%` : '—',
      desc: '30일 추이',
      status:
        fh?.change != null && Number.isFinite(fh.change)
          ? `${fh.change > 0 ? '+' : ''}${fh.change.toFixed(2)}%p`
          : undefined,
      statusColor:
        fh?.change != null && fh.change > 0
          ? 'red'
          : fh?.change != null && fh.change < 0
            ? 'blue'
            : 'amber',
    },
  ]

  const per = val?.per
  const sectorPer = null
  const valuationCards: ProGridCard[] = [
    {
      key: 'per',
      icon: <ChartPie size={13} className="text-purple-500" strokeWidth={2} />,
      label: 'PER',
      value: per != null ? `${per.toFixed(1)}배` : '—',
      desc: sectorPer != null ? `업종 ${sectorPer}배` : 'KIS',
      status:
        per != null && sectorPer != null && per > sectorPer * 2
          ? '고평가'
          : per != null && sectorPer != null && per < sectorPer * 0.7
            ? '저평가'
            : undefined,
      statusColor: per != null && sectorPer != null && per > sectorPer * 2 ? 'red' : 'blue',
    },
    {
      key: 'pbr',
      icon: <ChartPie size={13} className="text-purple-500" strokeWidth={2} />,
      label: 'PBR',
      value: val?.pbr != null ? `${val.pbr.toFixed(1)}배` : '—',
      desc: 'KIS',
    },
    {
      key: 'marketCap',
      icon: <Building2 size={13} className="text-purple-500" strokeWidth={2} />,
      label: '시총',
      value:
        summary.quote?.marketCap != null ? formatKRW(summary.quote.marketCap) : '—',
      desc: summary.quote?.market ? summary.quote.market : undefined,
    },
    {
      key: 'eps',
      icon: <TrendingUp size={13} className="text-purple-500" strokeWidth={2} />,
      label: 'EPS',
      value: val?.eps != null ? formatNumber(val.eps) : '—',
      desc: '원/주',
    },
    {
      key: 'targetPrice',
      icon: <MessageSquare size={13} className="text-pink-500" strokeWidth={2} />,
      label: '목표가',
      value: analyst?.targetPrice != null ? formatPrice(analyst.targetPrice) : '—',
      desc: analyst?.reportCount != null ? `컨센 ${analyst.reportCount}개` : undefined,
      status:
        analyst?.upside != null
          ? `${analyst.upside > 0 ? '+' : ''}${analyst.upside}%`
          : undefined,
      statusColor: 'red',
    },
    {
      key: 'earnings',
      icon: <Calendar size={13} className="text-purple-500" strokeWidth={2} />,
      label: '실적발표',
      value: dash(summary.earnings?.primary),
      desc: dash(summary.earnings?.sub),
      status: summary.earnings?.riskBadge ?? undefined,
      statusColor:
        summary.earnings?.subEmphasis === 'danger'
          ? 'red'
          : summary.earnings?.subEmphasis === 'warning'
            ? 'amber'
            : undefined,
    },
  ]

  const rsi = technical?.rsi
  const macd = technical?.macd
  const technicalCards: ProGridCard[] = [
    {
      key: 'rsi',
      icon: <Activity size={13} className="text-orange-500" strokeWidth={2} />,
      label: 'RSI',
      value: rsi != null ? rsi.toFixed(1) : '—',
      desc: '14일',
      status: rsi != null && rsi > 70 ? '과매수' : rsi != null && rsi < 30 ? '과매도' : undefined,
      statusColor: rsi != null && rsi > 70 ? 'red' : 'blue',
    },
    {
      key: 'macd',
      icon: <Activity size={13} className="text-orange-500" strokeWidth={2} />,
      label: 'MACD',
      value: macd != null ? formatNumber(macd) : '—',
      desc: '12-26일',
      status: macd != null ? (macd > 0 ? '강세' : '약세') : undefined,
      statusColor: macd != null && macd > 0 ? 'red' : 'blue',
    },
    {
      key: 'bollinger',
      icon: <Activity size={13} className="text-orange-500" strokeWidth={2} />,
      label: '볼린저',
      value: bollingerPosition(technical?.bollinger ?? null),
      desc: '20일 ±2σ',
    },
  ]

  const shortRatio = risk?.shortRatio
  const shortChange = risk?.shortChange
  const marginRatio = risk?.marginRatio
  const riskCards: ProGridCard[] = [
    {
      key: 'shortSelling',
      icon: <TrendingDown size={13} className="text-red-600" strokeWidth={2} />,
      label: '공매도',
      value: shortRatio != null ? `${shortRatio.toFixed(1)}%` : '—',
      desc:
        shortChange != null
          ? `5일 ${shortChange > 0 ? '+' : ''}${shortChange.toFixed(1)}%p`
          : undefined,
      status: shortChange != null && shortChange > 0.5 ? '증가 ↑' : undefined,
      statusColor: 'red',
    },
    {
      key: 'margin',
      icon: <CreditCard size={13} className="text-red-600" strokeWidth={2} />,
      label: '신용잔고',
      value: marginRatio != null ? `${marginRatio.toFixed(1)}%` : '—',
      desc: '시총 대비',
      status: marginRatio != null && marginRatio > 2 ? '주의' : undefined,
      statusColor: 'red',
    },
    {
      key: 'sectorRank',
      icon: <Database size={13} className="text-pink-500" strokeWidth={2} />,
      label: '업종 순위',
      value:
        sector?.rank != null && sector?.total != null
          ? `${sector.rank}/${sector.total}`
          : '—',
      desc: dash(sector?.name ?? summary.quote?.sector),
      status:
        sector?.rank != null && sector?.total != null && sector.rank <= sector.total * 0.3
          ? '상위'
          : undefined,
      statusColor: 'red',
    },
  ]

  return { strategy: strategyCards, investor: investorCards, valuation: valuationCards, technical: technicalCards, risk: riskCards }
}

/** 섹션 헤더용 아이콘 (페이지에서 재사용) */
export const proSectionIcons = {
  strategy: <Target size={20} className="text-emerald-600" strokeWidth={1.8} />,
  investor: <Users size={20} className="text-blue-500" strokeWidth={1.8} />,
  valuation: <Database size={20} className="text-purple-500" strokeWidth={1.8} />,
  technical: <Activity size={20} className="text-orange-500" strokeWidth={1.8} />,
  risk: <AlertTriangle size={20} className="text-red-600" strokeWidth={1.8} />,
} satisfies Record<string, ReactNode>
