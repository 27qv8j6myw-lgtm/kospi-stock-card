import {
  Battery,
  Building2,
  Car,
  Cpu,
  Shield,
  Ship,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { formatPct } from '../../lib/utils/format'
import { stockNameFromMaster } from '../../data/sectorMaster'
import type { SectorRow, SectorIconKey, SectorTone } from '../../data/mockScreening'

const iconMap: Record<SectorIconKey, LucideIcon> = {
  cpu: Cpu,
  circuit: Cpu,
  shield: Shield,
  ship: Ship,
  zap: Zap,
  car: Car,
  building: Building2,
  battery: Battery,
}

/** IT부품 — lucide에 CircuitBoard 없을 때 Cpu 대비 별도 표시 */
function SectorGlyph({ icon }: { icon: SectorIconKey }) {
  if (icon === 'circuit') {
    return (
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <rect x="7" y="7" width="10" height="10" rx="1" />
        <path d="M7 12H4M20 12h-3M12 7V4M12 20v-3" />
        <circle cx="9" cy="9" r="1" fill="currentColor" stroke="none" />
        <circle cx="15" cy="15" r="1" fill="currentColor" stroke="none" />
      </svg>
    )
  }
  const Icon = iconMap[icon]
  return <Icon className="size-5" strokeWidth={2} aria-hidden />
}

const toneIconClass: Record<SectorTone, string> = {
  blue: 'bg-icon-blue-bg text-icon-blue',
  cyan: 'bg-icon-cyan-bg text-icon-cyan',
  rose: 'bg-icon-rose-bg text-icon-rose',
  teal: 'text-teal-600 bg-teal-50',
  yellow: 'bg-icon-yellow-bg text-icon-yellow',
  orange: 'bg-icon-orange-bg text-icon-orange',
  pink: 'bg-icon-pink-bg text-icon-pink',
  green: 'bg-icon-green-bg text-icon-green',
}

export type SectorCardProps = {
  sector: SectorRow
  onSelectStock: (code: string) => void
}

export function SectorCard({ sector, onSelectStock }: SectorCardProps) {
  const wrap = toneIconClass[sector.tone]

  return (
    <article className="flex h-full flex-col rounded-2xl border border-default bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${wrap}`}>
            <SectorGlyph icon={sector.icon} />
          </span>
          <h2 className="truncate text-base font-semibold text-primary">{sector.label}</h2>
        </div>
        {sector.isLeading ? (
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{ backgroundColor: '#FEF3C7', color: '#B86E12' }}
          >
            주도
          </span>
        ) : null}
      </div>

      <div className="mt-4 space-y-1">
        <p className="text-xl font-bold tabular-nums text-primary">평균 점수 {sector.avgScore}</p>
        <p className="text-xs text-secondary">
          섹터 5D {formatPct(sector.sectorReturn5D)} · KOSPI {formatPct(sector.kospiReturn5D)}
        </p>
      </div>

      <div className="mt-4 border-t border-default pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-tertiary">TOP 3</p>
        <ul className="mt-2 space-y-0.5">
          {sector.topStocks.map((stock, idx) => {
            const nm = stock.name?.trim()
            const label = nm && nm !== stock.code && !/^\d{6}$/.test(nm.replace(/\s/g, '')) ? nm : stockNameFromMaster(stock.code)
            return (
            <li key={stock.code}>
              <button
                type="button"
                onClick={() => onSelectStock(stock.code)}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-neutral-bg"
              >
                <span className="min-w-0 truncate text-primary">
                  <span className="font-sans-en tabular-nums text-secondary">{idx + 1}.</span>{' '}
                  {label}
                </span>
                <span className="shrink-0 pl-2 font-sans-en text-sm font-semibold tabular-nums text-primary">
                  {stock.score}점
                </span>
              </button>
            </li>
            )
          })}
        </ul>
      </div>
    </article>
  )
}
