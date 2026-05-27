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

function IndexItem({ idx, compact }: { idx: MarketSummaryIndex; compact?: boolean }) {
  const labelCls = compact
    ? 'text-[12px] font-bold text-gray-700'
    : 'text-[11px] font-medium tracking-tight text-gray-400'
  const valueCls = compact
    ? 'text-[12px] text-gray-900 tabular-nums'
    : 'text-xs font-semibold tabular-nums tracking-tight text-gray-900'
  const changeCls = compact ? 'text-[11px] font-bold tabular-nums' : 'text-[11px] font-medium tabular-nums tracking-tight'

  return (
    <div className="inline-flex flex-shrink-0 items-center gap-2 whitespace-nowrap">
      <span className={labelCls}>{idx.label}</span>
      <span className={valueCls}>{formatValue(idx)}</span>
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
  const outerClass = className ?? stripOuterClass

  useEffect(() => {
    const load = () => {
      fetch('/api/market-summary')
        .then((r) => r.json())
        .then((data) => setIndices(Array.isArray(data.indices) ? data.indices : []))
        .catch(() => {})
        .finally(() => setLoading(false))
    }

    load()
    const interval = setInterval(load, 60_000)
    return () => clearInterval(interval)
  }, [])

  if (loading || indices.length === 0) {
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

  if (variant === 'pro') {
    return (
      <div className={outerClass}>
        <div className="overflow-hidden border-b border-gray-200 bg-white">
          <div className="md:hidden overflow-hidden">
            <div className="ticker-mobile-scroll flex items-center gap-6 whitespace-nowrap px-3 py-2">
              {indices.map((idx) => (
                <IndexItem key={idx.key} idx={idx} compact />
              ))}
              {indices.map((idx) => (
                <div key={`dup-${idx.key}`} aria-hidden="true">
                  <IndexItem idx={idx} compact />
                </div>
              ))}
            </div>
          </div>
          <div className="mx-auto hidden max-w-[1200px] items-center justify-between gap-4 px-4 py-2 md:flex">
            {indices.map((idx) => (
              <IndexItem key={idx.key} idx={idx} compact />
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
