import { Newspaper, Sparkles } from 'lucide-react'
import { PRO_ICON, formatNewsDate, getNewsSource, newsSectionMeta, proDesign } from '@/lib/proStockDesign'

type NewsItem = { title: string; link: string; pubDate?: string }

type Props = {
  news: NewsItem[]
  newsSummary?: string | null
}

export function ProNewsSection({ news, newsSummary }: Props) {
  if (!news.length) return null

  return (
    <div className="border-b border-gray-100 px-4 py-4 sm:px-5">
      <div className="mb-3 flex items-center gap-2">
        <Newspaper {...PRO_ICON} className="text-emerald-600" strokeWidth={1.8} />
        <span className="text-[16px] font-bold text-gray-900">최근 뉴스</span>
        <span className="ml-auto text-[11px] text-gray-400">{newsSectionMeta(news)}</span>
      </div>

      {newsSummary ? (
        <div className={`${proDesign.whiteBox} mb-3`}>
          <div className="mb-1.5 flex items-center gap-1.5">
            <Sparkles size={14} className="text-amber-600" strokeWidth={2} />
            <span className="text-[12px] font-bold text-gray-700">뉴스 요약</span>
          </div>
          <p className="text-[13px] leading-relaxed whitespace-pre-line text-gray-900">{newsSummary}</p>
        </div>
      ) : null}

      <div className="space-y-1.5">
        {news.slice(0, 5).map((item, i) => (
          <a
            key={`${item.link}-${i}`}
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className={`block ${proDesign.whiteBoxSm}`}
          >
            <div className="flex items-start gap-2.5">
              <span className="w-8 shrink-0 text-[11px] tabular-nums text-gray-400">
                {formatNewsDate(item.pubDate)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] leading-tight text-gray-900">{item.title}</div>
                <div className="mt-0.5 text-[11px] text-gray-400">{getNewsSource(item.link)}</div>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
