import type { TargetPrice } from '../types/stock'

type TargetPricePanelProps = {
  targets: TargetPrice[]
}

function formatKrw(v: number) {
  return `${v.toLocaleString('ko-KR')}원`
}

export function TargetPricePanel({ targets }: TargetPricePanelProps) {
  return (
    <section className="border-t border-slate-200 px-6 py-6 sm:px-8">
      <h3 className="text-[15px] font-bold text-slate-900">목표가</h3>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {targets.map((target) => (
          <article key={`${target.horizon}${target.sub ?? ''}`} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">
              {target.horizon} {target.sub || ''}
            </p>
            <p className="mt-1 text-base font-semibold text-slate-900">{formatKrw(target.targetPrice)}</p>
            <p className="mt-1 text-xs font-medium text-blue-600">
              {target.expectedReturnPct >= 0 ? '+' : ''}
              {target.expectedReturnPct.toFixed(2)}%
            </p>
            <p className="mt-2 text-xs text-slate-500">
              달성확률 {target.probability}% · N={target.sampleSize}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}
