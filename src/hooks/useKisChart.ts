import { useEffect, useMemo, useState } from 'react'

export type Timeframe = '3D' | '1W' | '1M' | '3M' | '1Y'

export type ChartPoint = {
  label: string
  price: number | null
  ts: string
}

const inflight = new Map<string, Promise<any>>()
const recent = new Map<string, { at: number; data: any }>()

type State =
  | { status: 'idle'; points: ChartPoint[] }
  | { status: 'loading'; points: ChartPoint[] }
  | { status: 'ok'; points: ChartPoint[] }
  | { status: 'error'; points: ChartPoint[]; message: string }

export function useKisChart(stockCode: string, tf: Timeframe) {
  const [state, setState] = useState<State>({ status: 'idle', points: [] })

  const normalizedCode = useMemo(
    () => String(stockCode).replace(/\D/g, '').padStart(6, '0'),
    [stockCode],
  )

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setState({ status: 'loading', points: [] })
      const key = `${normalizedCode}:${tf}`
      const now = Date.now()
      const hit = recent.get(key)
      if (hit && now - hit.at < 5_000) {
        const points = Array.isArray(hit.data?.points)
          ? (hit.data.points as ChartPoint[])
          : []
        setState({ status: 'ok', points })
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
                text.trimStart().startsWith('<!DOCTYPE') ||
                text.trimStart().startsWith('<html')
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

        const json = await task
        inflight.delete(key)
        recent.set(key, { at: Date.now(), data: json })

        if (cancelled) return
        const points = Array.isArray(json?.points)
          ? (json.points as ChartPoint[])
          : []
        setState({ status: 'ok', points })
      } catch (e) {
        inflight.delete(key)
        if (cancelled) return
        const message = e instanceof Error ? e.message : String(e)
        setState({
          status: 'error',
          points: [],
          message,
        })
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [normalizedCode, tf])

  return state
}
