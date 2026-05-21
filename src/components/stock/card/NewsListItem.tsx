import { stockCardTokens } from '@/lib/stockCardDesignTokens'

type Props = {
  title: string
  link: string
  pubDate?: string | null
  source?: string
}

function formatDate(pubDate?: string | null): string {
  if (!pubDate) return '—'
  try {
    return new Date(pubDate).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })
  } catch {
    return '—'
  }
}

export function NewsListItem({ title, link, pubDate, source }: Props) {
  const t = stockCardTokens.listItem
  return (
    <a href={link} target="_blank" rel="noopener noreferrer" className={t.wrap}>
      <span className={t.date}>{formatDate(pubDate)}</span>
      <span className="min-w-0 flex-1">
        <span className={t.title}>{title}</span>
        {source ? <span className={t.source}>{source}</span> : null}
      </span>
    </a>
  )
}
