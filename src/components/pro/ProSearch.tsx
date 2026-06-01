import { useCallback, useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { useAppNavigation } from '@/hooks/useAppNavigation'
import { proSearchInputProps } from '@/lib/proSearchInputProps'

type SearchResult = { code: string; name: string; market?: string; sector?: string }

function parseSearchRows(data: unknown): SearchResult[] {
  if (!data || typeof data !== 'object') return []
  const d = data as { results?: SearchResult[]; items?: SearchResult[] }
  if (Array.isArray(d.results)) return d.results
  if (Array.isArray(d.items)) return d.items
  return []
}

export function ProSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const searchSeqRef = useRef(0)
  const { navigate } = useAppNavigation()

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim()
    if (!trimmed) {
      setResults([])
      setLoadError(null)
      return
    }

    const seq = ++searchSeqRef.current

    try {
      setLoadError(null)
      const url = `/api/stocks-search?q=${encodeURIComponent(trimmed)}`
      const r = await fetch(url)

      if (seq !== searchSeqRef.current) return

      const data = (await r.json()) as { results?: SearchResult[]; items?: SearchResult[]; error?: string }

      if (!r.ok) {
        setResults([])
        setLoadError(data?.error || `검색 실패 (${r.status})`)
        return
      }

      const rows = parseSearchRows(data)
      setResults(rows)
    } catch (e) {
      if (seq !== searchSeqRef.current) return
      setResults([])
      setLoadError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    if (!open || !query.trim()) {
      setResults([])
      setLoadError(null)
      return
    }
    const t = setTimeout(() => {
      void runSearch(query)
    }, 200)
    return () => clearTimeout(t)
  }, [query, open, runSearch])

  return (
    <div className="relative mb-4">
      <div className="relative">
        <Search
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          {...proSearchInputProps}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="종목 검색 (자동 종합 분석)"
          className="pro-search-input w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-base focus:border-amber-500 focus:outline-none md:text-[13px]"
        />
      </div>

      {loadError ? (
        <p className="mt-2 text-[11px] text-red-600">{loadError}</p>
      ) : null}

      {open && query.trim().length >= 2 && !loadError && results.length === 0 ? (
        <div className="absolute z-50 mt-2 w-full rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-800 shadow-md">
          검색 결과가 없습니다. 종목 코드 6자리(예: 062040)로 검색하면 KIS에서 자동 등록됩니다.
        </div>
      ) : null}

      {open && results.length > 0 ? (
        <ul className="absolute z-50 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
          {results.map((r) => (
            <li key={r.code}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  navigate(`/pro/stock/${r.code}`)
                  setQuery('')
                  setResults([])
                  setOpen(false)
                }}
                className="flex w-full items-center justify-between border-b border-gray-100 px-4 py-2.5 text-left last:border-b-0 hover:bg-gray-50"
              >
                <span className="text-[13px] font-medium text-gray-900">{r.name}</span>
                <span className="font-mono text-[11px] tabular-nums text-gray-500">{r.code}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
