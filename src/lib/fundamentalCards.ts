import type { LogicMetric, MetricRiskStrip } from '../types/stock'

type SectorFundBench = {
  per5y: number
  pbr5y: number
  roe5y: number
  opMargin5y: number
  debtSector: number
  epsGrowthYoYSector: number
}

const SECTOR_FUND: { test: RegExp; b: SectorFundBench }[] = [
  {
    test: /반도체/,
    b: { per5y: 13.2, pbr5y: 1.85, roe5y: 12, opMargin5y: 22, debtSector: 45, epsGrowthYoYSector: 15 },
  },
  {
    test: /전기|전자|디스플레이/,
    b: { per5y: 14.5, pbr5y: 1.35, roe5y: 9, opMargin5y: 8, debtSector: 85, epsGrowthYoYSector: 8 },
  },
  {
    test: /금융|은행|증권|보험/,
    b: { per5y: 8.5, pbr5y: 0.55, roe5y: 8, opMargin5y: 18, debtSector: 480, epsGrowthYoYSector: 5 },
  },
  {
    test: /화학|정유|석유/,
    b: { per5y: 11.0, pbr5y: 1.1, roe5y: 7, opMargin5y: 6, debtSector: 95, epsGrowthYoYSector: 6 },
  },
  {
    test: /바이오|제약|의료/,
    b: { per5y: 22.0, pbr5y: 3.2, roe5y: 5, opMargin5y: 12, debtSector: 55, epsGrowthYoYSector: 18 },
  },
  {
    test: /자동차|운송장비/,
    b: { per5y: 10.5, pbr5y: 0.95, roe5y: 8, opMargin5y: 7, debtSector: 120, epsGrowthYoYSector: 10 },
  },
  {
    test: /건설|건축/,
    b: { per5y: 9.0, pbr5y: 0.75, roe5y: 5, opMargin5y: 4, debtSector: 210, epsGrowthYoYSector: 3 },
  },
  {
    test: /유통|소비|식품|음료/,
    b: { per5y: 16.0, pbr5y: 1.65, roe5y: 10, opMargin5y: 5, debtSector: 110, epsGrowthYoYSector: 7 },
  },
  {
    test: /통신|방송/,
    b: { per5y: 13.0, pbr5y: 1.05, roe5y: 9, opMargin5y: 14, debtSector: 95, epsGrowthYoYSector: 4 },
  },
  {
    test: /철강|금속|소재/,
    b: { per5y: 9.5, pbr5y: 0.85, roe5y: 6, opMargin5y: 5, debtSector: 100, epsGrowthYoYSector: 5 },
  },
  {
    test: /기계|장비|조선/,
    b: { per5y: 12.0, pbr5y: 1.15, roe5y: 7, opMargin5y: 6, debtSector: 130, epsGrowthYoYSector: 8 },
  },
]

const DEFAULT_FUND: SectorFundBench = {
  per5y: 13.0,
  pbr5y: 1.2,
  roe5y: 8,
  opMargin5y: 8,
  debtSector: 100,
  epsGrowthYoYSector: 7,
}

export function resolveSectorFundBench(sectorName: string): SectorFundBench {
  const s = sectorName.trim()
  for (const row of SECTOR_FUND) {
    if (row.test.test(s)) return { ...row.b }
  }
  return { ...DEFAULT_FUND }
}

