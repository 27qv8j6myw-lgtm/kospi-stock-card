import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useAppNavigation } from '@/hooks/useAppNavigation'

type SearchResult = { code: string; name: string }

export function ProStickySearch({ currentCode }: { currentCode: string }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const searchSeqRef = useRef(0)
  const { navigate } = useAppNavigation()

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      return
    }

    const seq = ++searchSeqRef.current
    const t = setTimeout(() => {
      void (async () => {
        try {
          const r = await fetch(`/api/stocks-search?q=${encodeURIComponent(trimmed)}`)
          if (seq !== searchSeqRef.current) return
          const d = (await r.json()) as { results?: SearchResult[]; items?: SearchResult[] }
          const rows = Array.isArray(d.results) ? d.results : Array.isArray(d.items) ? d.items : []
          setResults(rows)
        } catch {
          if (seq === searchSeqRef.current) setResults([])
        }
      })()
    }, 200)

    return () => clearTimeout(t)
  }, [query])

  return (
    <div className="sticky top-0 z-30 border-b border-gray-200 bg-white px-4 py-3">
      <div className="relative mx-auto max-w-[800px]">
        <Search
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="search"
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setShowResults(true)
          }}
          onFocus={() => setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          placeholder="다른 종목 검색 (예: 산일전기, 062040)"
          className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-9 text-[13px] focus:border-amber-500 focus:bg-white focus:outline-none"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setResults([])
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label="검색어 지우기"
          >
            <X size={14} />
          </button>
        ) : null}

        {showResults && results.length > 0 ? (
          <ul className="absolute top-full left-0 right-0 z-10 mt-1 max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
            {results.map((r) => (
              <li key={r.code}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    navigate(`/pro/stock/${r.code}`)
                    setQuery('')
                    setResults([])
                    setShowResults(false)
                  }}
                  className={`flex w-full items-center justify-between border-b border-gray-100 px-4 py-2.5 text-left last:border-b-0 hover:bg-gray-50 ${
                    r.code === currentCode ? 'bg-amber-50' : ''
                  }`}
                >
                  <span className="text-[13px] font-medium text-gray-900">{r.name}</span>
                  <span className="font-mono text-[11px] tabular-nums text-gray-500">{r.code}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
