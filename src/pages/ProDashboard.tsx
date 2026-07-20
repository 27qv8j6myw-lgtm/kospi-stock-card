import { useCallback, useEffect, useRef, useState } from 'react'
import { Search, Sparkles, Star, X } from 'lucide-react'
import { ProSearchBarActions } from '@/components/pro/ProSearchBarActions'
import { useAppNavigation } from '@/hooks/useAppNavigation'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'
import { proSearchInputProps, useProStockSearchPlaceholder } from '@/lib/proSearchInputProps'
import {
  PRO_CONTENT_WRAP,
  PRO_DASHBOARD_SCROLL_OFFSET,
  proDesign,
} from '@/lib/proStockDesign'
import { DailyBriefingCard } from '@/components/pro/DailyBriefingCard'
import { ProTopFlow } from '@/components/pro/ProTopFlow'
import { useKrxDataPolling } from '@/hooks/useKrxDataPolling'
import { useVisibilityDataRefresh } from '@/hooks/useVisibilityDataRefresh'
import { removeProWatchlist } from '@/lib/proStockApi'
import { fetchStockQuotePublic } from '@/lib/proHoldingsQuotes'
import {
  fetchStockSearch,
  parseStockSearchRows,
  pickStockSearchTarget,
  type ProStockSearchRow,
} from '@/lib/proStockSearch'

type WatchlistItem = {
  code: string
  name?: string
  currentPrice?: number | null
  changePct?: number | null
}

