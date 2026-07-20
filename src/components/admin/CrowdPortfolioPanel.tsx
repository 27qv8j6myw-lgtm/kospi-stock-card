'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowLeftRight, Layers, Loader2, PieChart, RotateCw, Users } from 'lucide-react'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'

type DailyPoint = { date: string; buy: number; sell: number }
type NetFlowRow = {
  code: string
  name: string
  netUsers: number
  buyCount: number
  sellCount: number
}
type BuySell = {
  days: number
  buyCount: number
  sellCount: number
  buyRatio: number | null
  daily: DailyPoint[]
  netFlow7d: NetFlowRow[]
}
type SectorRow = { sector: string; value: number; valuePct: number; positions: number }
type Pnl = {
  profitPositions: number
  lossPositions: number
  flatPositions: number
  profitValue: number
  lossValue: number
  realizedWin: number
  realizedLoss: number
}
type OverlapRow = {
  code: string
  name: string
  sector: string
  holders: number
  avgPnlPct: number | null
}
type Overlap = { multiHolderCount: number; totalHeldCodes: number; top: OverlapRow[] }
type HoldersRankRow = {
  code: string
  name: string
  sector: string
  holders: number
  qty: number
}

type CrowdPortfolio = {
  buySell: BuySell
  sectors: SectorRow[]
  pnl: Pnl
  overlap: Overlap
  holdersRank: HoldersRankRow[]
  generatedAt: string
}

const SECTOR_BAR_COLORS = [
  'bg-violet-500',
  'bg-sky-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-indigo-500',
  'bg-teal-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-lime-500',
  'bg-cyan-500',
  'bg-fuchsia-500',
]

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

function formatWon(n: number): string {
  return `${n >= 0 ? '+' : ''}${Math.round(n).toLocaleString('ko-KR')}원`
}

