import type { ReactNode } from 'react'
import { stockCardTokens } from '@/lib/stockCardDesignTokens'

type Props = {
  children: ReactNode
  className?: string
  /** border-t 없이 첫 섹션(헤더 직후) */
  noBorder?: boolean
}

export function StockCardSection({ children, className = '', noBorder = false }: Props) {
  return (
    <section
      className={`${noBorder ? 'px-6 py-5 sm:px-8' : stockCardTokens.section} ${className}`.trim()}
    >
      {children}
    </section>
  )
}
