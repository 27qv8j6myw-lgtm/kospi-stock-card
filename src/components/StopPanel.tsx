import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { StopInfo } from '../types/stock'
import { ExecutionInfoTooltip } from './ExecutionInfoTooltip'

type StopPanelProps = {
  stop: StopInfo
}

function formatKrw(v: number) {
  return `${v.toLocaleString('ko-KR')}원`
}

export function StopPanel({ stop }: StopPanelProps) {
  const [openTip, setOpenTip] = useState(false)

  return (
    <section className="border-t border-slate-200 px-6 py-6 sm:px-8">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-bold tracking-tight text-slate-900">Stop</h3>
        <ExecutionInfoTooltip
          educationKey="stopLoss"
          open={openTip}
          onOpen={() => setOpenTip(true)}
          onClose={() => setOpenTip(false)}
          onToggle={() => setOpenTip((v) => !v)}
          tooltipSide="start"
        />
      </div>
      <article className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900 shadow-sm">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-500" />
          <div>
            <p className="text-base font-semibold text-slate-700">
              Stop 가격: {formatKrw(stop.stopPrice)}
            </p>
            <p className="mt-1 text-sm">손절률: {stop.stopLossPct.toFixed(1)}%</p>
            <p className="mt-1 text-sm">기준: {stop.method}</p>
            <p className="mt-1 text-sm">이유: {stop.reason}</p>
            {stop.warning ? (
              <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                {stop.warning}
              </p>
            ) : null}
          </div>
        </div>
        <details className="mt-3 rounded-md border border-red-200 bg-white/60 p-2 text-[11px] text-slate-700">
          <summary className="cursor-pointer font-medium">계산 후보 보기</summary>
          <ul className="mt-2 space-y-1">
            {stop.candidates.map((c) => (
              <li key={`${c.method}-${c.price}`} className="leading-relaxed">
                <span className="font-semibold">{c.method}</span> · {formatKrw(c.price)} ({c.lossPct.toFixed(1)}%)
                <span className={c.valid ? 'text-emerald-700' : 'text-slate-500'}>
                  {' '}
                  · {c.valid ? '유효' : '범위밖'}
                </span>
              </li>
            ))}
          </ul>
        </details>
      </article>
    </section>
  )
}
