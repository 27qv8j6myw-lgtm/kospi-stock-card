import { useCallback, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { StockPicker } from '../components/compare/StockPicker'
import { CompareCardGrid } from '../components/compare/CompareCardGrid'
import { CompareChart } from '../components/compare/CompareChart'
import { stockNameFromMaster } from '../data/sectorMaster'

function normalizeCode(raw: string): string {
  return raw.replace(/\D/g, '').padStart(6, '0')
}

export default function ComparePage() {
  const [stockCodes, setStockCodes] = useState<string[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)

  const addStock = useCallback((code: string) => {
    const c = normalizeCode(code)
    if (stockCodes.includes(c)) return
    if (stockCodes.length >= 5) {
      window.alert('최대 5개까지 비교 가능합니다.')
      return
    }
    setStockCodes((prev) => [...prev, c])
    setPickerOpen(false)
  }, [stockCodes])

  const removeStock = useCallback((code: string) => {
    setStockCodes((prev) => prev.filter((x) => x !== code))
  }, [])

  return (
    <main className="mx-auto min-w-0 max-w-[100vw] space-y-6 overflow-x-hidden px-4 py-6 sm:px-6 sm:py-8">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold text-primary sm:text-xl">종목 비교 분석</h1>
        <p className="text-sm text-secondary">최대 5개 종목 나란히 비교합니다.</p>
      </header>

      <section className="flex flex-wrap items-center gap-2" aria-label="선택된 종목">
        {stockCodes.map((code) => (
          <StockChip key={code} code={code} onRemove={() => removeStock(code)} />
        ))}
        {stockCodes.length < 5 ? (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex min-h-[44px] items-center gap-1 rounded-lg border border-dashed border-default px-3 py-2 text-sm text-secondary transition hover:border-blue-500 hover:text-blue-600"
          >
            <Plus className="size-4 shrink-0" strokeWidth={2} aria-hidden />
            종목 추가
          </button>
        ) : null}
      </section>

      {stockCodes.length === 0 ? (
        <div
          className="flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border border-default bg-card/60 px-4 py-16 text-center"
          role="status"
        >
          <p className="text-sm font-medium text-primary">비교할 종목을 추가하세요</p>
          <p className="mt-2 max-w-sm text-xs leading-relaxed text-secondary">
            2~5개 종목을 나란히 비교할 수 있습니다. 우선 1개만 추가해도 점수·지표를 카드로 확인할 수 있습니다.
          </p>
        </div>
      ) : null}

      {stockCodes.length >= 1 ? (
        <div className="space-y-6">
          <CompareCardGrid stockCodes={stockCodes} />
          {stockCodes.length >= 2 ? <CompareChart stockCodes={stockCodes} /> : null}
        </div>
      ) : null}

      {pickerOpen ? (
        <StockPicker onSelect={addStock} onClose={() => setPickerOpen(false)} excludeCodes={stockCodes} />
      ) : null}
    </main>
  )
}

function StockChip({ code, onRemove }: { code: string; onRemove: () => void }) {
  const name = stockNameFromMaster(code)
  return (
    <span className="inline-flex min-h-[40px] max-w-full items-center gap-1 rounded-full border border-default bg-card py-1 pl-3 pr-1 text-sm text-primary">
      <span className="max-w-[10rem] truncate font-medium">{name}</span>
      <span className="text-xs text-secondary tabular-nums">{code}</span>
      <button
        type="button"
        onClick={onRemove}
        className="inline-flex min-h-[40px] items-center justify-center rounded-full p-2 text-secondary transition hover:bg-app hover:text-primary"
        aria-label={`${name} 제거`}
      >
        <X className="size-3.5" strokeWidth={2} aria-hidden />
      </button>
    </span>
  )
}
