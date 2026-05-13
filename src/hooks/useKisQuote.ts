import { useCallback, useEffect, useState } from 'react'

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

/** 모의투자는 한도가 낮아 기본 3분. 필요 시 .env 대신 여기만 조정 */
const DEFAULT_POLL_MS = 180_000
/** React Strict Mode 이중 마운트·연속 호출 완화 */
const MIN_GAP_MS = 3_000

const inFlight = new Map<string, Promise<KisQuote>>()
const lastStart = new Map<string, number>()

async function fetchQuote(code6: string): Promise<KisQuote> {
  const res = await fetch(`/api/quote?code=${encodeURIComponent(code6)}`)
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json.error || `HTTP ${res.status}`)
  }
  return json as KisQuote
}

async function fetchQuoteThrottled(code6: string): Promise<KisQuote> {
  const existing = inFlight.get(code6)
  if (existing) return existing

  const now = Date.now()
  const prev = lastStart.get(code6) ?? 0
  const wait = MIN_GAP_MS - (now - prev)
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait))
  }
  lastStart.set(code6, Date.now())

  const p = fetchQuote(code6).finally(() => {
    if (inFlight.get(code6) === p) inFlight.delete(code6)
  })
  inFlight.set(code6, p)
  return p
}

export function useKisQuote(
  stockCode: string,
  pollMs: number = DEFAULT_POLL_MS,
) {
  const [state, setState] = useState<State>({ status: 'idle' })

  const run = useCallback(
    async (mode: 'initial' | 'poll') => {
      const code = String(stockCode).replace(/\D/g, '').padStart(6, '0')
      if (mode === 'initial') setState({ status: 'loading' })
      try {
        const data = await fetchQuoteThrottled(code)
        setState({ status: 'ok', data })
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        if (mode === 'initial') {
          setState({ status: 'error', message })
        }
        /** poll 실패 시 직전 성공 시세는 유지 (화면이 깜빡이지 않음) */
      }
    },
    [stockCode],
  )

  useEffect(() => {
    void run('initial')
    if (pollMs <= 0) return undefined
    const id = setInterval(() => void run('poll'), pollMs)
    return () => clearInterval(id)
  }, [run, pollMs])

  const refetch = useCallback(() => void run('initial'), [run])

  return { state, refetch }
}
