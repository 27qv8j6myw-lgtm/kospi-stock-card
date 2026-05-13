import { useEffect, useMemo, useState } from 'react'
import type { Timeframe } from '../types/stock'
import type { IntradayChartApiResponse } from '../types/intradayChart'

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

type State =
  | { status: 'idle'; points: ChartPoint[]; intraday: null; mode: null }
  | { status: 'loading'; points: ChartPoint[]; intraday: null; mode: 'daily' | 'intraday' | null }
  | OkDaily
  | OkIntraday
  | { status: 'error'; points: ChartPoint[]; intraday: null; mode: null; message: string }

const inflight = new Map<string, Promise<unknown>>()
const recent = new Map<string, { at: number; data: unknown }>()

export function useKisChart(
  stockCode: string,
  tf: Timeframe,
  opts?: { exchangeSuffix?: 'KS' | 'KQ'; intradayInterval?: IntradayInterval },
) {
  const [state, setState] = useState<State>({ status: 'idle', points: [], intraday: null, mode: null })

  const normalizedCode = useMemo(
    () => String(stockCode).replace(/\D/g, '').padStart(6, '0'),
    [stockCode],
  )

  const suffix = opts?.exchangeSuffix ?? 'KS'
  const iv = opts?.intradayInterval ?? '5m'

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setState((s) => ({
        status: 'loading',
        points: s.points,
        intraday: null,
        mode: tf === '1D' ? 'intraday' : 'daily',
      }))

      if (tf === '1D') {
        const intraKey = `intraday:${normalizedCode}:${iv}:${suffix}`
        const now = Date.now()
        const hit = recent.get(intraKey)
        if (hit && now - hit.at < 3_000) {
          setState({
            status: 'ok',
            mode: 'intraday',
            points: [],
            intraday: hit.data as IntradayChartApiResponse,
          })
          return
        }

        try {
          let task = inflight.get(intraKey)
          if (!task) {
            const u = new URL('/api/intraday-chart', window.location.origin)
            u.searchParams.set('code', normalizedCode)
            u.searchParams.set('interval', iv)
            u.searchParams.set('suffix', suffix)
            task = fetch(u.toString()).then(async (res) => {
              const text = await res.text()
              let json: unknown = null
              try {
                json = JSON.parse(text)
              } catch {
                json = null
              }
              if (!res.ok) {
                const msg =
                  json && typeof json === 'object' && json !== null && 'error' in json
                    ? String((json as { error: unknown }).error)
                    : `HTTP ${res.status}`
                throw new Error(msg)
              }
              return json
            })
            inflight.set(intraKey, task)
          }
          const json = (await task) as IntradayChartApiResponse
          inflight.delete(intraKey)
          recent.set(intraKey, { at: Date.now(), data: json })
          if (cancelled) return
          setState({ status: 'ok', mode: 'intraday', points: [], intraday: json })
        } catch (e) {
          inflight.delete(intraKey)
          if (cancelled) return
          setState({
            status: 'error',
            points: [],
            intraday: null,
            mode: null,
            message: e instanceof Error ? e.message : String(e),
          })
        }
        return
      }

      const key = `${normalizedCode}:${tf}`
      const now = Date.now()
      const hit = recent.get(key)
      if (hit && now - hit.at < 5_000) {
        const points = Array.isArray((hit.data as { points?: ChartPoint[] })?.points)
          ? ((hit.data as { points: ChartPoint[] }).points as ChartPoint[])
          : []
        setState({ status: 'ok', mode: 'daily', points, intraday: null })
        return
      }

      try {
        let task = inflight.get(key)
        if (!task) {
          task = fetch(
            `/api/chart?code=${encodeURIComponent(normalizedCode)}&tf=${encodeURIComponent(tf)}`,
          ).then(async (res) => {
            const text = await res.text()
            let json: any = null
            try {
              json = JSON.parse(text)
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
  }, [normalizedCode, tf, suffix, iv])

  return state
}
