import { AlertTriangle } from 'lucide-react'
import type { StopInfo } from '../types/stock'

type StopPanelProps = {
  stop: StopInfo
}

function formatKrw(v: number) {
  return `${v.toLocaleString('ko-KR')}원`
}

export function StopPanel({ stop }: StopPanelProps) {
  return (
    <section className="border-t border-slate-200 px-6 py-6 sm:px-8">
      <h3 className="text-[15px] font-bold text-slate-900">Stop</h3>
      <article className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-4 text-red-500" />
          <div>
            <p className="text-sm font-semibold">
              Stop {formatKrw(stop.stopPrice)} ({stop.stopLossPct.toFixed(2)}%)
            </p>
            <p className="mt-1 text-xs">지지: {formatKrw(stop.supportPrice)} · 방식: {stop.method}</p>
          </div>
        </div>
      </article>
    </section>
  )
}
