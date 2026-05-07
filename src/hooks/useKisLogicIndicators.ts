import { useEffect, useMemo, useState } from 'react'

export type KISLogicIndicators = {
  structure?: string
  execution?: string
  atrGap?: string
  streak?: string
  market?: string
  rotation?: string
  structureState?: string
  flow?: string
  adjustment?: string
  candleQuality?: string
  liquidity?: string
  indicator?: string
  unusual?: string
  technical?: string
  stats?: string
  rsi?: string
  volume?: string
  volatility?: string
  foreign?: string
  institution?: string
  momentum?: string
  candle?: string
  supplyDetails?: {
    foreignNetShares: number
    foreignNetAmount: number
    institutionNetShares: number
    institutionNetAmount: number
    retailNetShares: number
    retailNetAmount: number
    supplyPeriod: string
  }
  consensusDetails?: {
    source: string
    avgTargetPrice: number
    maxTargetPrice: number
    recommendationScore: number | null
    recommendationText: string | null
    analystCount: number | null
    lastUpdateDays: number | null
  } | null
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
