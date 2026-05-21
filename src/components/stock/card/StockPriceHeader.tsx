import type { ReactNode } from 'react'
import { changeToneClass, stockCardTokens } from '@/lib/stockCardDesignTokens'

type Props = {
  name: string
  code: string
  market?: string
  currentPrice?: number | null
  changePct?: number | null
  badge?: ReactNode
}

export function StockPriceHeader({
  name,
  code,
  market,
  currentPrice,
  changePct,
  badge,
}: Props) {
  const t = stockCardTokens.price
  const pct = changePct ?? 0
  const subtitle = [code, market].filter(Boolean).join(' · ')

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h1 className={t.name}>{name}</h1>
        {badge}
      </div>
      {subtitle ? <p className={t.subtitle}>{subtitle}</p> : null}
      <div className="mt-3 flex flex-wrap items-baseline gap-2.5">
        <span className={t.current}>
          {currentPrice != null ? `${currentPrice.toLocaleString()}원` : '—'}
        </span>
        <span className={`${t.change} ${changeToneClass(pct)}`}>
          {pct > 0 ? '+' : ''}
          {pct.toFixed(2)}%
        </span>
      </div>
    </div>
  )
}
