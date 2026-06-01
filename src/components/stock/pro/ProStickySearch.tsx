import { useCallback, useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { navigate } = useAppNavigation()

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
    }
  }, [query, navigate])

  return (
    <div className={proDesign.proSearchBar}>
      <div className={`${proDesign.contentWrap} flex items-center gap-2 py-2 sm:py-2.5`}>
        <form
          className="relative min-w-0 flex-1"
          onSubmit={(e) => {
            e.preventDefault()
            void handleSearch()
          }}
        >
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            {...proSearchInputProps}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setShowResults(true)
            }}
            onFocus={() => setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 200)}
            placeholder={searchPlaceholder}
            className="pro-search-input w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-9 text-left text-base text-gray-900 focus:border-amber-500 focus:bg-white focus:outline-none md:text-[13px]"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setResults([])
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
              aria-label="검색어 지우기"
            >
              <X size={14} />
            </button>
          ) : null}

          {showResults && results.length > 0 ? (
            <ul className="absolute top-full right-0 left-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
              {results.map((r) => (
                <li key={r.code}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      navigate(`/pro/stock/${r.code}?name=${encodeURIComponent(r.name)}`)
                      setQuery('')
                      setResults([])
                    }}
                    className={`flex w-full items-center justify-between border-b border-gray-100 px-4 py-2.5 text-left last:border-b-0 hover:bg-gray-50 ${
                      r.code === currentCode ? 'bg-amber-50' : ''
                    }`}
                  >
                    <span className="text-[13px] font-medium text-gray-900">{r.name}</span>
                    <span className="text-[11px] tabular-nums text-gray-500">{r.code}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </form>

        <ProSearchBarActions />
      </div>
    </div>
  )
}
