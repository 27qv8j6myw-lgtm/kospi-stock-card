import { useEffect, useMemo, useState } from 'react'

export type KISLogicIndicators = {
  structure?: string
  structureSub?: string
  execution?: string
  executionSub?: string
  atrGap?: string
  atrGapValue?: number
  /** 일봉 ATR(14) Wilder, 원(₩). STOP 계산에 사용. */
  atr14Won?: number | null
  /** 최근 20일(또는 가능한 구간) 저가 최저. STOP LOW20 후보. */
  low20Min?: number | null
  atrGapSub?: string
  atrRiskStrip?: string
  atrRiskBadge?: string
  streak?: string
  streakSub?: string
  streakSeverity?: string
  market?: string
  /** 복합 시장 판정 한 줄 (예: 강세장 (Trend Up)) */
  marketHeadline?: string
  /** 추세·이격·수급·변동성·거래대금 등 멀티라인 근거 */
  marketDetail?: string
  /** KOSPI200 ETF(069500) 등 프록시 지수 최근 5거래일 종가 */
  marketSparkline5?: number[]
  /** 1~99, 최종 점수·손절 로직에 사용 */
  marketScore?: number
  marketRegime?: 'TrendUp' | 'Pullback' | 'Sideways' | 'TrendDown' | 'Volatile'
  /** 시장 카드 서브 한 줄 */
  marketSubCompact?: string
  rotation?: string
  structureState?: string
  structureStateSub?: string
  flow?: string
  adjustment?: string
  candleQuality?: string
  candleQualityPrimary?: string
  candleQualitySub?: string
  liquidity?: string
  indicator?: string
  indicatorPrimary?: string
  indicatorSub?: string
  indicatorRiskStrip?: string
  indicatorRiskBadge?: string
  indicatorShowRiskInfoIcon?: boolean
  unusual?: string
  /** 거래정지·투자주의 등 KIS 시세 raw 기반 알림 (헤더 배너) */
  specialAlerts?: string[]
  technical?: string
  stats?: string
  statsPrimary?: string
  statsSub?: string
  statsTrend20Pct?: number
  statsRiskStrip?: string
  statsRiskBadge?: string
  rsi?: string
  volume?: string
  volatility?: string
  foreign?: string
  institution?: string
  momentum?: string
  candle?: string
  valuationPrimary?: string
  valuationSub?: string
  earningsPrimary?: string
  earningsSub?: string
  earningsSeverity?: string
  earningsRiskStrip?: string
  earningsRiskBadge?: string
  earningsDetailForDrawer?: string
  earningsSparkline?: number[]
  earningsValueEmphasis?: 'danger' | 'warning' | 'muted' | 'default'
  earningsSubEmphasis?: 'danger' | 'default'
  supplyDetails?: {
    foreignNetShares3D: number
    foreignNetAmount3D: number
    institutionNetShares3D: number
    institutionNetAmount3D: number
    retailNetShares3D: number
    retailNetAmount3D: number
    foreignNetAmount5D?: number | null
    institutionNetAmount5D?: number | null
    retailNetAmount5D?: number | null
    supplyPeriod: string
  }
  consensusDetails?: {
    source: string
    avgTargetPrice: number
    maxTargetPrice: number
    /** FnGuide 증권사별 목표가 중 최저(있을 때만) */
    minTargetPrice?: number | null
    recommendationScore: number | null
    recommendationText: string | null
    analystCount: number | null
    lastUpdateDays: number | null
    /** 직전 FnGuide 컨센서스 평균 목표가 (있을 때) */
    avgTargetPriceBf?: number | null
    /** 직전 대비 평균 목표가 변화율(%) */
    avgVsBfPct?: number | null
    /** (최고-최저)/평균 * 100 */
    dispersionWidthPct?: number | null
    dispersionHighSkewPct?: number | null
    dispersionLowSkewPct?: number | null
    dispersionLabelKo?: string | null
    revision7dUp?: number | null
    revision7dDown?: number | null
    revision7dFlat?: number | null
    revision7dReports?: number | null
    /** 서버 일별 스냅샷 기준 28일 전 대비 평균 목표가 변화율 */
    consensusAvgTrend4wPct?: number | null
    consensusAvgTrend12wPct?: number | null
    consensusTrendNote?: string | null
  } | null
  /** 서버 `computeLogicIndicatorsPack` 결과 전체 (클라이언트 고급 표시용) */
  logicUi?: Record<string, unknown>
}

type State =
  | { status: 'idle'; data: KISLogicIndicators | null }
  | { status: 'loading'; data: KISLogicIndicators | null }
  | { status: 'ok'; data: KISLogicIndicators }
  | { status: 'error'; data: KISLogicIndicators | null; message: string }

export function useKisLogicIndicators(stockCode: string) {
  const [state, setState] = useState<State>({ status: 'idle', data: null })

  const normalizedCode = useMemo(
    () => String(stockCode).replace(/\D/g, '').padStart(6, '0'),
    [stockCode],
  )

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setState((prev) => ({ status: 'loading', data: prev.data }))
      try {
        const res = await fetch(
          `/api/logic-indicators?code=${encodeURIComponent(normalizedCode)}`,
        )
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)
        if (cancelled) return
        setState({ status: 'ok', data: (json?.logicIndicators || {}) as KISLogicIndicators })
      } catch (e) {
        if (cancelled) return
        setState({
          status: 'error',
          data: null,
          message: e instanceof Error ? e.message : String(e),
        })
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [normalizedCode])

  return { state }
}
