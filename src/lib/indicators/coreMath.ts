import type { OhlcvBar } from './types'

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

export function mean(arr: number[]): number {
  if (!arr.length) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

export function sma(values: number[], period: number): number | null {
  if (values.length < period || period <= 0) return null
  return mean(values.slice(-period))
}

/** Wilder (RMA) smoothing — 첫 값은 period 합의 평균 */
export function wilderRma(series: number[], period: number): number[] {
  if (series.length < period) return []
  const out: number[] = []
  let prev = mean(series.slice(0, period))
  out.push(prev)
  for (let i = period; i < series.length; i++) {
    prev = (prev * (period - 1) + series[i]) / period
    out.push(prev)
  }
  return out
}

export function trueRange(bar: OhlcvBar, prevClose: number): number {
  const hl = bar.high - bar.low
  const hc = Math.abs(bar.high - prevClose)
  const lc = Math.abs(bar.low - prevClose)
  return Math.max(hl, hc, lc)
}

export function atrWilder(bars: OhlcvBar[], period = 14): number | null {
  if (bars.length < period + 1) return null
  const trs: number[] = []
  for (let i = 1; i < bars.length; i++) {
    trs.push(trueRange(bars[i], bars[i - 1].close))
  }
  const r = wilderRma(trs, period)
  if (!r.length) return null
  let atr = r[r.length - 1]!
  const lastTrSma = mean(trs.slice(-period))
  const lastClose = bars[bars.length - 1]?.close ?? 0
  // TR 14일 합계를 ATR로 착각한 경우 등: Wilder 값이 최근 TR 평균의 ~14배면 SMA(TR)로 보정
  if (lastTrSma > 0 && atr / lastTrSma > 10) {
    atr = lastTrSma
  } else if (lastClose > 0 && atr / lastClose > 0.06) {
    atr = Math.min(atr, lastClose * 0.045)
  }
  if (!Number.isFinite(atr) || !(atr > 0)) return null
  return atr
}

/** CLV 한 봉 */
export function clvSingle(bar: OhlcvBar): number | null {
  const range = bar.high - bar.low
  if (!(range > 0)) return null
  return ((bar.close - bar.low) - (bar.high - bar.close)) / range
}

export function rsiFromCloses(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null
  let gain = 0
  let loss = 0
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff >= 0) gain += diff
    else loss += Math.abs(diff)
  }
  const avgGain = gain / period
  const avgLoss = loss / period
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

export function highestClose(bars: OhlcvBar[], lookback: number): number | null {
  if (bars.length < lookback) return null
  const slice = bars.slice(-lookback)
  return Math.max(...slice.map((b) => b.close))
}

export function avgVolume(bars: OhlcvBar[], lookback: number): number | null {
  if (bars.length < lookback) return null
  const vols = bars.slice(-lookback).map((b) => b.volume)
  if (vols.some((v) => !Number.isFinite(v) || v < 0)) return null
  return mean(vols)
}

export function returnPct(closes: number[], days: number): number | null {
  if (closes.length < days + 1) return null
  const a = closes[closes.length - 1 - days]
  const b = closes[closes.length - 1]
  if (!(a > 0) || !(b > 0)) return null
  return ((b - a) / a) * 100
}

export function consecutiveUpDays(bars: OhlcvBar[]): number {
  let n = 0
  for (let i = bars.length - 1; i > 0; i--) {
    if (bars[i].close > bars[i - 1].close) n += 1
    else break
  }
  return n
}

/** 최근 거래일부터 역으로, 종가 > 시가(양봉) 연속 일수 */
export function consecutiveYangDays(bars: OhlcvBar[]): number {
  let n = 0
  for (let i = bars.length - 1; i >= 0; i--) {
    if (bars[i].close > bars[i].open) n += 1
    else break
  }
  return n
}

export function adx14(bars: OhlcvBar[]): number | null {
  if (bars.length < 30) return null
  const period = 14
  const trs: number[] = []
  const plusDm: number[] = []
  const minusDm: number[] = []
  for (let i = 1; i < bars.length; i++) {
    const up = bars[i].high - bars[i - 1].high
    const down = bars[i - 1].low - bars[i].low
    trs.push(trueRange(bars[i], bars[i - 1].close))
    plusDm.push(up > down && up > 0 ? up : 0)
    minusDm.push(down > up && down > 0 ? down : 0)
  }
  if (trs.length < period * 2) return null
  const atr = wilderRma(trs, period)
  const pDmS = wilderRma(plusDm, period)
  const mDmS = wilderRma(minusDm, period)
  if (!atr.length || !pDmS.length || !mDmS.length) return null
  const idx = atr.length - 1
  const dxSeries: number[] = []
  for (let j = 0; j <= idx; j++) {
    const av = atr[j]
    const pv = pDmS[j]
    const mv = mDmS[j]
    const pdiv = av > 0 ? (100 * pv) / av : 0
    const mdiv = av > 0 ? (100 * mv) / av : 0
    dxSeries.push(pdiv + mdiv > 0 ? (100 * Math.abs(pdiv - mdiv)) / (pdiv + mdiv) : 0)
  }
  const adxArr = wilderRma(dxSeries, period)
  return adxArr.length ? adxArr[adxArr.length - 1] : null
}

/** MFI(14) — 전형적 공식 */
export function mfi14(bars: OhlcvBar[]): number | null {
  if (bars.length < 16) return null
  const period = 14
  const tpRaw: number[] = []
  const rmf: number[] = []
  for (let i = 0; i < bars.length; i++) {
    const tp = (bars[i].high + bars[i].low + bars[i].close) / 3
    tpRaw.push(tp)
    const v = Math.max(0, bars[i].volume)
    rmf.push(tp * v)
  }
  let pos = 0
  let neg = 0
  for (let i = tpRaw.length - period; i < tpRaw.length; i++) {
    if (i <= 0) continue
    const rawMoney = rmf[i]
    if (tpRaw[i] > tpRaw[i - 1]) pos += rawMoney
    else if (tpRaw[i] < tpRaw[i - 1]) neg += rawMoney
  }
  if (neg === 0) return pos > 0 ? 100 : 50
  const moneyRatio = pos / neg
  return 100 - 100 / (1 + moneyRatio)
}
