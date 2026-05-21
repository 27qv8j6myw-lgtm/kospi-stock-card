import { stockCardTokens } from '@/lib/stockCardDesignTokens'

type Props = {
  report: string
  link: string
  date?: string
  isMajor?: boolean
}

function formatDartDate(date?: string): string {
  if (!date || date.length < 8) return '—'
  return `${date.slice(4, 6)}/${date.slice(6, 8)}`
}

export function DisclosureListItem({ report, link, date, isMajor = false }: Props) {
  const t = stockCardTokens.listItem
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className={`${t.wrap} ${isMajor ? 'border-amber-200 bg-amber-50 hover:bg-amber-100/80' : ''}`}
    >
      <span className={t.date}>{formatDartDate(date)}</span>
      <span className="min-w-0 flex-1">
        <span className={`${t.title} ${isMajor ? 'font-bold' : ''}`}>{report}</span>
      </span>
      {isMajor ? (
        <span className="shrink-0 rounded bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
          중요
        </span>
      ) : null}
    </a>
  )
}
