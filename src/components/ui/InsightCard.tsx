import type { ReactNode } from 'react'
import { Card } from './Card'

export type InsightRow = {
  icon: ReactNode
  label: string
  value: ReactNode
  valueClassName?: string
  /** 값을 전체 너비로 (Reason 등) */
  valueFullWidth?: boolean
}

export type InsightCardProps = {
  eyebrow?: string
  title: ReactNode
  subtitle: ReactNode
  /** 부제와 표 사이 (진입 단계 카드 등) */
  belowSubtitle?: ReactNode
  rows: InsightRow[]
  headerTrailing?: ReactNode
}

export function InsightCard({
  eyebrow = '한눈에 보기',
  title,
  subtitle,
  belowSubtitle,
  rows,
  headerTrailing,
}: InsightCardProps) {
  return (
    <Card variant="elevated" padding="lg" radius="xl">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-secondary">{eyebrow}</p>
        {headerTrailing}
      </div>
      <div className="mt-3 text-2xl font-bold leading-snug text-primary">{title}</div>
      <div className="mt-2 text-sm leading-relaxed text-secondary">{subtitle}</div>
      {belowSubtitle ? <div className="mt-2">{belowSubtitle}</div> : null}
      <ul className="mt-4 divide-y divide-light rounded-lg border border-light">
        {rows.map((row, i) =>
          row.valueFullWidth ? (
            <li
              key={`${row.label}-${i}`}
              className="px-2 py-2 transition-colors hover:bg-[#FAFAFA] sm:px-3"
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center text-secondary [&>svg]:size-4">
                  {row.icon}
                </span>
                <span className="pt-0.5 text-sm text-secondary">{row.label}</span>
              </div>
              <div className={`mt-2 min-w-0 pl-6 text-sm text-primary ${row.valueClassName ?? ''}`.trim()}>{row.value}</div>
            </li>
          ) : (
            <li
              key={`${row.label}-${i}`}
              className="flex items-start gap-2 px-2 py-2 transition-colors hover:bg-[#FAFAFA] sm:px-3"
            >
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center text-secondary [&>svg]:size-4">
                {row.icon}
              </span>
              <span className="min-w-0 flex-1 pt-0.5 text-sm text-secondary">{row.label}</span>
              <div
                className={`max-w-[min(20rem,55%)] shrink-0 pt-0.5 text-right text-sm font-semibold text-primary ${row.valueClassName ?? ''}`.trim()}
              >
                {row.value}
              </div>
            </li>
          ),
        )}
      </ul>
    </Card>
  )
}
