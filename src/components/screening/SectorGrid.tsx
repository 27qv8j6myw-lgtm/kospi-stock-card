import type { SectorRow } from '../../data/mockScreening'
import { SectorCard } from './SectorCard'

export type SectorGridProps = {
  sectors: SectorRow[]
  onSelectStock: (code: string) => void
}

export function SectorGrid({ sectors, onSelectStock }: SectorGridProps) {
  return (
    <section aria-labelledby="sector-grid-heading">
      <h2 id="sector-grid-heading" className="sr-only">
        섹터별 요약
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {sectors.map((sector) => (
          <SectorCard key={sector.id} sector={sector} onSelectStock={onSelectStock} />
        ))}
      </div>
    </section>
  )
}
