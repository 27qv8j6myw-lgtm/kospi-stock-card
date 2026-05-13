export type StopPriceV2Basis = 'FIXED' | 'ATR' | 'LOW20' | 'TIGHT'

export type StopPriceV2Candidate = {
  basis: StopPriceV2Basis
  price: number
  /** basePrice 대비 % (음수) */
  lossPct: number
  /** UI 기준 라벨 한 줄 */
  labelKr: string
}

export type StopPriceV2Result = {
  price: number
  lossPct: string
  reason: string
  basis: StopPriceV2Basis
  candidates: StopPriceV2Candidate[]
  /** ATR(14)이 없어 가격×1.8%로 대체했을 때 true */
  usedAtrFallback: boolean
  /** 입력 ATR이 가격 대비 비정상적으로 커 4% 상한 등으로 줄였을 때 true */
  atrSanitized: boolean
}

export type StopPriceV2Input = {
  currentPrice: number
  /** 없으면 currentPrice */
  entryPrice?: number | null
  /** ATR(14) Wilder, 원(₩) 절대값 */
  atr14: number
  low20: number
  rsi: number
  /** 호환용 — 내부에서 유효 ATR 기준으로 재계산 */
  atrRatio: number
}

function roundPrice(n: number): number {
  return Math.round(n)
}

function devLog(...args: unknown[]) {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('[STOP]', ...args)
    }
  } catch {
    /* noop */
  }
}

function basisLabelKr(basis: StopPriceV2Basis, atrK: number): string {
  if (basis === 'FIXED') return '기본 -6%'
  if (basis === 'ATR') return atrK >= 1.5 ? 'ATR 1.5배 차감' : 'ATR 1.0배 차감'
  if (basis === 'LOW20') return '최근 20일 최저'
  return '과열권 -4%'
}

/**
 * STOP 가격 산출 (P0 룰북).
 * - 진입가 없으면 현재가를 기준가로 사용.
 * - 후보 4종: -6% 고정, ATR×K(고변동성 1.0 / 일반 1.5), 20일 최저 저가, -4% 타이트.
 * - 선택: 진입가(또는 현재가)에 가장 가까운(손실 최소) 가격 = 후보 중 **최댓값**.
 */
export function calculateStopPriceV2(input: StopPriceV2Input): StopPriceV2Result {
  const { currentPrice, low20, rsi } = input
  const basePrice =
    input.entryPrice != null && Number.isFinite(input.entryPrice) && input.entryPrice > 0
      ? input.entryPrice
      : currentPrice

  let atr14Eff = input.atr14
  let usedAtrFallback = false
  let atrSanitized = false
  if (!(atr14Eff > 0) || !Number.isFinite(atr14Eff)) {
    usedAtrFallback = true
    atr14Eff = basePrice * 0.018
    devLog('Invalid ATR → fallback 1.8% of base for ATR candidate', { basePrice })
  }

  let atrRatioEff = basePrice > 0 ? atr14Eff / basePrice : 0
  if (atrRatioEff > 0.05) {
    console.warn(
      `[STOP] ATR ${atr14Eff.toFixed(0)} exceeds 5% of base ${basePrice.toFixed(0)} (${(atrRatioEff * 100).toFixed(1)}%) — clamping to ≤4% of base (unit mix-up or upstream bug)`,
    )
    const capped = Math.min(atr14Eff, basePrice * 0.04)
    const floored = Math.max(capped, basePrice * 0.012)
    atr14Eff = floored
    atrSanitized = true
    atrRatioEff = basePrice > 0 ? atr14Eff / basePrice : 0
  }

  const atrK = atrRatioEff >= 0.03 ? 1.0 : 1.5

  const fixed6 = basePrice * 0.94
  const atr15 = basePrice - atrK * atr14Eff
  const low20day =
    low20 > 0 && low20 < basePrice ? low20 : basePrice * 0.94
  const tight4 = basePrice * 0.96

  const candidatesRaw = {
    FIXED: fixed6,
    ATR: atr15,
    LOW20: low20day,
    TIGHT: tight4,
  } as const

  const toCandidate = (basis: StopPriceV2Basis, price: number): StopPriceV2Candidate => ({
    basis,
    price: roundPrice(price),
    lossPct: basePrice > 0 ? ((price - basePrice) / basePrice) * 100 : 0,
    labelKr: basisLabelKr(basis, atrK),
  })

  const candidates: StopPriceV2Candidate[] = [
    toCandidate('FIXED', fixed6),
    toCandidate('ATR', atr15),
    toCandidate('LOW20', low20day),
    toCandidate('TIGHT', tight4),
  ]

  devLog('input', {
    currentPrice,
    entryPrice: input.entryPrice,
    basePrice,
    atr14In: input.atr14,
    atr14Eff,
    atrK,
    atrRatioEff,
    low20In: low20,
    low20Used: low20day,
    rsi,
    usedAtrFallback,
    atrSanitized,
  })
  devLog('candidatesRaw', candidatesRaw)
  devLog(
    'candidates',
    candidates.map((c) => ({ basis: c.basis, price: c.price, lossPct: c.lossPct.toFixed(2) })),
  )

  let stopPrice: number
  let reason: string
  let basis: StopPriceV2Basis
  const winEps = Math.max(0.01, basePrice * 1e-9)

  if (rsi >= 80) {
    stopPrice = Math.max(candidatesRaw.TIGHT, candidatesRaw.ATR)
    reason = 'RSI 과열권 타이트 적용 (-4%)'
    basis = Math.abs(candidatesRaw.TIGHT - stopPrice) < winEps ? 'TIGHT' : 'ATR'
  } else if (atrRatioEff >= 0.03) {
    stopPrice = Math.max(candidatesRaw.TIGHT, candidatesRaw.LOW20)
    reason = '고변동성 타이트 적용'
    basis = Math.abs(candidatesRaw.TIGHT - stopPrice) < winEps ? 'TIGHT' : 'LOW20'
  } else {
    stopPrice = Math.max(candidatesRaw.FIXED, candidatesRaw.ATR, candidatesRaw.LOW20, candidatesRaw.TIGHT)
    const eps = Math.max(0.01, basePrice * 1e-9)
    const hits = (['ATR', 'TIGHT', 'LOW20', 'FIXED'] as const).filter(
      (b) => Math.abs(candidatesRaw[b] - stopPrice) < eps,
    )
    basis = hits[0] ?? 'FIXED'
    if (basis === 'FIXED') reason = '기본 -6% 기준'
    else if (basis === 'ATR') reason = atrK >= 1.5 ? 'ATR 1.5배 기준' : 'ATR 1.0배 기준'
    else if (basis === 'LOW20') reason = '20일 최저가 기준'
    else reason = '타이트 -4% 기준'
  }

  const price = roundPrice(stopPrice)
  const lossPct = basePrice > 0 ? (((price - basePrice) / basePrice) * 100).toFixed(1) : '0.0'

  devLog('selected', { price, lossPct, basis, reason })

  return {
    price,
    lossPct,
    reason,
    basis,
    candidates,
    usedAtrFallback,
    atrSanitized,
  }
}
