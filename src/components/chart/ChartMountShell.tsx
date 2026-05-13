import { useEffect, useState, type ReactNode } from 'react'

type Props = {
  /** Recharts `ResponsiveContainer`에 전달할 픽셀 높이 (기본 280) */
  height?: number
  className?: string
  children: ReactNode
}

/**
 * SSR·초기 레이아웃·탭 전환 직후 0×0 측정으로 Recharts가 width/height -1 을 내는 경우를 줄이기 위해
 * 클라이언트 마운트 이후에만 차트를 그린다.
 */
export function ChartMountShell({ height = 280, className = '', children }: Props) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const boxStyle = { height, minHeight: height } as const

  if (!mounted) {
    return (
      <div
        className={`w-full min-w-0 shrink-0 ${className}`}
        style={boxStyle}
        aria-hidden
      />
    )
  }

  return (
    <div className={`w-full min-w-0 shrink-0 ${className}`} style={boxStyle}>
      {children}
    </div>
  )
}
