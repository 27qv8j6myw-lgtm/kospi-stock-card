import { changeToneClass } from '@/lib/stockCardDesignTokens'

type Analyst = {
  targetPrice?: number
  upside?: number | null
  opinion?: string | null
}

const highlight =
  'rounded-lg border border-blue-200 bg-blue-50 p-3'

export function ProAnalystSummary({ analyst }: { analyst: Analyst }) {
  const upside = analyst.upside

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className={highlight}>
        <div className="mb-1 text-[10px] font-bold text-blue-700">평균 목표주가</div>
        <div className="text-[14px] font-bold tabular-nums text-blue-900">
          {analyst.targetPrice?.toLocaleString() ?? '—'}원
        </div>
        {upside != null ? (
          <div className={`mt-0.5 text-[10px] font-semibold ${changeToneClass(upside)}`}>
            {upside > 0 ? '+' : ''}
            {upside}% 상승여력
          </div>
        ) : null}
      </div>
      <div className={highlight}>
        <div className="mb-1 text-[10px] font-bold text-blue-700">투자의견</div>
        <div className="text-[13px] font-bold text-blue-900">{analyst.opinion || '—'}</div>
      </div>
    </div>
  )
}
