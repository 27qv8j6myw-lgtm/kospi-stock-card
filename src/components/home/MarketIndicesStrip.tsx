'use client'

import { useEffect, useState } from 'react'

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

function IndexItem({ idx }: { idx: MarketSummaryIndex }) {
  return (
    <div className="inline-flex flex-shrink-0 items-center gap-2">
      <span className="text-[11px] font-medium tracking-tight text-gray-400">{idx.label}</span>
      <span className="text-xs font-semibold tabular-nums tracking-tight text-gray-900">
        {formatValue(idx)}
      </span>
      {idx.change != null && Number.isFinite(idx.change) ? (
        <span
          className={`text-[11px] font-medium tabular-nums tracking-tight ${
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

/** 부모(`main` px-4 sm:px-6 · 홈 컨테이너) 패딩만 사용 — 알약에 추가 px 넣지 않음 */
const stripOuterClass = 'mb-6 w-full'

export function MarketIndicesStrip() {
  const [indices, setIndices] = useState<MarketSummaryIndex[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/market-summary')
      .then((r) => r.json())
      .then((data) => setIndices(Array.isArray(data.indices) ? data.indices : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading || indices.length === 0) {
    return (
      <div className={stripOuterClass}>
        <div className="h-[44px] rounded-full border border-gray-200 bg-white" />
      </div>
    )
  }

  return (
    <div className={stripOuterClass}>
      <div className="overflow-hidden rounded-full border border-gray-200 bg-white md:overflow-visible">
        <div className="ticker-mobile-scroll flex items-center justify-center gap-7 whitespace-nowrap px-5 py-[11px]">
          {indices.map((idx) => (
            <IndexItem key={idx.key} idx={idx} />
          ))}
          {indices.map((idx) => (
            <div key={`dup-${idx.key}`} className="contents md:hidden" aria-hidden="true">
              <IndexItem idx={idx} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
