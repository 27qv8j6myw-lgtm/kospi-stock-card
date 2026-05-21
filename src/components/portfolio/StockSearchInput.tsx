'use client'

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { Search } from 'lucide-react'

export type StockSearchPick = {
  code: string
  name: string
}

type SearchItem = { code: string; name: string; market?: string; sector?: string }

export type StockSearchInputProps = {
  onSelect: (stock: StockSearchPick) => void
  placeholder?: string
}

/**
 * 서버 `/api/stocks-search` (stocks_master) 기반 종목 검색 — 홈 등에서 사용.
 */
export function StockSearchInput({
  onSelect,
  placeholder = '종목명 또는 6자리 코드',
}: StockSearchInputProps) {
  const listId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<SearchItem[]>([])
  const [active, setActive] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim()
    if (!trimmed) {
      setResults([])
      return
    }
    try {
      setLoadError(null)
      const r = await fetch(`/api/stocks-search?q=${encodeURIComponent(trimmed)}`)
      const data = (await r.json()) as { results?: SearchItem[]; items?: SearchItem[]; error?: string }
      if (!r.ok) {
        setResults([])
        setLoadError(data?.error || `검색 실패 (${r.status})`)
        return
      }
      const rows = Array.isArray(data.results)
        ? data.results
        : Array.isArray(data.items)
          ? data.items
          : []
      setResults(rows)
      setActive(0)
    } catch (e) {
      setResults([])
      setLoadError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    if (!open || !query.trim()) {
      setResults([])
      return
    }
    const t = setTimeout(() => {
      void runSearch(query)
    }, 200)
    return () => clearTimeout(t)
  }, [query, open, runSearch])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const onDoc = (ev: MouseEvent) => {
      if (!el.contains(ev.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const handleSelect = useCallback(
    (row: SearchItem) => {
      const code = String(row.code ?? '')
        .replace(/\D/g, '')
        .padStart(6, '0')
      if (!code || code === '000000') return
      const name = String(row.name ?? '').trim() || code
      console.log('[StockSearchInput] 선택됨:', code)
      onSelect({ code, name })
      setQuery('')
      setOpen(false)
      setResults([])
      inputRef.current?.blur()
    },
    [onSelect],
  )

  const onKeyDown = (ev: KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return
    if (ev.key === 'ArrowDown') {
      ev.preventDefault()
      setActive((i) => Math.min(i + 1, results.length - 1))
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (ev.key === 'Enter') {
      ev.preventDefault()
      handleSelect(results[active])
    } else if (ev.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={wrapRef} className="relative w-full min-w-0">
      <label htmlFor={listId + '-input'} className="sr-only">
        종목 검색
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-info-text/70"
          strokeWidth={2}
          aria-hidden
        />
        <input
          ref={inputRef}
          id={listId + '-input'}
          type="search"
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId + '-listbox'}
          aria-autocomplete="list"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="w-full rounded-xl border border-default/95 bg-card/90 py-2.5 pl-11 pr-3.5 text-[15px] text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] outline-none ring-info-text/20 placeholder:text-tertiary focus:border-info-text/55 focus:ring-2"
        />
      </div>
      {loadError ? <p className="mt-2 text-xs text-danger-text">{loadError}</p> : null}

      {open && query.trim() && results.length > 0 ? (
        <ul
          id={listId + '-listbox'}
          role="listbox"
          className="absolute z-50 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-default/95 bg-card/95 py-1.5 shadow-[var(--shadow-signal-soft)] backdrop-blur-xl"
        >
          {results.map((row, i) => (
            <li key={row.code} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                className={`flex w-full flex-col items-start gap-0.5 px-3.5 py-2.5 text-left text-sm transition-colors ${
                  i === active ? 'bg-info-bg text-primary' : 'text-primary hover:bg-neutral-bg'
                }`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(row)}
              >
                <span className="font-semibold tracking-tight">{row.name}</span>
                <span className="font-mono text-xs tabular-nums text-secondary">{row.code}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {open && query.trim() && !loadError && results.length === 0 ? (
        <p className="absolute z-40 mt-2 w-full rounded-xl border border-default/90 bg-card px-3.5 py-2.5 text-sm text-secondary shadow-md">
          일치하는 종목이 없습니다.
        </p>
      ) : null}
    </div>
  )
}
