type Week52 = { high52w?: number; low52w?: number }

export function ProRange52Week({
  week52,
  currentPrice,
  bare = false,
}: {
  week52: Week52
  currentPrice?: number
  /** @deprecated 외부 박스 없이 컴포넌트 자체 스타일 사용 */
  bare?: boolean
}) {
  if (!week52.high52w || !week52.low52w || !currentPrice) return null

  const high = week52.high52w
  const low = week52.low52w
  const current = currentPrice
  const range = high - low
  if (range <= 0) return null

  const position = Math.min(Math.max(((current - low) / range) * 100, 0), 100)
  const pctFromHigh = (((current - high) / high) * 100).toFixed(1)

  const wrapClass = bare ? 'pt-6' : 'rounded-md border border-gray-200 bg-white p-3'

  return (
    <div className={wrapClass}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12px] text-gray-500">52주 범위</span>
        <span className="text-[13px] font-bold text-blue-600">{pctFromHigh}%</span>
      </div>

      <div className="space-y-2 md:hidden">
        <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 p-2">
          <span className="text-[11px] font-semibold text-red-700">52주 최고</span>
          <span className="text-[13px] font-bold tabular-nums text-red-700">
            {high.toLocaleString()}원
          </span>
        </div>
        <div className="flex items-center justify-between rounded-md bg-gray-900 p-2">
          <span className="text-[11px] font-semibold text-white">현재가</span>
          <span className="text-[13px] font-bold tabular-nums text-white">
            {current.toLocaleString()}원
          </span>
        </div>
        <div className="flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 p-2">
          <span className="text-[11px] font-semibold text-blue-700">52주 최저</span>
          <span className="text-[13px] font-bold tabular-nums text-blue-700">
            {low.toLocaleString()}원
          </span>
        </div>
      </div>

      <div className="hidden md:block">
        <div className="relative h-1.5 rounded-full bg-gradient-to-r from-blue-200 via-amber-200 to-red-200">
          <div
            className="absolute -top-1 h-3.5 w-2 rounded-sm bg-gray-900"
            style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
          />
          <div
            className="absolute -top-9 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-[10px] font-bold text-white"
            style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
          >
            {current.toLocaleString()}원
          </div>
        </div>
        <div className="mt-2 flex justify-between text-[10px] tabular-nums text-gray-500">
          <span>{low.toLocaleString()}</span>
          <span>{high.toLocaleString()}</span>
        </div>
      </div>
    </div>
  )
}