export default function ProDashboard() {
  const { navigate } = useAppNavigation()
  const searchPlaceholder = useProStockSearchPlaceholder('dashboard')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProStockSearchRow[]>([])
  const [showResults, setShowResults] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [removingCode, setRemovingCode] = useState<string | null>(null)
  const [topFlowRefresh, setTopFlowRefresh] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const loadWatchlist = useCallback(() => {
    void authFetch(apiUrl('/api/pro-watchlist-enriched'))
      .then((r) => (r.ok ? r.json() : { watchlist: [] }))
      .then(async (d: { watchlist?: WatchlistItem[] }) => {
        const list = d.watchlist || []
        const enriched = await Promise.all(
          list.map(async (item) => {
            if (item.currentPrice != null && Number(item.currentPrice) > 0) return item
            const q = await fetchStockQuotePublic(item.code)
            if (!q) return item
            return {
              ...item,
              currentPrice: q.currentPrice,
              changePct: q.changePct,
            }
          }),
        )
        setWatchlist(enriched)
      })
      .catch(() => setWatchlist([]))
  }, [])

  useEffect(() => {
    loadWatchlist()
  }, [loadWatchlist])

  const refetchQuotes = useCallback(() => {
    loadWatchlist()
  }, [loadWatchlist])

  const refetchAll = useCallback(() => {
    loadWatchlist()
    setTopFlowRefresh((n) => n + 1)
  }, [loadWatchlist])

  useVisibilityDataRefresh(refetchAll)
  useKrxDataPolling(refetchQuotes)

  const removeFromWatchlist = async (code: string) => {
    if (removingCode) return
    setRemovingCode(code)
    const prev = watchlist
    setWatchlist((list) => list.filter((w) => w.code !== code))
    const ok = await removeProWatchlist(code)
    if (!ok) {
      setWatchlist(prev)
    }
    setRemovingCode(null)
  }

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
        .then((d) => setResults(parseStockSearchRows(d)))
        .catch(() => setResults([]))
    }, 200)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  const handleSearch = useCallback(async () => {
    const trimmed = query.trim()
    if (!trimmed) return

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }

    setShowResults(true)
    const rows = await fetchStockSearch(trimmed)
    setResults(rows)

    const target = pickStockSearchTarget(rows, trimmed)
    if (target) {
      navigate(`/pro/stock/${target.code}?name=${encodeURIComponent(target.name)}`)
      setQuery('')
      setResults([])
      setShowResults(false)
      setSearchOpen(false)
    }
  }, [query, navigate])

  const openSearch = useCallback(() => {
    setSearchOpen(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [])

  return (
    <div className="min-h-screen w-full min-w-0 max-w-full bg-gray-50">
      <div className={proDesign.proSearchBar}>
        <div className={`${PRO_CONTENT_WRAP} flex items-center gap-2 py-2 sm:py-2.5`}>
          {/* 모바일: 검색 폼을 숨기고 아이콘만 노출 → 액션 아이콘 우측 정렬용 스페이서 */}
          <div className="flex-1 md:hidden" aria-hidden />

          <form
            className={`relative min-w-0 md:block md:flex-1 ${
              searchOpen
                ? 'max-md:absolute max-md:left-0 max-md:right-0 max-md:top-full max-md:block max-md:border-b max-md:border-gray-200 max-md:bg-white max-md:px-3 max-md:py-2 max-md:shadow-lg'
                : 'max-md:hidden'
            }`}
            onSubmit={(e) => {
              e.preventDefault()
              void handleSearch()
            }}
          >
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                {...proSearchInputProps}
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setShowResults(true)
                }}
                onFocus={() => setShowResults(true)}
                onBlur={() =>
                  setTimeout(() => {
                    setShowResults(false)
                    setSearchOpen(false)
                  }, 200)
                }
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setShowResults(false)
                    setSearchOpen(false)
                  }
                }}
                placeholder={searchPlaceholder}
                className="pro-search-input w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-10 text-base focus:border-amber-500 focus:bg-white focus:outline-none md:text-[14px]"
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
                <div className="absolute top-full right-0 left-0 z-50 mt-2 max-h-[270px] overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xl">
                  {results.map((r) => (
                    <button
                      key={r.code}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        navigate(`/pro/stock/${r.code}?name=${encodeURIComponent(r.name)}`)
                        setQuery('')
                        setResults([])
                        setSearchOpen(false)
                      }}
                      className="flex w-full items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 text-left last:border-b-0 hover:bg-amber-50"
                    >
                      <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-gray-900">
                        {r.name}
                      </span>
                      <span className="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-gray-500">
                        {r.code}
                        {r.market ? ` · ${r.market}` : ''}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </form>

          {/* 모바일 전용 검색 아이콘 — 탭하면 아래로 전체폭 검색 패널 펼침 */}
          <button
            type="button"
            onClick={openSearch}
            className="flex size-11 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 transition-colors hover:border-gray-400 md:hidden"
            aria-label="종목 검색 열기"
            title="종목 검색"
          >
            <Search size={18} strokeWidth={2} aria-hidden />
          </button>

          <ProSearchBarActions size="md" />
        </div>
      </div>

      <div className={`${PRO_CONTENT_WRAP} space-y-4 py-4 pb-12 ${PRO_DASHBOARD_SCROLL_OFFSET}`}>
        <div className="flex flex-col items-center py-5 md:py-6">
          <div className="mb-2 inline-flex items-center gap-2">
            <Sparkles size={24} className="text-amber-600" strokeWidth={1.8} />
            <h1 className="text-[24px] font-bold leading-none text-gray-900">Pro 모드</h1>
          </div>
          <p className="text-[11px] font-semibold uppercase leading-none tracking-[0.2em] text-gray-400">
            Invited Only
          </p>
        </div>

        <DailyBriefingCard />

        <ProTopFlow refreshSignal={topFlowRefresh} />

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
                <div
                  key={item.code}
                  className="flex items-start gap-1 rounded-xl border border-gray-200 bg-white p-3 transition-all hover:border-amber-300 hover:shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/pro/stock/${item.code}?name=${encodeURIComponent(item.name || item.code)}`,
                      )
                    }
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="mb-1 flex items-center justify-between gap-1">
                      <div className="truncate text-[12px] font-bold text-gray-900">
                        {item.name || item.code}
                      </div>
                      <span className="shrink-0 text-[10px] tabular-nums text-gray-400">
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
                  <button
                    type="button"
                    disabled={removingCode === item.code}
                    onClick={() => void removeFromWatchlist(item.code)}
                    className="shrink-0 rounded p-0.5 text-amber-400 hover:text-gray-300 disabled:opacity-50"
                    title="즐겨찾기 해제"
                    aria-label={`${item.name || item.code} 즐겨찾기 해제`}
                  >
                    <Star size={16} fill="currentColor" strokeWidth={2} aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
