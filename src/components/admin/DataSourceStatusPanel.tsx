'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RotateCw } from 'lucide-react'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'

type LiveCheck = { ok: boolean; ms: number; error?: string }

type DataSourceStatus = {
  kisEnv: string
  kisToken: {
    exists: boolean
    savedAt: string | null
    expiresAt: string | null
    expired: boolean | null
  }
  caches: Array<{ key: string; exists: boolean; expiresAt: string | null; fresh: boolean }>
  live: { kis: LiveCheck; yahoo: LiveCheck }
  generatedAt: string
}

const CACHE_LABEL: Record<string, string> = {
  'market-summary': '지수 요약 캐시 (5분)',
  'market-summary:last-good': '지수 last-good 캐시 (7일)',
  'top-volume-kospi': '거래대금 TOP 캐시 (5분)',
  'top-momentum-kospi200': '모멘텀 TOP 캐시 (1시간)',
}

function formatSeoul(iso: string | null): string {
  if (!iso) return '—'
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

function StatusDot({ level }: { level: 'ok' | 'warn' | 'fail' }) {
  const cls =
    level === 'ok' ? 'bg-emerald-500' : level === 'warn' ? 'bg-amber-500' : 'bg-red-500'
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${cls}`} aria-hidden />
}

function StatusRow({
  level,
  label,
  detail,
}: {
  level: 'ok' | 'warn' | 'fail'
  label: string
  detail: string
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5 text-sm">
      <StatusDot level={level} />
      <span className="min-w-0 flex-1 truncate font-medium text-primary">{label}</span>
      <span className="shrink-0 text-[11px] tabular-nums text-secondary">{detail}</span>
    </li>
  )
}

export function DataSourceStatusPanel() {
  const [status, setStatus] = useState<DataSourceStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await authFetch(apiUrl('/api/admin-datasource-status'))
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error || r.statusText)
      }
      setStatus((await r.json()) as DataSourceStatus)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setStatus(null)
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
        <h2 className="text-sm font-bold text-primary">데이터소스 상태</h2>
        {status ? (
          <span className="text-[10px] text-gray-400">
            {formatSeoul(status.generatedAt)} 기준 · KIS {status.kisEnv}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          aria-label="상태 새로고침"
          className="ml-auto rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
        >
          <RotateCw size={14} className={loading ? 'animate-spin' : undefined} aria-hidden />
        </button>
      </div>

      {loading && !status ? (
        <div className="flex justify-center py-8 text-secondary">
          <Loader2 className="size-6 animate-spin" aria-hidden />
        </div>
      ) : error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : status ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-default bg-card shadow-sm">
            <h3 className="border-b border-default px-4 py-3 text-xs font-bold text-primary">
              외부 API 라이브 체크
            </h3>
            <ul className="divide-y divide-default">
              <StatusRow
                level={status.live.kis.ok ? 'ok' : 'fail'}
                label="KIS 시세 (삼성전자)"
                detail={
                  status.live.kis.ok
                    ? `정상 · ${status.live.kis.ms}ms`
                    : status.live.kis.error || '실패'
                }
              />
              <StatusRow
                level={status.live.yahoo.ok ? 'ok' : 'fail'}
                label="Yahoo 폴백 (^KS11)"
                detail={
                  status.live.yahoo.ok
                    ? `정상 · ${status.live.yahoo.ms}ms`
                    : status.live.yahoo.error || '실패'
                }
              />
              <StatusRow
                level={
                  status.kisToken.exists && status.kisToken.expired === false ? 'ok' : 'warn'
                }
                label="KIS 공유 토큰"
                detail={
                  status.kisToken.exists
                    ? `${status.kisToken.expired ? '만료' : '유효'} · ~${formatSeoul(status.kisToken.expiresAt)}`
                    : '없음 (다음 호출 시 발급)'
                }
              />
            </ul>
          </div>

          <div className="rounded-2xl border border-default bg-card shadow-sm">
            <h3 className="border-b border-default px-4 py-3 text-xs font-bold text-primary">
              서버 캐시 신선도
            </h3>
            <ul className="divide-y divide-default">
              {status.caches.map((c) => (
                <StatusRow
                  key={c.key}
                  level={c.fresh ? 'ok' : c.exists ? 'warn' : 'fail'}
                  label={CACHE_LABEL[c.key] || c.key}
                  detail={
                    c.exists
                      ? `${c.fresh ? '유효' : '만료'} · ~${formatSeoul(c.expiresAt)}`
                      : '없음'
                  }
                />
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  )
}