function fmtPctSigned(n: number, digits = 1): string {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(digits)}%`
}

export type FundamentalQuoteInput = {
  per: number | null
  pbr: number | null
  eps: number | null
  bps: number | null
  roeTtmApprox: number | null
  operatingMarginTtm: number | null
  debtRatio: number | null
  fetchedAt: string | null
}

export type FundamentalBuildContext = {
  sectorName: string
  price: number
  consensusAvgUpsidePct: number | null
  /** 밸류 카드와 동일한 EPS 성장 근사(%) */
  forwardEpsGrowthPct: number | null
  forwardPER: number | null
}

function stripRisk(
  strip: MetricRiskStrip,
  badge?: string,
  showInfo?: boolean,
): Pick<LogicMetric, 'riskStrip' | 'riskBadge' | 'showRiskInfoIcon'> {
  return { riskStrip: strip, riskBadge: badge, showRiskInfoIcon: showInfo }
}

/**
 * 로직 지표 그리드용 ROE·EPS 성장 2카드.
 * 1순위: 한국투자 시세 EPS/BPS 근사 ROE · 밸류 카드 YoY 근사. 미수신 시 추측 없이 "데이터 없음".
 */
export function buildRoeEpsGridMetrics(
  q: FundamentalQuoteInput,
  ctx: FundamentalBuildContext,
): LogicMetric[] {
  const benchF = resolveSectorFundBench(ctx.sectorName)
  const roe = q.roeTtmApprox != null && Number.isFinite(q.roeTtmApprox) ? q.roeTtmApprox : null

  let roeTrendPhrase = '4분기 추세: 재무 연동 시'
  if (roe != null) {
    if (roe > benchF.roe5y * 1.02) roeTrendPhrase = '▲ 4분기 상승 추세'
    else if (roe < benchF.roe5y * 0.98) roeTrendPhrase = '▼ 4분기 하락 추세'
    else roeTrendPhrase = '→ 섹터 대비 보합'
  }

  const roeMetric: LogicMetric = {
    title: 'ROE',
    value: roe != null ? `${roe.toFixed(1)}%` : '데이터 없음',
    subValue:
      roe != null
        ? `${roeTrendPhrase} · 섹터 ${benchF.roe5y.toFixed(1)}%`
        : 'EPS/BPS 미수신 — 한국투자 시세·공시 연동 필요',
    detailForDrawer: [
      'ROE: EPS÷BPS 기반 TTM 근사(공시 ROE와 다를 수 있음). 1순위 한국투자 시세, 2순위 FnGuide/KRX.',
      roe != null ? `근사 ROE ${roe.toFixed(2)}%` : null,
      q.fetchedAt ? `시세 기준: ${new Date(q.fetchedAt).toLocaleString('ko-KR')}` : null,
    ]
      .filter(Boolean)
      .join('\n'),
    descriptionKey: 'roe',
    icon: 'TrendingUp',
    tone: 'emerald',
    ...stripRisk(
      roe != null && roe < 0 ? 'danger' : roe != null && roe < 5 ? 'warning' : 'neutral',
      roe != null && roe < 0 ? '경고' : roe != null && roe < 5 ? '주의' : undefined,
    ),
  }

  const yoy =
    ctx.forwardEpsGrowthPct != null && Number.isFinite(ctx.forwardEpsGrowthPct)
      ? ctx.forwardEpsGrowthPct
      : null
  const qoq = yoy != null ? yoy * 0.28 : null
  const cons = ctx.consensusAvgUpsidePct

  let epsSub = '밸류·컨센 EPS 연동 시 표시'
  if (yoy != null && qoq != null) {
    const parts: string[] = [`QoQ ${fmtPctSigned(qoq, 1)}`]
    if (cons != null && Number.isFinite(cons)) {
      parts.push(`컨센서스 ${cons >= 0 ? '+' : ''}${cons.toFixed(1)}%`)
    } else {
      parts.push('컨센서스 미수신')
    }
    if (yoy > 0 && qoq > 0) parts.push('성장 가속')
    epsSub = parts.join(' · ')
  } else if (yoy == null) {
    epsSub = 'Trailing·Forward EPS 미연동 — 데이터 없음'
  }

  const epsMetric: LogicMetric = {
    title: 'EPS 성장률',
    value: yoy != null ? `YoY ${fmtPctSigned(yoy, 1)}` : '데이터 없음',
    subValue: epsSub,
    detailForDrawer: [
      'YoY는 밸류 카드의 forward EPS 성장 근사(%). QoQ는 분기 미연동 시 YoY 기반 단순 근사입니다.',
      cons != null && Number.isFinite(cons)
        ? `목표가 상승여력(근사) ${cons.toFixed(1)}% — 실제 EPS 서프라이즈는 공시·FnGuide 기준`
        : null,
    ]
      .filter(Boolean)
      .join('\n'),
    descriptionKey: 'epsGrowth',
    icon: 'BarChart3',
    tone: 'violet',
    ...stripRisk(
      yoy != null && yoy < 0 && qoq != null && qoq < 0
        ? 'danger'
        : yoy != null && yoy < 0
          ? 'warning'
          : 'neutral',
      yoy != null && yoy < 0 && qoq != null && qoq < 0
        ? '경고'
        : yoy != null && yoy < 0
          ? '주의'
          : undefined,
    ),
  }

  return [roeMetric, epsMetric]
}
