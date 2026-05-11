import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { Search } from 'lucide-react'
import { searchStocks, type StockRow } from '../lib/stockSearch'

export type StockNameSearchProps = {
  value: string
  onChange: (v: string) => void
  onPick: (code: string, nameKr: string) => void
  /** 컴팩트 모드: 라벨 숨김 */
  compact?: boolean
}

export function StockNameSearch({
  value,
  onChange,
  onPick,
  compact = false,
}: StockNameSearchProps) {
  const listId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<StockRow[]>([])
  const [active, setActive] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)

  const runSearch = useCallback(async (q: string) => {
    try {
      setLoadError(null)
      const r = await searchStocks(q, 18)
      setResults(r)
      setActive(0)
    } catch (e) {
      setResults([])
      setLoadError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    if (!open || !value.trim()) {
      setResults([])
      return
    }
    const t = setTimeout(() => {
      void runSearch(value)
    }, 200)
    return () => clearTimeout(t)
  }, [value, open, runSearch])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const onDoc = (ev: MouseEvent) => {
      if (!el.contains(ev.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const pick = (row: StockRow) => {
    onPick(row.c, row.n)
    setOpen(false)
    inputRef.current?.blur()
  }

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
      pick(results[active])
    } else if (ev.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={wrapRef} className="relative min-w-0 flex-1">
      <label
        htmlFor={listId + '-input'}
        className={
          compact
            ? 'sr-only'
            : 'mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500'
        }
      >
        종목 검색
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-sky-500/70"
          strokeWidth={2}
        />
        <input
          ref={inputRef}
          id={listId + '-input'}
          type="search"
          autoComplete="off"
          spellCheck={false}
          placeholder="종목명 또는 6자리 코드"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId + '-listbox'}
          aria-autocomplete="list"
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            onChange('')
            setOpen(true)
          }}
          onKeyDown={onKeyDown}
          className="w-full rounded-xl border border-slate-200/95 bg-white/90 py-2.5 pl-11 pr-3.5 text-[15px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] outline-none ring-sky-400/20 placeholder:text-slate-400 focus:border-sky-400/55 focus:ring-2"
        />
      </div>
      {loadError ? <p className="mt-2 text-xs text-rose-600">{loadError}</p> : null}

      {open && value.trim() && results.length > 0 ? (
        <ul
          id={listId + '-listbox'}
          role="listbox"
          className="absolute z-50 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-slate-200/95 bg-white/95 py-1.5 shadow-[var(--shadow-signal-soft)] backdrop-blur-xl"
        >
          {results.map((row, i) => (
            <li key={row.c} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                className={`flex w-full flex-col items-start gap-0.5 px-3.5 py-2.5 text-left text-sm transition-colors ${
                  i === active
                    ? 'bg-sky-50 text-sky-950'
                    : 'text-slate-800 hover:bg-slate-50'
                }`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(row)}
              >
                <span className="font-semibold tracking-tight">{row.n}</span>
                <span className="font-mono text-xs tabular-nums text-slate-500">
                  {row.c}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {open && value.trim() && !loadError && results.length === 0 ? (
        <p className="absolute z-40 mt-2 w-full rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm text-slate-500 shadow-md">
          일치하는 종목이 없습니다.
        </p>
      ) : null}
    </div>
  )
}
