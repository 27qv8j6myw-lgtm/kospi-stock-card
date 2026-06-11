'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiUrl } from '@/lib/apiBase'
import { isKrxMarketOpen } from '@/lib/marketHours'

export type MarketSummaryIndex = {
  key: string
  label: string
  value: number | null
  change: number | null
}

function formatValue(idx: MarketSummaryIndex) {
  if (idx.value == null || !Number.isFinite(idx.value)) return '—'
  if (idx.key === 'wti') {
    return `$${idx.value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }
  return idx.value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function IndexItem({
  idx,
  compact,
  showCloseLabel,
}: {
  idx: MarketSummaryIndex
  compact?: boolean
  showCloseLabel?: boolean
}) {
  const labelCls = compact
    ? 'text-[12px] font-bold text-gray-700'
    : 'text-[11px] font-medium tracking-tight text-gray-400'
  const valueCls = compact
    ? 'text-[12px] text-gray-900 tabular-nums'
    : 'text-xs font-semibold tabular-nums tracking-tight text-gray-900'
  const changeCls = compact
    ? 'text-[11px] font-bold tabular-nums'
    : 'text-[11px] font-medium tabular-nums tracking-tight'

  const isKrxIndex = idx.key === 'kospi' || idx.key === 'kosdaq'

  return (
    <div className="inline-flex flex-shrink-0 items-center gap-2 whitespace-nowrap">
      <span className={labelCls}>{idx.label}</span>
      <span className={valueCls}>{formatValue(idx)}</span>
      {showCloseLabel && isKrxIndex && idx.value != null ? (
        <span className="text-[10px] text-gray-400">종가</span>
      ) : null}
      {idx.change != null && Number.isFinite(idx.change) ? (
        <span
          className={`${changeCls} ${
            idx.change > 0 ? 'text-red-600' : idx.change < 0 ? 'text-blue-600' : 'text-gray-500'
          }`}
        >
          {idx.change > 0 ? '+' : ''}
          {idx.change.toFixed(2)}%
        </span>
      ) : null}
    </div>
  )
}

function mergeIndices(
  prev: MarketSummaryIndex[],
  incoming: MarketSummaryIndex[],
): MarketSummaryIndex[] {
  if (!incoming.length) return prev
  const prevByKey = new Map(prev.map((i) => [i.key, i]))
  return incoming.map((idx) => {
    const old = prevByKey.get(idx.key)
    const value =
      idx.value != null && Number.isFinite(idx.value) ? idx.value : (old?.value ?? null)
    const change =
      idx.change != null && Number.isFinite(idx.change) ? idx.change : (old?.change ?? null)
    return { ...idx, value, change }
  })
}

/** 부모(`main` px-4 sm:px-6 · 홈 컨테이너) 패딩만 사용 — 알약에 추가 px 넣지 않음 */
const stripOuterClass = 'mb-6 w-full'

type MarketIndicesStripProps = {
  /** 기본 `mb-6 w-full` — Pro 등에서 여백 조정 */
  className?: string
  /** `pill` 홈·종목카드 알약 / `pro` Pro — 배경 없음·하단 보더만 */
  variant?: 'pill' | 'pro'
}

export function MarketIndicesStrip({ className, variant = 'pill' }: MarketIndicesStripProps = {}) {
  const [indices, setIndices] = useState<MarketSummaryIndex[]>([])
  const [loading, setLoading] = useState(true)
  const indicesRef = useRef<MarketSummaryIndex[]>([])
  const outerClass = className ?? stripOuterClass
  const showCloseLabel = !isKrxMarketOpen()

  const load = useCallback(async (fresh = false) => {
    try {
      const url = fresh ? apiUrl('/api/market-summary?fresh=1') : apiUrl('/api/market-summary')
      const r = await fetch(url, { cache: 'no-store' })
      if (!r.ok) return
      const data = (await r.json()) as { indices?: MarketSummaryIndex[] }
      const rows = Array.isArray(data.indices) ? data.indices : []
      if (!rows.length) return
      setIndices((prev) => {
        const merged = mergeIndices(prev.length ? prev : indicesRef.current, rows)
        indicesRef.current = merged
        return merged
      })
    } catch {
      // keep previous indices on error
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const interval = window.setInterval(() => {
      void load(isKrxMarketOpen())
    }, 60_000)
    return () => window.clearInterval(interval)
  }, [load])

  const hasAnyValue = indices.some((i) => i.value != null && Number.isFinite(i.value))

  if (loading && !hasAnyValue) {
    return (
      <div className={outerClass}>
        {variant === 'pro' ? (
          <div className="h-9 border-b border-gray-200 bg-white" />
        ) : (
          <div className="h-[44px] rounded-full border border-gray-200 bg-white" />
        )}
      </div>
    )
  }

  if (!hasAnyValue) {
    return (
      <div className={outerClass}>
        {variant === 'pro' ? (
          <div className="flex h-9 items-center border-b border-gray-200 bg-white px-3 text-[11px] text-gray-400">
            지수 조회 실패 — 잠시 후 다시 시도
          </div>
        ) : (
          <div className="flex h-[44px] items-center justify-center rounded-full border border-gray-200 bg-white text-[11px] text-gray-400">
            지수 조회 실패
          </div>
        )}
      </div>
    )
  }

  if (variant === 'pro') {
    return (
      <div className={`${outerClass} min-w-0 max-w-full`}>
        <div className="w-full min-w-0 max-w-full overflow-x-clip border-b border-gray-200 bg-white">
          <div className="ticker-pro-track md:hidden">
            <div className="ticker-mobile-scroll flex items-center gap-6 whitespace-nowrap px-3 py-1.5">
              {indices.map((idx) => (
                <IndexItem key={idx.key} idx={idx} compact showCloseLabel={showCloseLabel} />
              ))}
              {indices.map((idx) => (
                <div key={`dup-${idx.key}`} aria-hidden="true">
                  <IndexItem idx={idx} compact showCloseLabel={showCloseLabel} />
                </div>
              ))}
            </div>
          </div>
          <div className="mx-auto hidden w-full min-w-0 max-w-[1200px] items-center justify-between gap-4 px-4 py-1.5 md:flex">
            {indices.map((idx) => (
              <IndexItem key={idx.key} idx={idx} compact showCloseLabel={showCloseLabel} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={outerClass}>
      <div className="overflow-hidden rounded-full border border-gray-200 bg-white md:overflow-visible">
        <div className="ticker-mobile-scroll flex items-center justify-center gap-7 whitespace-nowrap px-5 py-[11px]">
          {indices.map((idx) => (
            <IndexItem key={idx.key} idx={idx} showCloseLabel={showCloseLabel} />
          ))}
          {indices.map((idx) => (
            <div key={`dup-${idx.key}`} className="contents md:hidden" aria-hidden="true">
              <IndexItem idx={idx} showCloseLabel={showCloseLabel} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
