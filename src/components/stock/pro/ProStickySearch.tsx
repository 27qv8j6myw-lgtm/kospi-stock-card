import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Search, X } from 'lucide-react'
import { ProSearchBarActions } from '@/components/pro/ProSearchBarActions'
import { useAppNavigation } from '@/hooks/useAppNavigation'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'
import { proDesign } from '@/lib/proStockDesign'
import { proSearchInputProps, useProStockSearchPlaceholder } from '@/lib/proSearchInputProps'
import {
  fetchStockSearch,
  parseStockSearchRows,
  pickStockSearchTarget,
  type ProStockSearchRow,
} from '@/lib/proStockSearch'

export function ProStickySearch({ currentCode }: { currentCode: string }) {
  const searchPlaceholder = useProStockSearchPlaceholder('sticky')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProStockSearchRow[]>([])
  const [showResults, setShowResults] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const barRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const { navigate } = useAppNavigation()

  // 모바일 fixed 검색창의 실제 렌더 높이를 측정해 본문 상단 오프셋(--pro-sticky-search-height)에 반영
  useEffect(() => {
    const el = barRef.current
    if (!el || typeof ResizeObserver === 'undefined') return

    const apply = () => {
      const h = el.getBoundingClientRect().height
      if (h > 0) {
        document.documentElement.style.setProperty('--pro-sticky-search-height', `${Math.round(h)}px`)
      }
    }
    apply()

    const ro = new ResizeObserver(apply)
    ro.observe(el)

    return () => {
      ro.disconnect()
      document.documentElement.style.removeProperty('--pro-sticky-search-height')
    }
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
        .then((d) => setResults(parseStockSearchRows(d)))
        .catch(() => setResults([]))
    }, 200)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  const handleBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back()
    } else {
      navigate('/pro')
    }
  }, [navigate])

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
    <div ref={barRef} className={proDesign.proSearchBar}>
      <div className={`${proDesign.contentWrap} flex items-center gap-2 py-2 sm:py-2.5`}>
        <button
          type="button"
          onClick={handleBack}
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 transition-colors hover:border-gray-400"
          aria-label="뒤로가기"
          title="뒤로가기"
        >
          <ArrowLeft size={18} strokeWidth={2} aria-hidden />
        </button>

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
              size={14}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
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
              className="pro-search-input w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-10 text-left text-base text-gray-900 focus:border-amber-500 focus:bg-white focus:outline-none md:text-[13px]"
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
                <X size={14} />
              </button>
            ) : null}

            {showResults && results.length > 0 ? (
              <ul className="absolute top-full right-0 left-0 z-50 mt-1 max-h-[228px] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                {results.map((r) => (
                  <li key={r.code}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        navigate(`/pro/stock/${r.code}?name=${encodeURIComponent(r.name)}`)
                        setQuery('')
                        setResults([])
                        setSearchOpen(false)
                      }}
                      className={`flex w-full items-center justify-between gap-3 border-b border-gray-100 px-4 py-2.5 text-left last:border-b-0 hover:bg-gray-50 ${
                        r.code === currentCode ? 'bg-amber-50' : ''
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-gray-900">
                        {r.name}
                      </span>
                      <span className="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-gray-500">
                        {r.code}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </form>

        {/* 모바일 전용 검색 아이콘 — 탭하면 아래로 전체폭 검색 패널 펼침 */}
        <button
          type="button"
          onClick={openSearch}
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 transition-colors hover:border-gray-400 md:hidden"
          aria-label="종목 검색 열기"
          title="종목 검색"
        >
          <Search size={18} strokeWidth={2} aria-hidden />
        </button>

        <ProSearchBarActions />
      </div>
    </div>
  )
}
