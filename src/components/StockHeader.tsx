type StockHeaderProps = {
  title: string
  subtitle: string
  asOfDate: string
}

export function StockHeader({ title, subtitle, asOfDate }: StockHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-5 sm:px-8">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500">
        {asOfDate}
      </p>
    </header>
  )
}
