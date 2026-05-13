import { useEffect, useMemo, useState } from 'react'
import { apiUrl } from '../lib/apiBase'
import type { Timeframe } from '../types/stock'
import type { IntradayChartApiResponse } from '../types/intradayChart'
import { useAutoRefresh } from './useAutoRefresh'

export type { Timeframe }

export type ChartPoint = {
  label: string
  price: number | null
  ts: string
}

export type IntradayInterval = '1m' | '5m' | '15m'

type OkDaily = {
  status: 'ok'
  mode: 'daily'
  points: ChartPoint[]
  intraday: null
}

type OkIntraday = {
  status: 'ok'
  mode: 'intraday'
  points: ChartPoint[]
  intraday: IntradayChartApiResponse
}

export type KisChartState =
  | { status: 'idle'; points: ChartPoint[]; intraday: null; mode: null }
  | { status: 'loading'; points: ChartPoint[]; intraday: null; mode: 'daily' | 'intraday' | null }
  | OkDaily
  | OkIntraday
  | { status: 'error'; points: ChartPoint[]; intraday: null; mode: null; message: string }

const inflight = new Map<string, Promise<unknown>>()
const recent = new Map<string, { at: number; data: unknown }>()

export type UseKisChartResult = {
  chartState: KisChartState
  intradayLastUpdated: Date | null
  intradayRefreshing: boolean
}

const INTRADAY_POLL_MS = 60_000

export function useKisChart(
  stockCode: string,
  tf: Timeframe,
  opts?: { exchangeSuffix?: 'KS' | 'KQ'; intradayInterval?: IntradayInterval },
): UseKisChartResult {
  const [state, setState] = useState<KisChartState>({
    status: 'idle',
    points: [],
    intraday: null,
    mode: null,
  })

  const normalizedCode = useMemo(
    () => String(stockCode).replace(/\D/g, '').padStart(6, '0'),
    [stockCode],
  )

  const suffix = opts?.exchangeSuffix ?? 'KS'
  const iv = opts?.intradayInterval ?? '5m'

  const intradayUrl = useMemo(() => {
    const base = apiUrl('/api/intraday-chart')
    return `${base}?code=${encodeURIComponent(normalizedCode)}&interval=${encodeURIComponent(iv)}&suffix=${encodeURIComponent(suffix)}`
  }, [normalizedCode, iv, suffix])

  const isIntradayTf = tf === '1D'

  const {
    data: intradayPolled,
    lastUpdated: intradayHookLastUpdated,
    isFetching: intradayHookFetching,
    error: intradayPollError,
  } = useAutoRefresh<IntradayChartApiResponse>(intradayUrl, {
    intervalMs: INTRADAY_POLL_MS,
    enabled: isIntradayTf,
  })

  useEffect(() => {
    if (!isIntradayTf) return
    if (intradayPolled) {
      setState({ status: 'ok', mode: 'intraday', points: [], intraday: intradayPolled })
      return
    }
    if (!intradayHookFetching && intradayPollError) {
      setState({
        status: 'error',
        points: [],
        intraday: null,
        mode: null,
        message: intradayPollError,
      })
      return
    }
    setState({
      status: 'loading',
      points: [],
      intraday: null,
      mode: 'intraday',
    })
  }, [isIntradayTf, intradayPolled, intradayHookFetching, intradayPollError])

  useEffect(() => {
    if (isIntradayTf) return

    let cancelled = false

    const load = async () => {
      setState((s) => ({
        status: 'loading',
        points: s.points,
        intraday: null,
        mode: 'daily',
      }))

      const key = `${normalizedCode}:${tf}`
      const now = Date.now()
      const hit = recent.get(key)
      if (hit && now - hit.at < 5_000) {
        const points = Array.isArray((hit.data as { points?: ChartPoint[] })?.points)
          ? ((hit.data as { points: ChartPoint[] }).points as ChartPoint[])
          : []
        if (!cancelled) setState({ status: 'ok', mode: 'daily', points, intraday: null })
        return
      }

      try {
        let task = inflight.get(key)
        if (!task) {
          const chartUrl = apiUrl(
            `/api/chart?code=${encodeURIComponent(normalizedCode)}&tf=${encodeURIComponent(tf)}`,
          )
          task = fetch(chartUrl).then(async (res) => {
            const text = await res.text()
            let json: { points?: ChartPoint[]; error?: string } | null = null
            try {
              json = text ? JSON.parse(text) : null
            } catch {
              const htmlLike =
                text.trimStart().startsWith('<!DOCTYPE') || text.trimStart().startsWith('<html')
              throw new Error(
                htmlLike
                  ? '차트 API가 JSON 대신 HTML을 반환했습니다. 프록시 서버를 재시작해 주세요 (npm run dev).'
                  : `차트 응답 파싱 실패: ${text.slice(0, 120)}`,
              )
            }
            if (!res.ok) {
              throw new Error(json?.error || `HTTP ${res.status}`)
            }
            return json
          })
          inflight.set(key, task)
        }

        const json = (await task) as { points?: ChartPoint[] }
        inflight.delete(key)
        recent.set(key, { at: Date.now(), data: json })

        if (cancelled) return
        const points = Array.isArray(json.points) ? json.points : []
        setState({ status: 'ok', mode: 'daily', points, intraday: null })
      } catch (e) {
        inflight.delete(key)
        if (cancelled) return
        setState({
          status: 'error',
          points: [],
          intraday: null,
          mode: null,
          message: e instanceof Error ? e.message : String(e),
        })
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [normalizedCode, tf, isIntradayTf])

  return {
    chartState: state,
    intradayLastUpdated: isIntradayTf ? intradayHookLastUpdated : null,
    intradayRefreshing: isIntradayTf ? intradayHookFetching : false,
  }
}
