import type { ReactNode } from 'react'
import { stockCardTokens } from '@/lib/stockCardDesignTokens'

type Props = {
  children: ReactNode
  className?: string
}

/** 일반 종목카드 `article` 과 동일한 카드 셸 */
export function StockCardShell({ children, className = '' }: Props) {
  return (
    <article className={`${stockCardTokens.shell} ${className}`.trim()}>{children}</article>
  )
}
