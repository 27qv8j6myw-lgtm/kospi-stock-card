import type { HTMLAttributes } from 'react'

export type StatusBadgeStatus =
  | 'BUY'
  | 'BUY_AGGRESSIVE'
  | 'BUY_MORE'
  | 'HOLD'
  | 'WATCH'
  | 'TAKE_PROFIT'
  | 'REJECT'

const statusClass: Record<StatusBadgeStatus, string> = {
  BUY: 'bg-icon-green-bg text-icon-green',
  BUY_AGGRESSIVE: 'bg-[#DCFCE7] text-[#15803D]',
  BUY_MORE: 'bg-success-bg text-success-text',
  HOLD: 'bg-icon-blue-bg text-icon-blue',
  WATCH: 'bg-[#FEF3C7] text-[#B86E12]',
  TAKE_PROFIT: 'bg-icon-orange-bg text-icon-orange',
  REJECT: 'bg-danger-bg text-danger-text',
}

export type StatusBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  status: StatusBadgeStatus
  /** glance: 헤더·한눈에 보기 전략 배지 — 11px 컴팩트 pill */
  size?: 'sm' | 'md' | 'glance'
  /** true면 완전 pill */
  pill?: boolean
}

export function StatusBadge({ status, size = 'md', pill = true, className = '', ...rest }: StatusBadgeProps) {
  const sizeCls =
    size === 'sm'
      ? 'px-2 py-0.5 text-xxs font-semibold tracking-wide'
      : size === 'glance'
        ? 'min-h-[20px] px-[10px] py-[3px] text-[11px] font-semibold leading-none tracking-wide'
        : 'px-2.5 py-1 text-xs font-semibold tracking-wide'
  const radius = pill ? 'rounded-full' : 'rounded-md'
  return (
    <span
      className={`inline-flex items-center justify-center uppercase ${statusClass[status]} ${sizeCls} ${radius} ${className}`.trim()}
      {...rest}
    >
      {status === 'BUY_MORE' ? 'BUY+' : status === 'BUY_AGGRESSIVE' ? 'BUY++' : status}
    </span>
  )
}
