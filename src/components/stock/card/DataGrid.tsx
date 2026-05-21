import type { ReactNode } from 'react'
import { stockCardTokens } from '@/lib/stockCardDesignTokens'

type Props = {
  children: ReactNode
  columns?: 2 | 3 | 4
  className?: string
}

const colClass: Record<2 | 3 | 4, string> = {
  2: 'grid grid-cols-2 gap-2',
  3: 'grid grid-cols-3 gap-2',
  4: stockCardTokens.dataGrid,
}

export function DataGrid({ children, columns = 4, className = '' }: Props) {
  return <div className={`${colClass[columns]} ${className}`.trim()}>{children}</div>
}
