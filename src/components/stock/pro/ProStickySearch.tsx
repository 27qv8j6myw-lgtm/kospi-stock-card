import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Search, X } from 'lucide-react'
import { useAppNavigation } from '@/hooks/useAppNavigation'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'
import { proDesign } from '@/lib/proStockDesign'
import { proSearchInputProps } from '@/lib/proSearchInputProps'

type SearchRow = { code: string; name: string }

export function ProStickySearch({ currentCode }: { currentCode: string }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchRow[]>([])
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
    <div className={proDesign.stickyBar}>
      <div className={`${proDesign.contentWrap} flex items-center gap-2 py-3`}>
        <div className="relative min-w-0 flex-1">
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
            placeholder="종목 검색 (예: 산일전기, 062040)"
            className="pro-search-input w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-9 text-left text-[13px] text-gray-900 focus:border-amber-500 focus:bg-white focus:outline-none"
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
            <ul className="absolute top-full right-0 left-0 z-10 mt-1 max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
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
        </div>

        <button
          type="button"
          onClick={() => navigate('/pro/chat')}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-900 text-white hover:bg-gray-800"
          title="AI 채팅"
          aria-label="AI 채팅"
        >
          <MessageCircle size={16} strokeWidth={1.8} />
        </button>
      </div>
    </div>
  )
}
