import type { MetricCardAccent } from '../types/stock'
import { formatKrwAmountToEok, formatSignedSharesKr } from './signalLogic'

/** 수급 카드 drawer 본문 — 외·기·개 3D(+5D) 분해 */
export function buildSupplyDrawerBody(params: {
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
}): string {
  const lines = [
    `${params.supplyPeriod} 기준 외·기·개 순매수 금액·수량입니다.`,
    '',
    `외국인: ${formatSignedSharesKr(params.foreignNetShares3D)} / ${formatKrwAmountToEok(params.foreignNetAmount3D)}`,
    `기관: ${formatSignedSharesKr(params.institutionNetShares3D)} / ${formatKrwAmountToEok(params.institutionNetAmount3D)}`,
    `개인: ${formatSignedSharesKr(params.retailNetShares3D)} / ${formatKrwAmountToEok(params.retailNetAmount3D)}`,
  ]
  if (
    params.foreignNetAmount5D != null ||
    params.institutionNetAmount5D != null ||
    params.retailNetAmount5D != null
  ) {
    lines.push(
      '',
      '5거래일 누적(참고):',
      `외국인 ${formatKrwAmountToEok(params.foreignNetAmount5D ?? 0)} · 기관 ${formatKrwAmountToEok(params.institutionNetAmount5D ?? 0)} · 개인 ${formatKrwAmountToEok(params.retailNetAmount5D ?? 0)}`,
    )
  }
  return lines.join('\n')
}

/** 5,000억 원 — 외국인+기관 합산 누적금액 임계 (원 단위) */
export const SUPPLY_FI_SUM_THRESHOLD_WON = 5000 * 100_000_000

export type SupplyFlowToneKind = 'favorable' | 'neutral' | 'weak' | 'burden'

/** 외국인+기관 3거래일 누적 합산 (원) */
export function fiNetSum3D(foreignNetAmount3D: number, institutionNetAmount3D: number): number {
  return foreignNetAmount3D + institutionNetAmount3D
}

/**
 * 합산(외+기) 기준 4단계 톤.
 * - 합산 ≥ +5,000억: 수급 우호
 * - 0 ≤ 합산 < +5,000억: 수급 중립
 * - -5,000억 ≤ 합산 < 0: 수급 약세
 * - 합산 < -5,000억: 수급 부담
 */
export function getSupplyFlowToneFromSum(sum: number): { kind: SupplyFlowToneKind; label: string } {
  const th = SUPPLY_FI_SUM_THRESHOLD_WON
  if (sum >= th) return { kind: 'favorable', label: '수급 우호' }
  if (sum >= 0) return { kind: 'neutral', label: '수급 중립' }
  if (sum >= -th) return { kind: 'weak', label: '수급 약세' }
  return { kind: 'burden', label: '수급 부담' }
}

/**
 * 외·기 누적 부호가 반대이고, |외국인| > 2×|기관|일 때만 외국인 주도 태그.
 * (같은 방향이면 태그 없음. 2× 경계는 태그 중복을 피하기 위해 `>` 로 처리)
 */
export function getForeignVsInstitutionLeadSuffix(
  foreignNetAmount3D: number,
  institutionNetAmount3D: number,
): string {
  if (foreignNetAmount3D === 0 || institutionNetAmount3D === 0) return ''
  const oppositeSign = foreignNetAmount3D * institutionNetAmount3D < 0
  if (!oppositeSign) return ''
  const absF = Math.abs(foreignNetAmount3D)
  const absI = Math.abs(institutionNetAmount3D)
  if (absF <= 2 * absI) return ''
  if (foreignNetAmount3D < 0) return ' (외국인 매도 주도)'
  return ' (외국인 매수 주도)'
}

/**
 * 한눈에 보기 Reason용 — 헤더 수급 칩과 동일 합산 `formatKrwAmountToEok(외+기)` 기준.
 * '우호적'·'긍정적' 등은 라벨이 "수급 우호"일 때만 라벨 문자열에 포함됨.
 */
export function buildThreeDayFiSupplyReasonSentence(
  foreignNetAmount3D: number,
  institutionNetAmount3D: number,
): string {
  const sum = fiNetSum3D(foreignNetAmount3D, institutionNetAmount3D)
  const { label } = getSupplyFlowToneFromSum(sum)
  const suffix = getForeignVsInstitutionLeadSuffix(foreignNetAmount3D, institutionNetAmount3D)
  return `직전 3거래일 누적 수급 ${formatKrwAmountToEok(sum)} → ${label}${suffix}`
}

/** 수급 카드 서브 한 줄 (톤 + 주도 세력) */
export function buildSupplyCardSubLine(
  foreignNetAmount3D: number,
  institutionNetAmount3D: number,
): string {
  const sum = fiNetSum3D(foreignNetAmount3D, institutionNetAmount3D)
  const { label } = getSupplyFlowToneFromSum(sum)
  const suffix = getForeignVsInstitutionLeadSuffix(foreignNetAmount3D, institutionNetAmount3D)
  return `${label}${suffix}`
}

export function supplyCardAccentFromFiSum(sum: number): MetricCardAccent {
  const { kind } = getSupplyFlowToneFromSum(sum)
  if (kind === 'favorable') return 'info'
  if (kind === 'neutral') return 'neutral'
  if (kind === 'weak') return 'caution'
  return 'warning'
}
