import {
  BarChart3,
  Gauge,
  Landmark,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import type { ScreenerStock } from '../lib/screener'

function fmtWon(n: number) {
  return `${Math.round(n).toLocaleString()}원`
}

type Props = { stock: ScreenerStock }

export function ScreenerStockCard({ stock }: Props) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-slate-900">{stock.name}</h4>
          <p className="mt-0.5 text-xs text-slate-500">
            {stock.sector} · {stock.code}
          </p>
        </div>
        <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
          점수 {stock.finalScore}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-white p-2">
          <p className="inline-flex items-center gap-1 text-xs text-slate-500">
            <Landmark className="size-3.5" />
            현재가
          </p>
          <p className="font-semibold text-slate-900">{fmtWon(stock.currentPrice)}</p>
        </div>
        <div className="rounded-xl bg-white p-2">
          <p className="inline-flex items-center gap-1 text-xs text-slate-500">
            <TrendingUp className="size-3.5" />
            1M 목표
          </p>
          <p className="whitespace-nowrap text-[13px] font-semibold text-emerald-700">
            {fmtWon(stock.targetPrice1M)} ({stock.expectedReturnPct > 0 ? '+' : ''}
            {stock.expectedReturnPct.toFixed(1)}%)
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-700 sm:grid-cols-3">
        <p className="inline-flex min-w-0 items-center gap-1 rounded-lg bg-white px-2 py-1.5">
          <BarChart3 className="size-3.5 shrink-0" />
          <span className="truncate">구조 {stock.structureScore}</span>
        </p>
        <p className="inline-flex min-w-0 items-center gap-1 rounded-lg bg-white px-2 py-1.5">
          <Target className="size-3.5 shrink-0" />
          <span className="truncate">실행 {stock.executionScore}</span>
        </p>
        <p className="inline-flex min-w-0 items-center gap-1 rounded-lg bg-white px-2 py-1.5">
          <Wallet className="size-3.5 shrink-0" />
          <span className="truncate">수급 {stock.supplyScore}</span>
        </p>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-500">
        <span className="inline-flex min-w-0 items-center gap-1 rounded-lg bg-white px-2 py-1.5">
          <TrendingUp className="size-3.5 shrink-0" />
          <span className="truncate">섹터흐름 {stock.sectorFlowScore}</span>
        </span>
        <span className="inline-flex min-w-0 items-center gap-1 rounded-lg bg-white px-2 py-1.5">
          <TrendingUp className="size-3.5 shrink-0" />
          <span className="truncate">상승여력 {stock.consensusUpsidePct.toFixed(1)}%</span>
        </span>
        <span className="inline-flex min-w-0 items-center gap-1 rounded-lg bg-white px-2 py-1.5">
          <Gauge className="size-3.5 shrink-0" />
          <span className="truncate">스크리닝 {stock.screeningScore}</span>
        </span>
        <span className="inline-flex min-w-0 items-center gap-1 rounded-lg bg-white px-2 py-1.5">
          <Target className="size-3.5 shrink-0" />
          <span className="truncate">달성확률 {stock.probability1M}%</span>
        </span>
      </div>
    </article>
  )
}
