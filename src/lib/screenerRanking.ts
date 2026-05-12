export type RankingInput = {
  finalScore: number
  executionScore: number
  supplyScore: number
  sectorFlowScore: number
  consensusUpsidePct: number
  valuationScore: number
  marketScore: number
  rsi14: number
  atrDistance: number
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

export function calculateScreeningScore(input: RankingInput): number {
  const upsideScore = clamp(input.consensusUpsidePct * 3 + 50, 0, 100)
  let score =
    upsideScore * 0.4 +
    input.finalScore * 0.22 +
    input.executionScore * 0.13 +
    input.supplyScore * 0.1 +
    input.sectorFlowScore * 0.06 +
    input.valuationScore * 0.05 +
    input.marketScore * 0.04

  if (input.rsi14 >= 80) score -= 10
  if (input.atrDistance >= 3.5) score -= 10
  if (input.executionScore < 40) score -= 15
  return Math.round(clamp(score, 0, 100))
}
