import type { HTMLAttributes, ReactNode } from 'react'
import { Card } from './Card'
import { iconColorBoxClass, type IconColorToken } from './iconTokens'

export type MetricValueTone = 'default' | 'positive' | 'negative' | 'neutral'

const valueTone: Record<MetricValueTone, string> = {
  default: 'text-primary',
  positive: 'text-success-text',
  negative: 'text-danger-text',
  neutral: 'text-secondary',
}

export type MetricCardProps = HTMLAttributes<HTMLDivElement> & {
  icon: ReactNode
  iconColor: IconColorToken
  label: string
  value: ReactNode
  meta?: string
  valueColor?: MetricValueTone
  /** 기본 80px 고정; false면 그리드 높이 맞춤(h-full)용 */
  compact?: boolean
  /** 값 영역 클래스 (리스트 등은 font-normal) */
  valueClassName?: string
  /** 라벨 옆 툴팁 등 */
  headerRight?: ReactNode
  /** 값 아래 추가 블록 (타임스탑 리스트 등) */
  children?: ReactNode
}

export function MetricCard({
  icon,
  iconColor,
  label,
  value,
  meta,
  valueColor = 'default',
  compact = true,
  valueClassName,
  headerRight,
  children,
  className = '',
  ...rest
}: MetricCardProps) {
  const box = iconColorBoxClass(iconColor)
  const sizeCn = compact
    ? 'h-[80px] max-h-[80px] min-h-[80px] overflow-hidden'
    : 'min-h-[80px] h-full overflow-visible'
  const valueCn =
    valueClassName ??
    (compact ? 'text-sm font-semibold leading-snug tabular-nums' : 'text-[13px] font-semibold leading-snug text-primary')
  return (
    <Card
      variant="default"
      padding="none"
      radius="lg"
      className={`relative flex flex-col shadow-card ${sizeCn} ${className}`.trim()}
      {...rest}
    >
      <div className={`flex min-h-0 flex-1 flex-col gap-0.5 p-3 ${compact ? '' : 'h-full'}`}>
        <div className="flex items-center gap-2">
          <div className={`flex size-8 shrink-0 items-center justify-center rounded-md [&>svg]:size-4 ${box}`}>{icon}</div>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-secondary">{label}</p>
          {headerRight ? <span className="shrink-0">{headerRight}</span> : null}
        </div>
        <div className={`min-h-0 flex-1 ${valueCn} ${valueTone[valueColor]}`}>{value}</div>
        {meta ? (
          <p className="line-clamp-3 shrink-0 text-[12px] leading-relaxed text-tertiary">{meta}</p>
        ) : null}
        {children ? <div className="mt-1 min-h-0 flex-1 overflow-y-auto text-xs leading-relaxed">{children}</div> : null}
      </div>
    </Card>
  )
}
