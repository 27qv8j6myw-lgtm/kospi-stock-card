import type { ScreenerSectorResult } from '../lib/screener'
import type { LucideIcon } from 'lucide-react'
import {
  Anchor,
  BatteryCharging,
  Bot,
  Building2,
  Car,
  Cpu,
  Shield,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { ScreenerStockCard } from './ScreenerStockCard'

type Props = { sector: ScreenerSectorResult }

function sectorIconMeta(sector: string): { icon: LucideIcon; className: string } {
  if (sector.includes('AI') || sector.includes('반도체')) return { icon: Cpu, className: 'text-indigo-600' }
  if (sector.includes('IT부품')) return { icon: Bot, className: 'text-sky-600' }
  if (sector.includes('방산')) return { icon: Shield, className: 'text-rose-600' }
  if (sector.includes('조선')) return { icon: Anchor, className: 'text-cyan-600' }
  if (sector.includes('전력')) return { icon: Zap, className: 'text-amber-600' }
  if (sector.includes('자동차')) return { icon: Car, className: 'text-emerald-600' }
  if (sector.includes('건설')) return { icon: Building2, className: 'text-orange-600' }
  if (sector.includes('2차전지')) return { icon: BatteryCharging, className: 'text-violet-600' }
  return { icon: TrendingUp, className: 'text-secondary' }
}

export function SectorSection({ sector }: Props) {
  const sectorMeta = sectorIconMeta(sector.label)
  const SectorIcon = sectorMeta.icon

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="inline-flex items-center gap-2 text-lg font-bold text-primary">
          <SectorIcon className={`size-5 ${sectorMeta.className}`} />
          {sector.label}
        </h3>
        <div className="inline-flex items-center gap-2">
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
              sector.isLeading
                ? 'border-rose-200 bg-rose-50 text-rose-700'
                : 'border-default bg-app text-secondary'
            }`}
          >
            {sector.isLeading ? '주도섹터' : '비주도'}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-secondary">
            <Sparkles className="size-3.5 text-amber-500" />
            상위 {sector.stocks.length}종목
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sector.stocks.map((stock) => (
          <ScreenerStockCard key={stock.code} stock={stock} />
        ))}
      </div>
    </section>
  )
}
