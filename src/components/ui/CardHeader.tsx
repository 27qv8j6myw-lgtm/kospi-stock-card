import type { ReactNode } from 'react'

type CardHeaderProps = {
  icon: ReactNode
  label: string
  rightSlot?: ReactNode
  className?: string
}

/**
 * 아이콘/타이틀 헤더의 시각 정렬을 강제 보정한다.
 * - 컨테이너 높이 24px 고정
 * - 아이콘/텍스트 라인박스 20px 정렬
 * - Pretendard 한글 시각 중심 보정: 텍스트 +0.5px
 */
export function CardHeader({ icon, label, rightSlot, className = '' }: CardHeaderProps) {
  return (
    <div
      className={`flex items-center justify-between ${className}`.trim()}
      style={{ height: '24px' }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          className="inline-flex size-5 shrink-0 items-center justify-center [&_svg]:block"
          style={{ lineHeight: '20px' }}
          aria-hidden
        >
          {icon}
        </span>
        <span
          className="truncate text-[15px] font-semibold text-primary"
          style={{ lineHeight: '20px', transform: 'translateY(0.5px)' }}
        >
          {label}
        </span>
      </div>
      {rightSlot ? <div className="ml-2 flex shrink-0 items-center gap-1.5">{rightSlot}</div> : null}
    </div>
  )
}
