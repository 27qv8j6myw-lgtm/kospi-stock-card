import type { ReactNode } from 'react'
import { ProIndicatorCard, type ProIndicatorCardProps } from './ProIndicatorCard'
import { ProSectionHeader } from './ProSectionHeader'

export type ProGridCard = ProIndicatorCardProps & { key: string }

type Props = {
  icon: ReactNode
  title: string
  meta?: string
  cards: ProGridCard[]
}

export function ProSectionGrid({ icon, title, meta, cards }: Props) {
  if (!cards.length) return null

  return (
    <div className="border-b border-gray-100 px-4 py-4 last:border-b-0 sm:px-5">
      <ProSectionHeader icon={icon} title={title} meta={meta} />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3">
        {cards.map(({ key, ...card }) => (
          <ProIndicatorCard key={key} {...card} />
        ))}
      </div>
    </div>
  )
}
