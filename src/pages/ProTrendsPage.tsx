'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { ArrowLeft, BarChart3, Flame, Loader2, Sparkles } from 'lucide-react'
import { useAppNavigation } from '@/hooks/useAppNavigation'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'
import { PRO_CONTENT_WRAP, PRO_ICON, proDesign } from '@/lib/proStockDesign'

type TrendStock = { code: string; name: string; count: number }
type TrendSector = { sector: string; count: number }

type ProTrendsResponse = {
  popularStocks: TrendStock[]
  aiAnalyzed: TrendStock[]
  sectorDistribution: TrendSector[]
}

function TrendCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-4">{children}</div>
  )
}

function CardHeading({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-1.5">
      {icon}
      <h2 className="text-[14px] font-bold text-gray-900">{title}</h2>
    </div>
  )
}

function StockTrendCard({
  title,
  icon,
  stocks,
  barClass,
  countSuffix,
  emptyLabel,
  onPick,
}: {
  title: string
  icon: ReactNode
  stocks: TrendStock[]
  barClass: string
  countSuffix: string
  emptyLabel: string
  onPick: (code: string, name: string) => void
}) {
  const max = stocks[0]?.count || 1

  return (
    <TrendCard>
      <CardHeading icon={icon} title={title} />
      <div className="min-h-0 flex-1 space-y-2">
        {stocks.length === 0 ? (
          <p className="py-4 text-center text-[12px] text-gray-300">{emptyLabel}</p>
        ) : (
          stocks.map((s, i) => (
            <div
              key={s.code}
              role="button"
              tabIndex={0}
              onClick={() => onPick(s.code, s.name)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onPick(s.code, s.name)
                }
              }}
              className="cursor-pointer rounded px-1 py-1 hover:bg-gray-50"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[12px] text-gray-900">
                  <span className="mr-1 text-gray-400">{i + 1}</span>
                  {s.name}
                </span>
                <span className="shrink-0 text-[11px] font-bold tabular-nums text-gray-600">
                  {s.count}
                  {countSuffix}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full ${barClass}`}
                  style={{ width: `${(s.count / max) * 100}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </TrendCard>
  )
}

function SectorTrendCard({
  sectors,
}: {
  sectors: TrendSector[]
}) {
  const max = sectors[0]?.count || 1

  return (
    <TrendCard>
      <CardHeading
        icon={<BarChart3 {...PRO_ICON} className="text-purple-500" aria-hidden />}
        title="섹터별 관심도"
      />
      <div className="min-h-0 flex-1 space-y-2">
        {sectors.length === 0 ? (
          <p className="py-4 text-center text-[12px] text-gray-300">최근 7일 데이터 없음</p>
        ) : (
          sectors.map((s) => (
            <div key={s.sector} className="px-1 py-1">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[12px] text-gray-900">{s.sector}</span>
                <span className="shrink-0 text-[11px] font-bold tabular-nums text-gray-600">{s.count}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-purple-400"
                  style={{ width: `${(s.count / max) * 100}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </TrendCard>
  )
}

export default function ProTrendsPage() {
  const { navigate } = useAppNavigation()
  const [data, setData] = useState<ProTrendsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const r = await authFetch(apiUrl('/api/pro-trends'))
        if (!r.ok) {
          const body = (await r.json().catch(() => ({}))) as { error?: string }
          throw new Error(body.error || r.statusText)
        }
        const json = (await r.json()) as ProTrendsResponse
        if (!cancelled) setData(json)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e))
          setData(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const goStock = (code: string, name: string) => {
    navigate(`/pro/stock/${code}?name=${encodeURIComponent(name)}`)
  }

  return (
    <div className="min-h-screen w-full min-w-0 max-w-full bg-gray-50">
      <div className={`${proDesign.stickyBar} border-b border-gray-200 bg-white`}>
        <div className={`${PRO_CONTENT_WRAP} flex items-center gap-3 py-3`}>
          <button
            type="button"
            onClick={() => navigate('/pro')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 hover:border-gray-400"
            aria-label="Pro 홈으로"
          >
            <ArrowLeft size={18} strokeWidth={2} aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-[16px] font-bold text-gray-900">마켓 트렌드</h1>
            <p className="text-[11px] text-gray-500">최근 7일 · 전체 익명 집계</p>
          </div>
        </div>
      </div>

      <div className={`${PRO_CONTENT_WRAP} py-4 pb-12`}>
        {loading ? (
          <div className="flex justify-center py-16 text-gray-400">
            <Loader2 className="size-7 animate-spin" aria-hidden />
          </div>
        ) : error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
        ) : data ? (
          <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-3">
            <StockTrendCard
              title="인기 종목"
              icon={<Flame {...PRO_ICON} className="text-amber-600" aria-hidden />}
              stocks={data.popularStocks}
              barClass="bg-amber-400"
              countSuffix="회"
              emptyLabel="최근 7일 데이터 없음"
              onPick={goStock}
            />
            <StockTrendCard
              title="AI 분석 많은 종목"
              icon={<Sparkles {...PRO_ICON} className="text-blue-500" aria-hidden />}
              stocks={data.aiAnalyzed}
              barClass="bg-blue-400"
              countSuffix="회"
              emptyLabel="아직 없음"
              onPick={goStock}
            />
            <SectorTrendCard sectors={data.sectorDistribution} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
