import {
  Layers,
  PauseCircle,
  PieChart,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react'
import type { ExecutionSummaryUi, UnifiedEntryStageTier } from '../types/stock'

function tierIcon(tier: UnifiedEntryStageTier) {
  switch (tier) {
    case 'NEW_ENTRY':
      return TrendingUp
    case 'SCALE_IN':
      return Layers
    case 'HOLD_STEADY':
      return PauseCircle
    case 'SCALE_OUT':
      return PieChart
    default:
      return ShieldAlert
  }
}

function tierShellClass(tier: UnifiedEntryStageTier): string {
  switch (tier) {
    case 'NEW_ENTRY':
      return 'border-emerald-200 bg-emerald-50/90 text-emerald-900'
    case 'SCALE_IN':
      return 'border-teal-200 bg-teal-50/90 text-teal-900'
    case 'HOLD_STEADY':
      return 'border-sky-200 bg-sky-50/90 text-sky-900'
    case 'SCALE_OUT':
      return 'border-amber-200 bg-amber-50/90 text-amber-950'
    default:
      return 'border-rose-200 bg-rose-50/90 text-rose-950'
  }
}

export function UnifiedEntryStageCard({ ui }: { ui: ExecutionSummaryUi }) {
  const Icon = tierIcon(ui.tier)
  const shell = tierShellClass(ui.tier)
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${shell}`}>
      <div className="flex items-center gap-2">
        <Icon className="size-4 shrink-0" aria-hidden />
        <span className="text-[11px] font-bold tracking-tight">{ui.entryStageLabel}</span>
      </div>
      <p className="mt-1.5 pl-6 text-[12px] font-medium leading-snug opacity-95">{ui.entryStageAction}</p>
    </div>
  )
}
