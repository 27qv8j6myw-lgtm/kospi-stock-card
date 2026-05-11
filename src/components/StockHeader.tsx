import type { ReactNode } from 'react'

type StockHeaderProps = {
  title: string
  subtitle: string
  asOfDate: string
  /** 타이틀 왼쪽 (예: 우상향 아이콘) */
  leading?: ReactNode
}

export function StockHeader({ title, subtitle, asOfDate, leading }: StockHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-5 sm:px-8">
      <div className="flex min-w-0 items-center gap-3">
        {leading ? <span className="shrink-0">{leading}</span> : null}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
      </div>
      <p className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500">
        {asOfDate}
      </p>
    </header>
  )
}
