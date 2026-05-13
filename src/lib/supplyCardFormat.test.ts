import { describe, expect, it } from 'vitest'
import { formatSupplyFlowAmountWon } from './supplyCardFormat'

describe('formatSupplyFlowAmountWon (입력: 원)', () => {
  it('대형 외국인 매도·기관 매수 예시', () => {
    expect(formatSupplyFlowAmountWon(-4_800_000_000_000)).toBe('-4.8조')
    expect(formatSupplyFlowAmountWon(743_200_000_000)).toBe('+7,432억')
    expect(formatSupplyFlowAmountWon(980_000_000_000)).toBe('+9,800억')
    expect(formatSupplyFlowAmountWon(1_000_000_000_000)).toBe('+1.0조')
    expect(formatSupplyFlowAmountWon(150_000_000_000)).toBe('+1,500억')
  })

  it('0', () => {
    expect(formatSupplyFlowAmountWon(0)).toBe('0원')
  })
})
