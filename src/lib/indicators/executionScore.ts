import { atrWilder, clvSingle, rsiFromCloses, sma } from './coreMath'
import type { OhlcvBar } from './types'

export type ExecutionScoreResult = {
  score: number
  sub: string
}

function rsiTimingScore(rsi: number | null): { pts: number; label: string } {
  if (rsi == null) return { pts: 0, label: 'RSI 없음' }
  if (rsi >= 30 && rsi <= 50) return { pts: 40, label: '타이밍 양호' }
  if (rsi > 50 && rsi <= 60) return { pts: 30, label: '타이밍 보통' }
  if (rsi > 60 && rsi <= 70) return { pts: 15, label: '타이밍 다소 과열' }
  return { pts: 0, label: '과열로 진입 부적합' }
}

function atrVolatilityScore(gap: number | null): { pts: number; label: string } {
  if (gap == null) return { pts: 0, label: '변동성 산출 불가' }
  if (gap <= 1.5) return { pts: 20, label: '이격 양호' }
  if (gap <= 2.5) return { pts: 10, label: '이격 주의' }
  return { pts: 0, label: '이격 과대' }
}

function resistanceBreakScore(bars: OhlcvBar[]): { pts: number; label: string } {
  if (bars.length < 70) return { pts: 0, label: '매물대 데이터 부족' }
  const last = bars[bars.length - 1].close
  const hist = bars.slice(-64, -1)
  if (hist.length < 20) return { pts: 0, label: '매물대 산출 불가' }
  const mx = Math.max(...hist.map((b) => b.close))
  if (last > mx) return { pts: 20, label: '매물대 상향 돌파' }
  return { pts: 0, label: '매물대 하단' }
}

function clv5AvgScore(bars: OhlcvBar[]): { pts: number; label: string } {
  const last5 = bars.slice(-5)
  const vals: number[] = []
  for (const b of last5) {
    const c = clvSingle(b)
    if (c != null) vals.push(c)
  }
  if (!vals.length) return { pts: 0, label: 'CLV 산출 불가' }
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length
  if (avg >= 0.5) return { pts: 20, label: '캔들 강함' }
  if (avg >= 0) return { pts: 10, label: '캔들 중립' }
  return { pts: 0, label: '캔들 약함' }
}

export function computeExecutionScore(bars: OhlcvBar[]): ExecutionScoreResult {
  const closes = bars.map((b) => b.close)
  const rsi = rsiFromCloses(closes, 14)
  const sma20 = sma(closes, 20)
  const last = closes[closes.length - 1]
  const atr = atrWilder(bars, 14)
  const gap = sma20 != null && atr != null && atr > 0 ? Math.abs(last - sma20) / atr : null

  const t = rsiTimingScore(rsi)
  const v = atrVolatilityScore(gap)
  const r = resistanceBreakScore(bars)
  const c = clv5AvgScore(bars)
  const raw = t.pts + v.pts + r.pts + c.pts
  const score = Math.round(Math.max(0, Math.min(100, raw)))
  const sub =
    t.pts === 0 ? t.label : v.pts === 0 ? `${t.label} · ${v.label}` : `${t.label} · ${v.label}`
  return { score, sub }
}
