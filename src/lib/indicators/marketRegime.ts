import type { IndexDerivedMetrics, MarketRegimeResult } from './types'

function fmtEok(won: number | null): string {
  if (won == null || !Number.isFinite(won)) return '데이터 없음'
  const e = won / 100_000_000
  const sign = e >= 0 ? '+' : ''
  return `${sign}${e.toFixed(1)}억`
}

export function computeMarketRegime(m: IndexDerivedMetrics): MarketRegimeResult {
  const lines: string[] = []
  const ret20 = m.ret20Pct
  const sma20 = m.sma20
  const sma60 = m.sma60
  const last = m.last
  const vk = m.vkospiProxy
  const intra = m.intradayAbsPct ?? 0
  const f5 = m.foreign5dWon
  const f20 = m.foreign20dWon

  const maSpreadPct =
    sma20 != null && sma60 != null && sma60 > 0 ? (Math.abs(sma20 - sma60) / sma60) * 100 : null

  lines.push(
    ret20 == null
      ? 'KOSPI 20일 수익률: 데이터 부족'
      : `KOSPI 20일 수익률 ${ret20 >= 0 ? '+' : ''}${ret20.toFixed(1)}%`,
  )
  lines.push(
    sma20 != null && sma60 != null
      ? `KOSPI 20MA ${sma20 > sma60 ? '>' : '<='} 60MA`
      : '이동평균: 데이터 부족',
  )
  lines.push(`VK 대체 ${vk != null ? `${vk.toFixed(1)}%` : 'n/a'} · 일중 ${intra.toFixed(2)}%`)
  lines.push(`외인 5D ${fmtEok(f5)} · 20D ${fmtEok(f20)}`)

  let headlineKr = '박스권'
  let regimeKey = 'sideways'
  let score = 60

  const condVolatile = vk != null && vk >= 20 && intra >= 2
  const condBull =
    sma20 != null && sma60 != null && sma20 > sma60 && ret20 != null && ret20 >= 3
  const condBox =
    ret20 != null && ret20 > -3 && ret20 < 3 && maSpreadPct != null && maSpreadPct < 3
  const condBear =
    (ret20 != null && ret20 <= -3) ||
    (sma20 != null && sma60 != null && sma20 < sma60 && f20 != null && f20 < 0)

  if (condVolatile) {
    headlineKr = '변동성 확대'
    regimeKey = 'volatile'
    score = 44
  } else if (condBull) {
    headlineKr = '강세장'
    regimeKey = 'bull'
    score = 78
  } else if (condBox) {
    headlineKr = '박스권'
    regimeKey = 'sideways'
    score = 60
  } else if (condBear) {
    headlineKr = '약세장'
    regimeKey = 'bear'
    score = 38
  } else {
    headlineKr = '조정장'
    regimeKey = 'pullback'
    score = 47
  }

  const gap20pct =
    last != null && sma20 != null && sma20 > 0 ? ((last / sma20 - 1) * 100).toFixed(1) : null
  const subCompact =
    gap20pct != null
      ? `KOSPI 20MA ${Number(gap20pct) >= 0 ? '+' : ''}${gap20pct}% · 외인 5D ${fmtEok(f5)}`
      : `외인 5D ${fmtEok(f5)}`

  return {
    headlineKr,
    subCompact,
    detailLines: lines,
    score,
    regimeKey,
  }
}
