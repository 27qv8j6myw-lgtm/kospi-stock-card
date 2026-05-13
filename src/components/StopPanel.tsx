import { Shield } from 'lucide-react'
import type { StopInfo } from '../types/stock'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { CardHeader } from './ui/CardHeader'

type StopPanelProps = {
  stop: StopInfo
}

function formatKrw(v: number) {
  return `${v.toLocaleString('ko-KR')}원`
}

function basisShortLabel(method: string): string {
  if (method === 'RECENT_LOW') return 'LOW20'
  return method
}

function rowTooltip(stop: StopInfo, method: string, candidateReason: string): string {
  if (stop.basis === method) {
    return `${candidateReason}. 최종 선택 사유: ${stop.reason}`
  }
  return candidateReason
}

export function StopPanel({ stop }: StopPanelProps) {
  const pct = stop.stopLossPct >= 0 ? `+${stop.stopLossPct.toFixed(1)}` : stop.stopLossPct.toFixed(1)

  return (
    <section className="border-t border-default px-6 py-6 sm:px-8">
      <article className="mt-0 rounded-2xl border border-default bg-white p-5 shadow-card">
        <CardHeader
          icon={<Shield className="size-5 shrink-0 text-[#DC2626]" strokeWidth={1.75} aria-hidden />}
          label="STOP"
        />

        <p className="mt-3 font-sans-en text-xl font-bold tabular-nums text-primary">
          {formatKrw(stop.stopPrice)} ({pct}%)
        </p>
        <p className="mt-1 text-sm text-secondary">
          기준: {basisShortLabel(stop.basis)} · 사유: {stop.reason}
        </p>

        <div className="my-5 border-t border-[#E5E7EB]" />

        <p className="px-3 text-sm font-semibold text-secondary">계산 후보</p>

        <div className="mt-2">
          <div className="grid grid-cols-[80px_80px_1fr_24px] items-center border-b border-[#F3F4F6] px-3 pb-1.5 text-[11px] font-medium text-[#9CA3AF]">
            <span>기준</span>
            <span>손절률</span>
            <span className="text-right">가격</span>
            <span />
          </div>
          {stop.candidates.map((c) => {
            const selected = stop.basis === c.method
            const lossStr = `${c.lossPct >= 0 ? '+' : ''}${c.lossPct.toFixed(1)}%`
            return (
              <Tooltip key={c.method} delayDuration={250}>
                <TooltipTrigger asChild>
                  <div
                    className={`mt-1 grid cursor-default grid-cols-[80px_80px_1fr_24px] items-center gap-x-0 px-3 py-2 text-[13px] font-medium tabular-nums ${
                      selected ? 'rounded-md bg-[#FEF2F2] font-semibold text-primary' : 'text-primary'
                    }`}
                  >
                    <span className="text-secondary">{basisShortLabel(c.method)}</span>
                    <span className={c.lossPct < 0 ? 'text-[#2563EB]' : c.lossPct > 0 ? 'text-[#DC2626]' : 'text-primary'}>
                      {lossStr}
                    </span>
                    <span className="truncate text-right font-sans-en">{formatKrw(c.price)}</span>
                    <span className="flex justify-end">
                      {selected ? <span className="size-1.5 rounded-full bg-[#DC2626]" aria-hidden /> : null}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" align="start" className="max-w-[280px] text-xs leading-snug">
                  {rowTooltip(stop, c.method, c.reason)}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </article>
    </section>
  )
}
