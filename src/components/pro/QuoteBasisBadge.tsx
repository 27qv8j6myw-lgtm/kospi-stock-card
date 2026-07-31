/**
 * 표시 시세가 정규장 종가와 다른 시간대(NXT 프리·애프터마켓)임을 알리는 배지.
 * 서버가 라벨을 내려주지 않으면(정규장 중이거나 KRX 단독 조회) 아무것도 그리지 않는다.
 */
export function QuoteBasisBadge({
  label,
  className = '',
}: {
  label?: string | null
  className?: string
}) {
  if (!label) return null
  return (
    <span
      title="KRX 정규장 외 시간대라 넥스트레이드(NXT) 체결가가 반영된 통합 시세입니다"
      className={`inline-flex shrink-0 items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 ${className}`}
    >
      {label}
    </span>
  )
}
