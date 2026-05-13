import { useMemo } from 'react'
import { apiUrl } from '../lib/apiBase'
import { useAutoRefresh } from './useAutoRefresh'

export type KisQuote = {
  code: string
  nameKr: string | null
  market: string | null
  sector: string | null
  price: number
  change: number
  changePercent: number
  changeSign: string | null
  volume: number | null
  tradeValue: number | null
  open: number | null
  high: number | null
  low: number | null
  per: number | null
  pbr: number | null
  eps: number | null
  bps: number | null
  /** EPS/BPS 기반 ROE 근사(%), TTM */
  roeTtmApprox: number | null
  /** KIS 시세 output 내 영업이익률 유사 필드(있을 때만) */
  operatingMarginTtm: number | null
  /** 부채비율 유사 필드(있을 때만) */
  debtRatio: number | null
  fetchedAt: string
  kisEnv: string
}

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; data: KisQuote }
  | { status: 'error'; message: string }

/** 시세 자동 갱신 주기 (30초). `pollMs <= 0` 이면 장중 폴링 없이 최초·탭 복귀 시만 갱신 */
const DEFAULT_POLL_MS = 30_000

export function useKisQuote(stockCode: string, pollMs: number = DEFAULT_POLL_MS) {
  const code6 = useMemo(() => String(stockCode).replace(/\D/g, '').padStart(6, '0'), [stockCode])
  const quoteUrl = useMemo(
    () => apiUrl(`/api/quote?code=${encodeURIComponent(code6)}`),
    [code6],
  )

  const { data, lastUpdated, isFetching, error, refetch } = useAutoRefresh<KisQuote>(quoteUrl, {
    intervalMs: pollMs > 0 ? pollMs : 0,
    enabled: true,
  })

  const state = useMemo((): State => {
    if (data) return { status: 'ok', data }
    if (isFetching) return { status: 'loading' }
    if (error) return { status: 'error', message: error }
    return { status: 'idle' }
  }, [data, isFetching, error])

  return {
    state,
    refetch,
    quoteRefresh: { lastUpdated, isFetching },
  }
}
