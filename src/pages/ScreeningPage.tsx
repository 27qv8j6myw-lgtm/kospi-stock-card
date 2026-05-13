import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { ScreeningHeader } from '../components/screening/ScreeningHeader'
import { SectorGrid } from '../components/screening/SectorGrid'
import { TopFiveCarousel } from '../components/screening/TopFiveCarousel'
import { AiAnalysisCards } from '../components/screening/AiAnalysisCards'
import { apiUrl } from '../lib/apiBase'
import { useAppNavigation } from '../hooks/useAppNavigation'
import type { ScreeningBundle } from '../data/mockScreening'

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

const emptyBundle: ScreeningBundle = {
  headlineSub: '',
  sectors: [],
  topFive: [],
  analysesByCode: {},
  aiAnalyses: [],
}

export default function ScreeningPage() {
  const { navigate } = useAppNavigation()
  const [data, setData] = useState<ScreeningBundle | null>(null)
  const [source, setSource] = useState<string | null>(null)
  const [elapsedSec, setElapsedSec] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(apiUrl('/api/screening'))
      const json = (await res.json()) as Record<string, unknown>
      if (!res.ok) {
        const msg = typeof json.error === 'string' ? json.error : `HTTP ${res.status}`
        throw new Error(msg)
      }
      const src = typeof json.source === 'string' ? json.source : 'unknown'
      const el = typeof json.elapsedSec === 'string' ? json.elapsedSec : null
      const payload = { ...json } as Record<string, unknown>
      delete payload.source
      delete payload.elapsedSec
      const generatedAt =
        typeof payload.generatedAt === 'string' && payload.generatedAt
          ? payload.generatedAt
          : new Date().toISOString()
      setData({ ...(payload as unknown as ScreeningBundle), generatedAt })
      setSource(src)
      setElapsedSec(el)
    } catch (e) {
      setData(null)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const refresh = useCallback(() => {
    void fetchData()
  }, [fetchData])

  const goStock = useCallback(
    (code: string) => {
      navigate(`/stocks/${code.replace(/\D/g, '').padStart(6, '0')}`)
    },
    [navigate],
  )

  const cacheHint =
    source === 'cache' && data?.generatedAt
      ? `${formatTime(data.generatedAt)} 분석 · 서버 메모리 캐시(1시간)`
      : source === 'fresh' && elapsedSec
        ? `방금 분석 완료 · 소요 ${elapsedSec}s`
        : null

  if (loading && !data) {
    return (
      <main className="mx-auto flex min-h-[50vh] w-full min-w-0 max-w-lg flex-col items-center justify-center gap-4 overflow-x-hidden px-4 py-16 text-center">
        <Loader2 className="size-10 animate-spin text-secondary" aria-hidden />
        <p className="text-sm font-medium text-primary">40종목 분석 중…</p>
        <p className="max-w-sm text-xs leading-relaxed text-secondary">
          KIS 호출이 많아 첫 요청은 약 60~120초 걸릴 수 있습니다. 이후 1시간 동안은 캐시로 빠르게 표시됩니다.
        </p>
      </main>
    )
  }

  if (error) {
    return (
      <main className="mx-auto max-w-lg space-y-4 overflow-x-hidden px-4 py-16 text-center">
        <p className="text-sm font-medium text-rose-800">{error}</p>
        <button
          type="button"
          onClick={() => void fetchData()}
          className="inline-flex items-center gap-2 rounded-xl border border-default bg-card px-4 py-2.5 text-sm font-medium text-primary transition hover:bg-app"
        >
          <RefreshCw className="size-4" strokeWidth={2} aria-hidden />
          다시 시도
        </button>
      </main>
    )
  }

  const bundle = data ?? emptyBundle
  const refreshedAt = bundle.generatedAt ? new Date(bundle.generatedAt) : new Date()

  return (
    <main className="mx-auto w-full min-w-0 max-w-6xl space-y-6 overflow-x-hidden px-4 py-6 sm:px-6 sm:py-8">
      <ScreeningHeader
        subtitle={bundle.headlineSub || '룰 기반 점수 · 40종목'}
        refreshedAt={refreshedAt}
        onRefresh={refresh}
        cacheHint={cacheHint}
      />
      {bundle.sectors.length === 0 ? (
        <p className="text-center text-sm text-secondary">표시할 스크리닝 데이터가 없습니다.</p>
      ) : (
        <>
          <SectorGrid sectors={bundle.sectors} onSelectStock={goStock} />
          <TopFiveCarousel rows={bundle.topFive} onSelectRow={goStock} />
          {bundle.aiAnalyses && bundle.aiAnalyses.length > 0 ? (
            <AiAnalysisCards analyses={bundle.aiAnalyses} topFive={bundle.topFive} />
          ) : null}
        </>
      )}
    </main>
  )
}