function Card({
  icon,
  title,
  subtitle,
  children,
  className,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-2xl border border-default bg-card shadow-sm ${className ?? ''}`}>
      <div className="flex items-center gap-1.5 border-b border-default px-4 py-3">
        {icon}
        <h3 className="text-xs font-bold text-primary">{title}</h3>
        {subtitle ? <span className="text-[10px] text-gray-400">{subtitle}</span> : null}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function BuySellCard({ data }: { data: BuySell }) {
  const total = data.buyCount + data.sellCount
  const buyPct = data.buyRatio != null ? data.buyRatio * 100 : 0
  const sellPct = 100 - buyPct
  const daily = data.daily ?? []
  const netFlow7d = data.netFlow7d ?? []
  const maxDaily = Math.max(1, ...daily.map((d) => d.buy + d.sell))

  if (total === 0) {
    return <p className="py-6 text-center text-[12px] text-gray-400">최근 거래가 없습니다</p>
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 flex items-center justify-between text-[11px] font-semibold">
          <span className="text-red-600">매수 {data.buyCount.toLocaleString('ko-KR')}건</span>
          <span className="text-blue-600">매도 {data.sellCount.toLocaleString('ko-KR')}건</span>
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-gray-100">
          <div className="bg-red-500" style={{ width: `${buyPct}%` }} aria-hidden />
          <div className="bg-blue-500" style={{ width: `${sellPct}%` }} aria-hidden />
        </div>
        <div className="mt-1 text-[10px] text-gray-400">
          매수 비중 {buyPct.toFixed(0)}% · 최근 {data.days}일
        </div>
      </div>

      <div>
        <div className="mb-1 text-[10px] text-gray-400">최근 14일 일별 추이</div>
        <div className="flex items-end gap-0.5" style={{ height: 56 }}>
          {daily.map((d) => {
            const sum = d.buy + d.sell
            const h = (sum / maxDaily) * 100
            const buyH = sum > 0 ? (d.buy / sum) * 100 : 0
            return (
              <div
                key={d.date}
                className="flex flex-1 flex-col justify-end"
                style={{ height: '100%' }}
                title={`${d.date.slice(5)} · 매수 ${d.buy} / 매도 ${d.sell}`}
              >
                <div
                  className="flex w-full flex-col justify-end overflow-hidden rounded-sm bg-gray-100"
                  style={{ height: `${Math.max(h, sum > 0 ? 6 : 0)}%` }}
                >
                  <div className="w-full bg-red-400" style={{ height: `${buyH}%` }} aria-hidden />
                  <div className="w-full flex-1 bg-blue-400" aria-hidden />
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-1 flex gap-0.5">
          {daily.map((d) => (
            <div
              key={d.date}
              className="flex-1 text-center text-[8px] leading-tight tabular-nums text-gray-400"
            >
              {d.date.slice(8)}
            </div>
          ))}
        </div>
        <div className="mt-0.5 text-right text-[9px] tabular-nums text-gray-400">
          {daily[0]?.date.slice(5).replace('-', '.')} ~{' '}
          {daily[daily.length - 1]?.date.slice(5).replace('-', '.')}
        </div>
      </div>

      {netFlow7d.length > 0 ? (
        <div>
          <div className="mb-1 text-[10px] text-gray-400">최근 7일 순매매 (매수 - 매도 사용자)</div>
          <ul className="divide-y divide-default">
            {netFlow7d.map((s, i) => (
              <li key={s.code} className="flex items-center gap-2.5 py-1.5 text-sm">
                <span className="w-4 shrink-0 text-center text-[11px] font-bold tabular-nums text-gray-400">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-semibold text-gray-900">{s.name}</div>
                  <div className="truncate text-[10px] tabular-nums text-gray-400">
                    {s.code} · 매수 {s.buyCount} · 매도 {s.sellCount}
                  </div>
                </div>
                <div
                  className={`shrink-0 text-[12px] font-bold tabular-nums ${pnlClass(s.netUsers)}`}
                >
                  {s.netUsers > 0 ? '순매수' : s.netUsers < 0 ? '순매도' : '중립'}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function SectorCard({ rows }: { rows: SectorRow[] }) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-[12px] text-gray-400">보유 데이터가 없습니다</p>
  }
  return (
    <ul className="space-y-2">
      {rows.map((r, i) => (
        <li key={r.sector}>
          <div className="mb-0.5 flex items-center justify-between text-[11px]">
            <span className="truncate font-semibold text-gray-700">{r.sector}</span>
            <span className="shrink-0 tabular-nums text-gray-500">
              {r.valuePct.toFixed(1)}% · {r.positions}건
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full ${SECTOR_BAR_COLORS[i % SECTOR_BAR_COLORS.length]}`}
              style={{ width: `${Math.max(r.valuePct, 1)}%` }}
              aria-hidden
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

function PnlCard({ data }: { data: Pnl }) {
  const totalPos = data.profitPositions + data.lossPositions + data.flatPositions
  if (totalPos === 0) {
    return <p className="py-6 text-center text-[12px] text-gray-400">보유 포지션이 없습니다</p>
  }
  const profitPct = (data.profitPositions / totalPos) * 100
  const lossPct = (data.lossPositions / totalPos) * 100
  const flatPct = 100 - profitPct - lossPct
  const realizedTotal = data.realizedWin + data.realizedLoss

  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 flex items-center justify-between text-[11px] font-semibold">
          <span className="text-red-600">수익 {data.profitPositions}</span>
          <span className="text-gray-400">본전 {data.flatPositions}</span>
          <span className="text-blue-600">손실 {data.lossPositions}</span>
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-gray-100">
          <div className="bg-red-500" style={{ width: `${profitPct}%` }} aria-hidden />
          <div className="bg-gray-300" style={{ width: `${flatPct}%` }} aria-hidden />
          <div className="bg-blue-500" style={{ width: `${lossPct}%` }} aria-hidden />
        </div>
        <div className="mt-1 text-[10px] text-gray-400">
          수익 포지션 {profitPct.toFixed(0)}% · 총 {totalPos}개 포지션
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-lg bg-gray-50 px-2.5 py-2">
          <div className="text-gray-400">미실현 손익</div>
          <div className={`font-bold tabular-nums ${pnlClass(data.profitValue + data.lossValue)}`}>
            {formatWon(data.profitValue + data.lossValue)}
          </div>
        </div>
        <div className="rounded-lg bg-gray-50 px-2.5 py-2">
          <div className="text-gray-400">최근 30일 실현 승/패</div>
          <div className="font-bold tabular-nums text-gray-700">
            <span className="text-red-600">{data.realizedWin}승</span>{' '}
            <span className="text-blue-600">{data.realizedLoss}패</span>
            {realizedTotal > 0 ? (
              <span className="ml-1 text-[10px] font-normal text-gray-400">
                ({((data.realizedWin / realizedTotal) * 100).toFixed(0)}%)
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function OverlapCard({ data }: { data: Overlap }) {
  if (data.top.length === 0) {
    return (
      <p className="py-6 text-center text-[12px] text-gray-400">중복 보유 종목이 없습니다</p>
    )
  }
  return (
    <div className="space-y-2">
      <div className="text-[10px] text-gray-400">
        2명 이상 보유 {data.multiHolderCount}종목 · 전체 보유 {data.totalHeldCodes}종목
      </div>
      <ul className="divide-y divide-default">
        {data.top.map((s, i) => (
          <li key={s.code} className="flex items-center gap-2.5 py-2 text-sm">
            <span className="w-4 shrink-0 text-center text-[11px] font-bold tabular-nums text-gray-400">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-gray-900">{s.name}</div>
              <div className="truncate text-[10px] tabular-nums text-gray-400">
                {s.code} · {s.sector}
              </div>
            </div>
            <div className="shrink-0 text-right">
              {s.avgPnlPct != null ? (
                <div className={`text-[13px] font-bold tabular-nums ${pnlClass(s.avgPnlPct)}`}>
                  {s.avgPnlPct >= 0 ? '+' : ''}
                  {s.avgPnlPct.toFixed(1)}%
                </div>
              ) : (
                <div className="text-[12px] text-gray-300">—</div>
              )}
              <div className="text-[10px] tabular-nums text-gray-400">{s.holders}명</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function HoldersRankCard({ rows }: { rows: HoldersRankRow[] }) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-[12px] text-gray-400">보유 종목이 없습니다</p>
  }
  return (
    <ul className="divide-y divide-default">
      {rows.map((s, i) => (
        <li key={s.code} className="flex items-center gap-2.5 py-2 text-sm">
          <span className="w-4 shrink-0 text-center text-[11px] font-bold tabular-nums text-gray-400">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold text-gray-900">{s.name}</div>
            <div className="truncate text-[10px] tabular-nums text-gray-400">
              {s.code} · {s.sector}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[13px] font-bold tabular-nums text-gray-900">{s.holders}명</div>
          </div>
        </li>
      ))}
    </ul>
  )
}

export function CrowdPortfolioPanel() {
  const [data, setData] = useState<CrowdPortfolio | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (refresh = false) => {
    setLoading(true)
    setError(null)
    try {
      const r = await authFetch(
        apiUrl(`/api/admin-crowd-portfolio${refresh ? '?refresh=1' : ''}`),
      )
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error || r.statusText)
      }
      setData((await r.json()) as CrowdPortfolio)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const r = await authFetch(apiUrl('/api/admin-crowd-portfolio'))
        if (!r.ok) {
          const body = (await r.json().catch(() => ({}))) as { error?: string }
          throw new Error(body.error || r.statusText)
        }
        const payload = (await r.json()) as CrowdPortfolio
        if (active) {
          setData(payload)
          setError(null)
        }
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : String(e))
          setData(null)
        }
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-bold text-primary">사용자 포트폴리오 종합</h2>
        {data ? (
          <span className="text-[10px] text-gray-400">{formatSeoul(data.generatedAt)} 기준</span>
        ) : null}
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={loading}
          aria-label="포트폴리오 종합 새로고침"
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
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Card
            icon={<ArrowLeftRight size={14} className="text-gray-500" aria-hidden />}
            title="매수/매도 패턴"
            subtitle="최근 30일 · 순매매 7일"
            className="lg:col-span-2"
          >
            <BuySellCard data={data.buySell} />
          </Card>

          <Card
            icon={<PieChart size={14} className="text-gray-500" aria-hidden />}
            title="섹터 비중"
            subtitle="평가액 기준"
          >
            <SectorCard rows={data.sectors} />
          </Card>

          <Card
            icon={<Layers size={14} className="text-gray-500" aria-hidden />}
            title="수익/손해 비중"
            subtitle="보유 포지션 기준"
          >
            <PnlCard data={data.pnl} />
          </Card>

          <Card
            icon={<Users size={14} className="text-gray-500" aria-hidden />}
            title="보유종목 순위"
            subtitle="보유자 수 기준"
          >
            <HoldersRankCard rows={data.holdersRank ?? []} />
          </Card>

          <Card
            icon={<Users size={14} className="text-gray-500" aria-hidden />}
            title="중복 보유 종목"
            subtitle="2명 이상"
          >
            <OverlapCard data={data.overlap} />
          </Card>
        </div>
      ) : null}
    </section>
  )
}
