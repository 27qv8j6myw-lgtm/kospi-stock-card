import { useEffect, useState } from 'react'
import { AIScreenerBriefing } from './AIScreenerBriefing'
import { SectorSection } from './SectorSection'
import { Top5Ranking } from './Top5Ranking'
import { runSectorScreener, type ScreenerResult } from '../lib/screener'

let screenerCache: ScreenerResult | null = null

export function SectorScreenerTab() {
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'ok'; data: ScreenerResult } | { status: 'error'; message: string }
  >({ status: 'loading' })
  const [refreshing, setRefreshing] = useState(false)

  const load = async (force = false) => {
    if (!force && screenerCache) {
      setState({ status: 'ok', data: screenerCache })
      return
    }
    try {
      if (force) setRefreshing(true)
      else setState({ status: 'loading' })
      const data = await runSectorScreener()
      screenerCache = data
      setState({ status: 'ok', data })
    } catch (e) {
      setState({ status: 'error', message: e instanceof Error ? e.message : String(e) })
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (cancelled) return
      await load(false)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (state.status === 'loading') {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-700 shadow-sm">
        <h2 className="text-xl font-bold">시장 스크리너</h2>
        <p className="mt-2 text-sm text-slate-600">
          8개 섹터에서 1개월 +15% 후보를 스크리닝 중입니다... KIS·Claude 데이터를 순차 분석하고 있습니다.
        </p>
      </section>
    )
  }

  if (state.status === 'error') {
    return (
      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
        시장 스크리너를 불러오지 못했습니다: {state.message}
      </section>
    )
  }

  return (
    <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold text-slate-900">시장 스크리너</h2>
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={refreshing}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {refreshing ? '새로고침 중...' : '새로고침'}
          </button>
        </div>
        <p className="text-sm text-slate-600">
          1개월 +15% 후보를 찾고, 왜 지금 가능한지와 리스크를 함께 보는 AI 투자 프로젝트 뷰입니다.
        </p>
      </header>

      {state.data.sectors.map((sector) => (
        <SectorSection key={sector.key} sector={sector} />
      ))}

      <Top5Ranking top5={state.data.top5} />
      <AIScreenerBriefing stocks={state.data.top5} />
    </div>
  )
}
