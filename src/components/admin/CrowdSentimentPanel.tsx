'use client'

import { useCallback, useEffect, useState } from 'react'
import { Eye, Loader2, RotateCw, TrendingUp, Wallet } from 'lucide-react'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'

type HeldRow = { code: string; name: string; holders: number; avgPnlPct: number | null }
type WatchRow = { code: string; name: string; watchers: number }
type FlowRow = {
  code: string
  name: string
  netUsers: number
  buyCount: number
  sellCount: number
}

type CrowdSentiment = {
  mostHeld: HeldRow[]
  mostWatched: WatchRow[]
  netFlow7d: FlowRow[]
  generatedAt: string
}

function formatSeoul(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return '—'
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

function pnlClass(n: number): string {
  if (n > 0) return 'text-red-600'
  if (n < 0) return 'text-blue-600'
  return 'text-gray-500'
}

function StockRow({
  rank,
  code,
  name,
  right,
}: {
  rank: number
  code: string
  name: string
  right: React.ReactNode
}) {
  return (
    <li className="flex items-center gap-2.5 px-4 py-2.5 text-sm">
      <span className="w-4 shrink-0 text-center text-[11px] font-bold tabular-nums text-gray-400">
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-gray-900">{name}</div>
        <div className="truncate text-[10px] tabular-nums text-gray-400">{code}</div>
      </div>
      <div className="shrink-0 text-right">{right}</div>
    </li>
  )
}

function Board({
  icon,
  title,
  subtitle,
  children,
  empty,
  isEmpty,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  children: React.ReactNode
  empty: string
  isEmpty: boolean
}) {
  return (
    <div className="rounded-2xl border border-default bg-card shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-default px-4 py-3">
        {icon}
        <h3 className="text-xs font-bold text-primary">{title}</h3>
        {subtitle ? <span className="text-[10px] text-gray-400">{subtitle}</span> : null}
      </div>
      {isEmpty ? (
        <p className="px-4 py-6 text-center text-[12px] text-gray-400">{empty}</p>
      ) : (
        <ul className="divide-y divide-default">{children}</ul>
      )}
    </div>
  )
}

export function CrowdSentimentPanel() {
  const [data, setData] = useState<CrowdSentiment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (refresh = false) => {
    setLoading(true)
    setError(null)
    try {
      const r = await authFetch(
        apiUrl(`/api/admin-crowd-sentiment${refresh ? '?refresh=1' : ''}`),
      )
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error || r.statusText)
      }
      setData((await r.json()) as CrowdSentiment)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-bold text-primary">사용자 집단심리</h2>
        {data ? (
          <span className="text-[10px] text-gray-400">{formatSeoul(data.generatedAt)} 기준</span>
        ) : null}
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={loading}
          aria-label="집단심리 새로고침"
          className="ml-auto rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
        >
          <RotateCw size={14} className={loading ? 'animate-spin' : undefined} aria-hidden />
        </button>
      </div>

      {loading && !data ? (
        <div className="flex justify-center py-8 text-secondary">
          <Loader2 className="size-6 animate-spin" aria-hidden />
        </div>
      ) : error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : data ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <Board
            icon={<Wallet size={14} className="text-gray-500" aria-hidden />}
            title="가장 많이 보유"
            subtitle="평균 손익률 · 3명 이상"
            empty="보유 데이터가 없습니다"
            isEmpty={data.mostHeld.length === 0}
          >
            {data.mostHeld.map((s, i) => (
              <StockRow
                key={s.code}
                rank={i + 1}
                code={s.code}
                name={s.name}
                right={
                  <>
                    {s.avgPnlPct != null ? (
                      <div className={`text-[13px] font-bold tabular-nums ${pnlClass(s.avgPnlPct)}`}>
                        {s.avgPnlPct >= 0 ? '+' : ''}
                        {s.avgPnlPct.toFixed(1)}%
                      </div>
                    ) : (
                      <div className="text-[12px] text-gray-300">—</div>
                    )}
                    <div className="text-[10px] tabular-nums text-gray-400">{s.holders}명</div>
                  </>
                }
              />
            ))}
          </Board>

          <Board
            icon={<Eye size={14} className="text-gray-500" aria-hidden />}
            title="가장 많이 관심"
            subtitle="관심 등록 수"
            empty="관심 데이터가 없습니다"
            isEmpty={data.mostWatched.length === 0}
          >
            {data.mostWatched.map((s, i) => (
              <StockRow
                key={s.code}
                rank={i + 1}
                code={s.code}
                name={s.name}
                right={
                  <div className="text-[13px] font-bold tabular-nums text-gray-700">
                    {s.watchers}명
                  </div>
                }
              />
            ))}
          </Board>

          <Board
            icon={<TrendingUp size={14} className="text-gray-500" aria-hidden />}
            title="최근 7일 순매매"
            subtitle="매수 - 매도 사용자"
            empty="거래 기록이 없습니다"
            isEmpty={data.netFlow7d.length === 0}
          >
            {data.netFlow7d.map((s, i) => (
              <StockRow
                key={s.code}
                rank={i + 1}
                code={s.code}
                name={s.name}
                right={
                  <>
                    <div className={`text-[13px] font-bold tabular-nums ${pnlClass(s.netUsers)}`}>
                      {s.netUsers > 0 ? '순매수' : s.netUsers < 0 ? '순매도' : '중립'}
                    </div>
                    <div className="text-[10px] tabular-nums text-gray-400">
                      매수 {s.buyCount} · 매도 {s.sellCount}
                    </div>
                  </>
                }
              />
            ))}
          </Board>
        </div>
      ) : null}
    </section>
  )
}
