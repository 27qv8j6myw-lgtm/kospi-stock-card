import type { LogicMetric } from '../types/stock'

/** 로직 지표 카드 표시 순서 (3열×6행 = 16슬롯) */
export const LOGIC_INDICATOR_ORDER: LogicMetric['descriptionKey'][] = [
  'structure',
  'execution',
  'atrDistance',
  'consecutiveRise',
  'market',
  'sectorFlow',
  'structureState',
  'supply',
  'consensus',
  'candleQuality',
  'indicators',
  'statistics',
  'valuation',
  'roe',
  'epsGrowth',
  'earnings',
]

export type IndicatorGridSlotInput = {
  metric: LogicMetric
  /** 섹터 자금흐름 카드 우측 상단 "관심" 뱃지 */
  showSectorInterestBadge?: boolean
}

function byDescriptionKey(metrics: LogicMetric[]): Map<string, LogicMetric> {
  const m = new Map<string, LogicMetric>()
  for (const x of metrics) {
    m.set(x.descriptionKey, x)
  }
  return m
}

/** 구조·실행 점수를 레퍼런스 형태(99/100)로, ATR은 "n.n ATR" 형태로 */
export function normalizeIndicatorPrimary(m: LogicMetric): string {
  if (m.descriptionKey === 'structure' || m.descriptionKey === 'execution') {
    const n = Number(String(m.value).replace(/[^\d]/g, ''))
    if (Number.isFinite(n)) return `${n}/100`
  }
  if (m.descriptionKey === 'atrDistance') {
    const v = String(m.value).trim()
    if (v && v !== '—' && !/ATR/i.test(v)) return `${v} ATR`
  }
  return m.value
}

/**
 * 로직 지표 16칸 정렬 (ROE·EPS 성장 포함).
 * 섹터 카드에 `statusBadge: '관심'`이 있으면 우측에 작은 "관심" 뱃지.
 */
export function buildLogicIndicatorGridSlots(metrics: LogicMetric[]): IndicatorGridSlotInput[] {
  const map = byDescriptionKey(metrics)
  const ordered: LogicMetric[] = []
  for (const key of LOGIC_INDICATOR_ORDER) {
    const hit = map.get(key)
    if (hit) ordered.push(hit)
  }
  return ordered.map((metric) => ({
    metric,
    showSectorInterestBadge: metric.descriptionKey === 'sectorFlow' && metric.statusBadge === '관심',
  }))
}
