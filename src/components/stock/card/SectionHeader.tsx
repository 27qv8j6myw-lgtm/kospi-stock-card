import type { ReactNode } from 'react'
import { stockCardTokens } from '@/lib/stockCardDesignTokens'

type Props = {
  icon: ReactNode
  title: string
  meta?: string
  className?: string
}

export function SectionHeader({ icon, title, meta, className = '' }: Props) {
  const t = stockCardTokens.sectionHeader
  return (
    <div className={`${t.wrap} ${className}`.trim()}>
      <div className={t.left}>
        <span className={t.iconBox} aria-hidden>
          {icon}
        </span>
        <span className={t.title}>{title}</span>
      </div>
      {meta ? <span className={t.meta}>{meta}</span> : null}
    </div>
  )
}
