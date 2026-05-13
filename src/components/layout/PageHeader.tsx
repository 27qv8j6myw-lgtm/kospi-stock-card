'use client'

import { useEffect, useState } from 'react'
import { apiUrl } from '@/lib/apiBase'

export type IndexCellData = {
  label: string
  format: 'price' | 'index' | 'usd'
  price: number
  changePct: number
}

export type MarketIndicesPayload = {
  indices: {
    usdkrw?: IndexCellData
    kospi?: IndexCellData
    kospi200?: IndexCellData
    wti?: IndexCellData
  }
  generatedAt?: string
  source?: string
}

function formatKstClock(): string {
  return (
    new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date()) + ' KST'
  )
}

function formatGeneratedAt(iso: string | undefined): string {
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

type Props = {
  title?: string
  /** 종목 시세 기준일 (선택) */
  asOfDate?: string
}

export function PageHeader({ title = '종목 카드', asOfDate }: Props) {
  const [data, setData] = useState<MarketIndicesPayload | null>(null)
  const [now, setNow] = useState('')

  useEffect(() => {
    const updateTime = () => setNow(formatKstClock())
    updateTime()
    const timer = window.setInterval(updateTime, 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let cancelled = false
    let pollTimer: number | null = null

    const load = async () => {
      if (typeof document !== 'undefined' && document.hidden) return
      try {
        const res = await fetch(apiUrl('/api/market-indices'))
        if (!res.ok) return
        const json = (await res.json()) as MarketIndicesPayload
        if (!cancelled) setData(json)
      } catch (e) {
        console.error('[PageHeader] fetch failed:', e)
      }
    }

    const startPoll = () => {
      if (pollTimer != null) {
        window.clearInterval(pollTimer)
        pollTimer = null
      }
      pollTimer = window.setInterval(() => void load(), 5 * 60 * 1000)
    }

    const onVisibility = () => {
      if (document.hidden) {
        if (pollTimer != null) {
          window.clearInterval(pollTimer)
          pollTimer = null
        }
      } else {
        void load()
        startPoll()
      }
    }

    void load()
    startPoll()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      if (pollTimer != null) window.clearInterval(pollTimer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  const idx = data?.indices

  return (
    <header className="flex flex-col gap-4 border-b border-default px-6 py-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:px-8">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">{title}</h1>
        {asOfDate ? <p className="mt-1 text-sm text-secondary">종목 기준 {asOfDate}</p> : null}
        <p className="mt-1 text-xs text-tertiary">{now}</p>
        {data?.generatedAt ? (
          <p className="mt-1 text-xxs text-tertiary">
            지수 갱신: {formatGeneratedAt(data.generatedAt)}
            {data.source === 'cache' ? ' · 캐시' : null}
          </p>
        ) : null}
      </div>

      <div className="grid w-full min-w-0 grid-cols-2 gap-3 sm:w-auto sm:max-w-none sm:grid-cols-none sm:flex sm:flex-wrap sm:justify-end sm:gap-3">
        <IndexCell data={idx?.usdkrw} />
        <IndexCell data={idx?.kospi} />
        <IndexCell data={idx?.kospi200} />
        <IndexCell data={idx?.wti} />
      </div>
    </header>
  )
}

function IndexCell({ data }: { data?: IndexCellData }) {
  if (!data) {
    return (
      <div className="rounded-lg border border-light bg-neutral-bg/50 px-3 py-2 text-center sm:min-w-[5.5rem]">
        <p className="text-xxs font-medium text-tertiary">—</p>
        <p className="mt-1 font-sans-en text-sm font-semibold text-secondary">—</p>
        <p className="mt-0.5 font-sans-en text-xs text-tertiary">—</p>
      </div>
    )
  }

  const formatted = formatPrice(data.price, data.format)
  const up = data.changePct > 0
  const down = data.changePct < 0
  const changeCls = up ? 'text-price-up' : down ? 'text-price-down' : 'text-secondary'
  const changeSign = up ? '+' : ''

  return (
    <div className="rounded-lg border border-light bg-card px-3 py-2 text-center shadow-sm sm:min-w-[5.5rem]">
      <p className="text-xxs font-semibold text-secondary">{data.label}</p>
      <p className="mt-1 font-sans-en text-sm font-bold tabular-nums text-primary">{formatted}</p>
      <p className={`mt-0.5 font-sans-en text-xs font-semibold tabular-nums ${changeCls}`}>
        {changeSign}
        {data.changePct.toFixed(2)}%
      </p>
    </div>
  )
}

function formatPrice(price: number, format: string): string {
  switch (format) {
    case 'price':
      return price.toLocaleString('ko-KR', { maximumFractionDigits: 1 })
    case 'index':
      return price.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    case 'usd':
      return `$${price.toFixed(2)}`
    default:
      return price.toFixed(2)
  }
}
