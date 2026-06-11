import type { ReactNode } from 'react'
import {
  Activity,
  Building2,
  Calendar,
  ChartPie,
  Database,
  Flag,
  Globe,
  LogIn,
  MessageSquare,
  Percent,
  Shield,
  Target,
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
    foreignHoldingRate?: number | null
    foreignHoldingQty?: number | null
    listedShares?: number | null
    foreignNetBuy?: number | null
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
  earnings?: {
    primary?: string | null
    sub?: string | null
    subEmphasis?: string | null
    riskBadge?: string | null
  } | null
  news?: Array<{ title: string; link: string; pubDate?: string }>
  newsSummary?: string | null
  disclosures?: Array<{ date: string; report: string; link: string }>
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

const INDICATOR_INFO = {
  per: `PER (주가수익비율)
현재 주가 ÷ 1주당 순이익

낮을수록 저평가, 높을수록 고평가입니다.
업종 평균과 비교해 판단합니다.

• 10배 미만: 저평가 영역
• 10-20배: 적정
• 20배 이상: 고평가 (성장주는 예외)`,

  pbr: `PBR (주가순자산비율)
현재 주가 ÷ 1주당 순자산

1배 미만 = 청산가치보다 저렴 (저평가)
1-3배 = 적정
3배 이상 = 자산 대비 고평가

순자산 가치를 기반으로 한 평가 지표입니다.`,

  eps: `EPS (주당순이익)
1주당 발생한 순이익

기업의 수익성 지표.
EPS가 증가하는 추세 = 실적 개선
EPS가 감소 = 실적 악화

전년 동기 대비 (YoY) 증감률이 핵심입니다.`,

  marketCap: `시가총액
현재가 × 발행 주식수

기업의 시장 가치 총합입니다.
• 10조 이상: 대형주
• 1-10조: 중형주
• 1조 미만: 소형주

시총이 클수록 안정적이지만 등락폭은 작습니다.`,

  consensus: `증권사 컨센서스
증권사 애널리스트들의 평균 목표주가

• 상승 여력 = (목표가 - 현재가) / 현재가
• 컨센서스 상향 = 긍정적 신호
• 하향 = 부정적 신호

과거 적중률은 60-70% 수준입니다.`,

  earnings: `실적 발표일
분기별 실적 공시 예정일

실적 발표 전후 변동성이 큽니다.

• 발표 전 1주일: 관망 권장
• 어닝 서프라이즈 = +20% 가능
• 어닝 쇼크 = -20% 가능`,

  rsi: `RSI (상대강도지수, 14일)
최근 14일간의 상승/하락 비율

• 70 이상: 과매수 (조정 가능성)
• 30 이하: 과매도 (반등 가능성)
• 30-70: 중립

단기 매매 타이밍 판단에 활용됩니다.`,

  macd: `MACD (이동평균 수렴·확산)
12일선과 26일선의 차이

• 양수 (+): 상승 추세
• 음수 (-): 하락 추세
• 시그널선 상향 돌파: 매수 신호
• 시그널선 하향 돌파: 매도 신호

중기 추세 파악 지표입니다.`,

  bollinger: `볼린저 밴드
20일 이동평균선 ± 2 표준편차

• 상단 근접: 과매수 또는 강세 돌파
• 하단 근접: 과매도 또는 반등 가능
• 중간대: 추세 전환 또는 횡보

변동성과 가격 위치를 동시에 파악합니다.`,
} as const

export function buildProStockCardSections(
  summary: ProSummaryExtended,
  technical: TechnicalSnapshot,
): {
  strategy: ProGridCard[]
  investor: ProGridCard[]
  valuation: ProGridCard[]
  technical: ProGridCard[]
} {
  const strategy = deriveTradingStrategy(summary)
  const totalDays = summary.investor?.days ?? 5
  const foreignAmt = summary.investor?.foreign?.cumulativeNet
  const instAmt = summary.investor?.institute?.cumulativeNet
  const val = summary.valuation
  const analyst = summary.analyst
  const quote = summary.quote
  const foreignHoldingRate = quote?.foreignHoldingRate

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
      label: '외국인 5일',
      value: foreignAmt != null ? formatKRW(foreignAmt) : '—',
      valueColor: amountValueColor(foreignAmt),
      desc:
        foreignAmt != null
          ? investorDaysLabel(foreignAmt, summary.investor?.foreign?.buyDays ?? 0, totalDays)
          : '—',
      info: '외국인 투자자의 최근 5거래일 누적 순매수 금액입니다. 양수 = 매수 우위, 음수 = 매도 우위.',
    },
    {
      key: 'institution',
      icon: <Building2 size={13} className="text-blue-500" strokeWidth={2} />,
      label: '기관 5일',
      value: instAmt != null ? formatKRW(instAmt) : '—',
      valueColor: amountValueColor(instAmt),
      desc:
        instAmt != null
          ? investorDaysLabel(instAmt, summary.investor?.institute?.buyDays ?? 0, totalDays)
          : '—',
      info: '국내 기관 투자자의 최근 5거래일 누적 순매수 금액입니다. 연기금/증권사/투자신탁 등 포함.',
    },
    {
      key: 'foreignHolding',
      icon: <Percent size={13} className="text-blue-500" strokeWidth={2} />,
      label: '외국인 보유율',
      value:
        foreignHoldingRate != null &&
        Number.isFinite(foreignHoldingRate) &&
        foreignHoldingRate > 0
          ? `${foreignHoldingRate.toFixed(2)}%`
          : '—',
      desc: '한도 소진율',
      info: `외국인 한도 대비 보유 비율입니다.

• 50% 이상: 외국인 핵심 종목
• 30–50%: 외국인 선호
• 30% 미만: 국내 중심

변동률이 단기 가격에 영향을 줍니다.`,
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
      info: INDICATOR_INFO.per,
    },
    {
      key: 'pbr',
      icon: <ChartPie size={13} className="text-purple-500" strokeWidth={2} />,
      label: 'PBR',
      value: val?.pbr != null ? `${val.pbr.toFixed(1)}배` : '—',
      desc: 'KIS',
      info: INDICATOR_INFO.pbr,
    },
    {
      key: 'marketCap',
      icon: <Building2 size={13} className="text-purple-500" strokeWidth={2} />,
      label: '시총',
      value:
        summary.quote?.marketCap != null ? formatKRW(summary.quote.marketCap) : '—',
      desc: summary.quote?.market ? summary.quote.market : undefined,
      info: INDICATOR_INFO.marketCap,
    },
    {
      key: 'eps',
      icon: <TrendingUp size={13} className="text-purple-500" strokeWidth={2} />,
      label: 'EPS',
      value: val?.eps != null ? formatNumber(val.eps) : '—',
      desc: '원/주',
      info: INDICATOR_INFO.eps,
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
      info: INDICATOR_INFO.consensus,
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
      info: INDICATOR_INFO.earnings,
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
      info: INDICATOR_INFO.rsi,
    },
    {
      key: 'macd',
      icon: <Activity size={13} className="text-orange-500" strokeWidth={2} />,
      label: 'MACD',
      value: macd != null ? formatNumber(macd) : '—',
      desc: '12-26일',
      status: macd != null ? (macd > 0 ? '강세' : '약세') : undefined,
      statusColor: macd != null && macd > 0 ? 'red' : 'blue',
      info: INDICATOR_INFO.macd,
    },
    {
      key: 'bollinger',
      icon: <Activity size={13} className="text-orange-500" strokeWidth={2} />,
      label: '볼린저',
      value: bollingerPosition(technical?.bollinger ?? null),
      desc: '20일 ±2σ',
      info: INDICATOR_INFO.bollinger,
    },
  ]

  return {
    strategy: strategyCards,
    investor: investorCards,
    valuation: valuationCards,
    technical: technicalCards,
  }
}

/** 섹션 헤더용 아이콘 (페이지에서 재사용) */
export const proSectionIcons = {
  strategy: <Target size={24} className="text-emerald-600" strokeWidth={1.8} />,
  investor: <Users size={24} className="text-blue-500" strokeWidth={1.8} />,
  valuation: <Database size={24} className="text-purple-500" strokeWidth={1.8} />,
  technical: <Activity size={24} className="text-orange-500" strokeWidth={1.8} />,
} satisfies Record<string, ReactNode>
