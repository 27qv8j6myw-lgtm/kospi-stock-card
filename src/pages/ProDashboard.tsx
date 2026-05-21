import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Search, Sparkles, Star, X } from 'lucide-react'
import { useAppNavigation } from '@/hooks/useAppNavigation'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'
import { proSearchInputProps } from '@/lib/proSearchInputProps'

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
    <div className="min-h-screen bg-gradient-to-br from-amber-50/30 to-white">
      <div className="mx-auto max-w-[800px] px-4 py-12">
        <div className="mb-10 text-center">
          <div className="mb-3 inline-flex items-center gap-2">
            <Sparkles size={18} className="text-amber-600" strokeWidth={2} />
            <h1 className="text-[24px] font-bold tracking-tight text-gray-900">Pro 모드</h1>
          </div>
          <p className="text-[13px] text-gray-500">AI 기반 한국 주식 매매 어시스턴트</p>
        </div>

        <div className="relative mb-3">
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
            className="pro-search-input w-full rounded-2xl border border-gray-200 bg-white py-3.5 pl-11 pr-10 text-[14px] shadow-sm focus:border-amber-500 focus:outline-none"
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
            <div className="absolute top-full left-0 right-0 z-10 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xl">
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
          onClick={() => navigate('/pro/chat')}
          className="mb-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-900 py-3 text-[13px] font-semibold text-white hover:bg-gray-800"
        >
          <MessageCircle size={14} strokeWidth={1.8} />
          <span>AI 채팅으로 분석</span>
        </button>

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
