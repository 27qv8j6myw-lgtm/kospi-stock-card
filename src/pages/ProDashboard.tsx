import { useEffect, useRef, useState } from 'react'
import { DollarSign, MessageCircle, Search, Sparkles, Star, X } from 'lucide-react'
import { useAppNavigation } from '@/hooks/useAppNavigation'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'
import { proSearchInputProps } from '@/lib/proSearchInputProps'
import { PRO_CONTENT_WRAP, proDesign } from '@/lib/proStockDesign'
import { MarketIndicesStrip } from '@/components/home/MarketIndicesStrip'
import { ProTopFlow } from '@/components/pro/ProTopFlow'

type SearchRow = { code: string; name: string; market?: string }

type WatchlistItem = {
  code: string
  name?: string
  currentPrice?: number | null
  changePct?: number | null
}

export default function ProDashboard() {
  const { navigate } = useAppNavigation()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchRow[]>([])
  const [showResults, setShowResults] = useState(false)
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    void authFetch(apiUrl('/api/pro-watchlist-enriched'))
      .then((r) => (r.ok ? r.json() : { watchlist: [] }))
      .then((d: { watchlist?: WatchlistItem[] }) => setWatchlist(d.watchlist || []))
      .catch(() => setWatchlist([]))
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      return
    }

    debounceRef.current = setTimeout(() => {
      void authFetch(apiUrl(`/api/stocks-search?q=${encodeURIComponent(trimmed)}`))
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((d: { results?: SearchRow[]; items?: SearchRow[] }) => {
          const rows = Array.isArray(d.results)
            ? d.results
            : Array.isArray(d.items)
              ? d.items
              : []
          setResults(rows)
        })
        .catch(() => setResults([]))
    }, 200)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  return (
    <div className="min-h-screen bg-gray-50">
      <MarketIndicesStrip variant="pro" className="mb-0 w-full" />

      <div className={proDesign.stickyBar}>
        <div className={`${PRO_CONTENT_WRAP} flex items-center gap-2 py-3`}>
          <div className="relative min-w-0 flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              {...proSearchInputProps}
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setShowResults(true)
              }}
              onFocus={() => setShowResults(true)}
              onBlur={() => setTimeout(() => setShowResults(false), 200)}
              placeholder="종목명 또는 코드 (예: 산일전기, 062040)"
              className="pro-search-input w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-10 text-[14px] focus:border-amber-500 focus:bg-white focus:outline-none"
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  setResults([])
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                aria-label="검색어 지우기"
              >
                <X size={16} />
              </button>
            ) : null}

            {showResults && results.length > 0 ? (
              <div className="absolute top-full right-0 left-0 z-10 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xl">
                {results.map((r) => (
                  <button
                    key={r.code}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      navigate(`/pro/stock/${r.code}?name=${encodeURIComponent(r.name)}`)
                      setQuery('')
                      setResults([])
                    }}
                    className="flex w-full items-center justify-between border-b border-gray-100 px-4 py-3 text-left last:border-b-0 hover:bg-amber-50"
                  >
                    <span className="text-[14px] font-medium text-gray-900">{r.name}</span>
                    <span className="text-[11px] tabular-nums text-gray-500">
                      {r.code}
                      {r.market ? ` · ${r.market}` : ''}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => navigate('/pro/holdings')}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white transition-colors hover:border-gray-400"
            title="내 보유종목"
            aria-label="내 보유종목"
          >
            <DollarSign size={18} className="text-gray-700" strokeWidth={2} />
          </button>

          <button
            type="button"
            onClick={() => navigate('/pro/chat')}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-900 text-white hover:bg-gray-800"
            title="AI 채팅"
            aria-label="AI 채팅"
          >
            <MessageCircle size={16} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      <div className={`${PRO_CONTENT_WRAP} space-y-4 py-4 pb-12`}>
        <div className="flex flex-col items-center py-6">
          <div className="mb-2 inline-flex items-center gap-2">
            <Sparkles size={24} className="text-amber-600" strokeWidth={1.8} />
            <h1 className="text-[24px] font-bold leading-none text-gray-900">Pro 모드</h1>
          </div>
          <p className="text-[11px] font-semibold uppercase leading-none tracking-[0.2em] text-gray-400">
            Invited Only
          </p>
        </div>

        <ProTopFlow />

        <div>
          <div className="mb-3 flex items-center gap-1.5">
            <Star size={13} className="text-amber-600" strokeWidth={2} />
            <h2 className="text-[12px] font-bold uppercase tracking-wider text-gray-700">
              즐겨찾기
            </h2>
            <span className="text-[10px] text-gray-400">{watchlist.length}개</span>
          </div>

          {watchlist.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-8 text-center">
              <Star size={24} className="mx-auto mb-2 text-gray-300" strokeWidth={1.5} />
              <div className="mb-1 text-[12px] text-gray-500">즐겨찾기 종목이 없습니다</div>
              <div className="text-[11px] text-gray-400">
                종목 카드에서 &quot;관심 종목&quot; 버튼으로 추가하세요
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {watchlist.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() =>
                    navigate(
                      `/pro/stock/${item.code}?name=${encodeURIComponent(item.name || item.code)}`,
                    )
                  }
                  className="rounded-xl border border-gray-200 bg-white p-3 text-left transition-all hover:border-amber-300 hover:shadow-sm"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <div className="truncate text-[12px] font-bold text-gray-900">
                      {item.name || item.code}
                    </div>
                    <span className="ml-1 flex-shrink-0 text-[10px] tabular-nums text-gray-400">
                      {item.code}
                    </span>
                  </div>
                  {item.currentPrice != null ? (
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[13px] font-bold tabular-nums text-gray-900">
                        {item.currentPrice.toLocaleString()}원
                      </span>
                      {item.changePct != null ? (
                        <span
                          className={`text-[10px] font-semibold ${
                            item.changePct > 0 ? 'text-red-600' : 'text-blue-600'
                          }`}
                        >
                          {item.changePct > 0 ? '+' : ''}
                          {item.changePct.toFixed(2)}%
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
