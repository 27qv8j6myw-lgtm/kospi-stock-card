import { Crosshair } from 'lucide-react'
import type { CalculateTargetPricesResult } from '../types/stock'

type TargetPricePanelProps = {
  result: CalculateTargetPricesResult | null
  loading?: boolean
}

function formatKrw(v: number) {
  return `${v.toLocaleString('ko-KR')}원`
}

function formatReturnPct(pct: number) {
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

export function TargetPricePanel({ result, loading }: TargetPricePanelProps) {
  const titleRow = (
    <h3 className="text-lg font-bold tracking-tight text-slate-900">목표가</h3>
  )

  if (loading) {
    return (
      <section className="border-t border-slate-200 px-6 py-6 sm:px-8">
        {titleRow}
        <p className="mt-3 text-xs text-slate-500">계산 중…</p>
      </section>
    )
  }

  if (!result || result.targets.length === 0) {
    return (
      <section className="border-t border-slate-200 px-6 py-6 sm:px-8">
        {titleRow}
        <p className="mt-3 text-xs text-slate-500">종목 가격을 불러오면 목표가가 표시됩니다.</p>
      </section>
    )
  }

  const { targets, warnings, notes } = result

  return (
    <section className="border-t border-slate-200 px-6 py-6 sm:px-8">
      {titleRow}

      {warnings.length > 0 ? (
        <ul className="mt-3 list-inside list-disc space-y-1 text-xs text-amber-800">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}
      {notes.length > 0 ? (
        <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-600">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {targets.map((target) => (
          <article
            key={target.label}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="flex items-center gap-2.5 text-base font-semibold text-slate-700">
              <Crosshair className="size-5 shrink-0 text-blue-600" strokeWidth={2.25} aria-hidden />
              {target.label}
            </p>
            <p className="mt-1 text-base font-semibold text-slate-900">
              {formatKrw(target.targetPrice)}
            </p>
            <p className="mt-1 text-xs font-medium text-blue-600">
              {formatReturnPct(target.expectedReturnPct)}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              달성확률 {target.probability}% · {target.method}
            </p>
            {target.note ? (
              <p className="mt-2 text-[11px] leading-snug text-slate-500">{target.note}</p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}
