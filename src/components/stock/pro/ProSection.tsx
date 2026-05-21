import type { ReactNode } from 'react'
import { proDesign } from '@/lib/proStockDesign'

type Props = {
  icon: ReactNode
  title: string
  meta?: string
  children: ReactNode
}

export function ProSection({ icon, title, meta, children }: Props) {
  return (
    <div className={proDesign.section}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className={proDesign.sectionTitle}>{title}</span>
        </div>
        {meta ? <span className={proDesign.sectionMeta}>{meta}</span> : null}
      </div>
      {children}
    </div>
  )
}

