import type { ExecutionCard } from '../types/stock'

type ExecutionStrategyProps = {
  cards: ExecutionCard[]
}

export function ExecutionStrategy({ cards }: ExecutionStrategyProps) {
  return (
    <section className="border-t border-slate-200 px-6 py-6 sm:px-8">
      <h3 className="text-[15px] font-bold text-slate-900">실행 전략</h3>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <article key={card.title} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">{card.title}</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{card.value}</p>
            {card.hint ? <p className="mt-1 text-xs text-slate-500">{card.hint}</p> : null}
          </article>
        ))}
      </div>
    </section>
  )
}
