import type { LogicMetric, MetricCardAccent } from '../../types/stock'
import type { SeverityToken } from './iconTokens'

function inferAccent(metric: LogicMetric): MetricCardAccent {
  if (metric.cardAccent) return metric.cardAccent
  const r = metric.riskStrip
  if (r === 'info') return 'info'
  if (r === 'warning') return 'caution'
  if (r === 'orange') return 'warning'
  if (r === 'danger') return 'danger'
  return 'neutral'
}

export function resolveIndicatorSeverity(metric: LogicMetric): SeverityToken {
  const a = inferAccent(metric)
  if (a === 'neutral') return 'normal'
  if (a === 'info') return 'info'
  if (a === 'caution') return 'caution'
  if (a === 'warning') return 'warning'
  if (a === 'danger') return 'danger'
  return 'normal'
}

export function riskMiniBadgeClass(strip: LogicMetric['riskStrip']): string {
  switch (strip) {
    case 'info':
      return 'border border-light bg-info-bg text-info-text'
    case 'warning':
      return 'border border-light bg-warning-bg text-warning-text'
    case 'orange':
      return 'border border-light bg-icon-orange-bg text-icon-orange'
    case 'danger':
      return 'border border-light bg-danger-bg text-danger-text'
    default:
      return 'border border-default bg-neutral-bg text-primary'
  }
}

export function primaryValueClass(e?: LogicMetric['valueEmphasis']): string {
  if (e === 'danger') return 'text-danger-text'
  if (e === 'warning') return 'text-warning-text'
  if (e === 'muted') return 'text-secondary'
  return 'text-primary'
}

export function subValueClass(e?: LogicMetric['subValueEmphasis']): string {
  if (e === 'danger') return 'text-danger-text'
  if (e === 'muted') return 'text-secondary'
  return 'text-tertiary'
}
