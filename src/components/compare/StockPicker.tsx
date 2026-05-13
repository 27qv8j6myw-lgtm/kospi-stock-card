import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { SECTORS, stockNameFromMaster } from '@/data/sectorMaster'

type Props = {
  onSelect: (code: string) => void
  onClose: () => void
  excludeCodes: string[]
}

const QUICK_PICK = [
  { code: '005930', name: '삼성전자' },
  { code: '000660', name: 'SK하이닉스' },
  { code: '062040', name: '산일전기' },
  { code: '267260', name: 'HD현대일렉트릭' },
  { code: '082740', name: '한화엔진' },
  { code: '012450', name: '한화에어로스페이스' },
  { code: '329180', name: 'HD현대중공업' },
  { code: '373220', name: 'LG에너지솔루션' },
]

export function StockPicker({ onSelect, onClose, excludeCodes }: Props) {
  const [query, setQuery] = useState('')
  const exclude = useMemo(() => new Set(excludeCodes.map((c) => c.replace(/\D/g, '').padStart(6, '0'))), [excludeCodes])

  const allStocks = useMemo(
    () =>
      SECTORS.flatMap((s) =>
        s.stockCodes.map((code) => ({
          code: code.replace(/\D/g, '').padStart(6, '0'),
          sector: s.label,
          name: stockNameFromMaster(code),
        })),
      ),
    [],
  )

  const q = query.trim().toLowerCase()
  const filtered = allStocks.filter((s) => {
    if (exclude.has(s.code)) return false
    if (q === '') return true
    if (s.code.includes(q)) return true
    if (s.name.toLowerCase().includes(q)) return true
    return false
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="compare-picker-title"
    >
      <div className="flex max-h-[min(92dvh,calc(100dvh-env(safe-area-inset-bottom)))] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-default border-b-0 bg-card shadow-lg sm:max-h-[85vh] sm:rounded-2xl sm:border-b">
        <div className="flex items-center justify-between border-b border-default px-4 py-3 sm:py-3">
          <h2 id="compare-picker-title" className="text-sm font-semibold text-primary">
            종목 선택
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-secondary transition hover:bg-app hover:text-primary sm:min-h-0 sm:min-w-0 sm:p-2"
            aria-label="닫기"
          >
            <X className="size-5" strokeWidth={2} aria-hidden />
          </button>
        </div>

        <div className="space-y-3 border-b border-default p-4">
          <p className="text-xs text-secondary">빠른 선택</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_PICK.filter((p) => !exclude.has(p.code)).map((p) => (
              <button
                key={p.code}
                type="button"
                onClick={() => onSelect(p.code)}
                className="min-h-[40px] rounded-full border border-default bg-app px-3 py-2 text-xs font-medium text-primary transition hover:border-blue-500 hover:text-blue-600"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-secondary" strokeWidth={2} aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="코드 또는 종목명 검색"
              className="w-full rounded-lg border border-default bg-app py-2.5 pl-10 pr-4 text-sm text-primary outline-none ring-blue-500/30 placeholder:text-secondary focus:ring-2"
              autoFocus
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-[max(env(safe-area-inset-bottom),1rem)] sm:max-h-[min(50vh,22rem)] sm:pb-4">
          <ul className="space-y-0.5">
            {filtered.map((stock) => (
              <li key={stock.code}>
                <button
                  type="button"
                  onClick={() => onSelect(stock.code)}
                  className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-app sm:min-h-0"
                >
                  <span className="min-w-0 truncate font-medium text-primary">{stock.name}</span>
                  <span className="shrink-0 tabular-nums text-xs text-secondary">{stock.code}</span>
                  <span className="hidden max-w-[6rem] shrink-0 truncate text-xs text-secondary sm:inline">{stock.sector}</span>
                </button>
              </li>
            ))}
          </ul>
          {filtered.length === 0 ? <p className="px-3 py-6 text-center text-sm text-secondary">결과 없음</p> : null}
        </div>
      </div>
    </div>
  )
}
