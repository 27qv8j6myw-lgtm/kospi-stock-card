import { formatPct } from '../../lib/utils/format'
import { stockNameFromMaster } from '../../data/sectorMaster'
import type { TopFiveRow } from '../../data/mockScreening'

export type TopFiveCarouselProps = {
  rows: TopFiveRow[]
  onSelectRow: (code: string) => void
}

function rankTextClass(rank: number): string {
  if (rank === 1) return 'text-amber-500'
  if (rank === 2) return 'text-slate-400'
  if (rank === 3) return 'text-orange-700'
  return 'text-tertiary'
}

function SubScoreRow({ label, value }: { label: string; value: number }) {
  const color =
    value >= 70 ? 'text-emerald-700' : value >= 50 ? 'text-primary' : 'text-tertiary'
  return (
    <div className="flex items-center justify-between text-[11px] leading-tight">
      <span className="text-secondary">{label}</span>
      <span className={`font-sans-en font-semibold tabular-nums ${color}`}>{value}</span>
    </div>
  )
}

function TopFiveCard({
  row,
  onSelect,
}: {
  row: TopFiveRow
  onSelect: (code: string) => void
}) {
  const sub = row.subScores
  const nm = row.name?.trim()
  const title =
    nm && nm !== row.code && !/^\d{6}$/.test(nm.replace(/\s/g, '')) ? nm : stockNameFromMaster(row.code)
  return (
    <button
      type="button"
      onClick={() => onSelect(row.code)}
      className="flex h-full min-h-0 flex-col rounded-2xl border border-default bg-card p-3 text-left shadow-sm transition hover:border-blue-300 hover:bg-neutral-bg sm:p-4"
    >
      <div className="flex items-start justify-between gap-2 border-b border-default pb-2">
        <span className={`font-sans-en text-2xl font-bold tabular-nums ${rankTextClass(row.rank)}`}>{row.rank}</span>
        <span className="max-w-[8rem] truncate text-right text-[11px] font-medium text-secondary">{row.sectorLabel}</span>
      </div>
      <div className="mt-2 min-h-0 flex-1 space-y-1">
        <p className="truncate text-sm font-semibold text-primary">{title}</p>
        <p className="truncate text-[11px] leading-snug text-secondary">
          <span className="font-sans-en tabular-nums">{row.code}</span>
          {row.sectorLabel ? <span> · {row.sectorLabel}</span> : null}
          {row.sectorIsLeading ? <span className="font-medium text-amber-800"> · 주도</span> : null}
        </p>
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-2 border-t border-default pt-2">
        <span className="font-sans-en text-lg font-bold tabular-nums text-primary">{row.score}점</span>
        <span className="font-sans-en text-sm font-semibold tabular-nums text-price-up">예상 {formatPct(row.expected1MPct)}</span>
      </div>
      {sub ? (
        <div className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 border-t border-default pt-2">
          <SubScoreRow label="구조" value={sub.structure} />
          <SubScoreRow label="실행" value={sub.execution} />
          <SubScoreRow label="모멘텀" value={sub.momentum} />
          <SubScoreRow label="수급" value={sub.supplyDemand} />
        </div>
      ) : null}
      <div className="mt-3 space-y-1 border-t border-default pt-2 text-[11px]">
        {row.consensusUpside != null && Number.isFinite(row.consensusUpside) ? (
          <div className="flex justify-between gap-2">
            <span className="text-secondary">컨센 여력</span>
            <span
              className={`font-sans-en font-semibold tabular-nums ${
                row.consensusUpside > 0 ? 'text-price-up' : row.consensusUpside < 0 ? 'text-price-down' : 'text-primary'
              }`}
            >
              {row.consensusUpside > 0 ? '+' : ''}
              {row.consensusUpside.toFixed(0)}%
            </span>
          </div>
        ) : null}
        {row.per != null && row.per > 0 ? (
          <div className="flex justify-between gap-2">
            <span className="text-secondary">PER</span>
            <span className="font-sans-en font-semibold tabular-nums text-primary">
              {row.per.toFixed(1)}x
              {row.fiveYearAvgPer != null && row.fiveYearAvgPer > 0 ? (
                <span className="ml-1 text-[10px] font-normal text-tertiary">(5Y {row.fiveYearAvgPer.toFixed(1)}x)</span>
              ) : null}
            </span>
          </div>
        ) : null}
      </div>
    </button>
  )
}

export function TopFiveCarousel({ rows, onSelectRow }: TopFiveCarouselProps) {
  if (!rows.length) return null
  return (
    <section className="rounded-2xl border border-default bg-card p-4 shadow-sm sm:p-6" aria-labelledby="top5-carousel-heading">
      <h2 id="top5-carousel-heading" className="text-base font-semibold text-primary">
        전체 TOP 5
      </h2>
      <div className="mt-4 grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:auto-rows-fr lg:grid-cols-3 lg:auto-rows-fr xl:grid-cols-5 xl:auto-rows-fr">
        {rows.map((row) => (
          <TopFiveCard key={row.code} row={row} onSelect={onSelectRow} />
        ))}
      </div>
    </section>
  )
}
