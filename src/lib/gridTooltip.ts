import { useEffect, useState } from 'react'

/** Tailwind `sm`(640) · `lg`(1024) 과 로직/실행 그리드 열 수 정합 */
export function useMediaGridColumns(): 1 | 2 | 3 {
  const [cols, setCols] = useState<1 | 2 | 3>(() => readGridColumns())

  useEffect(() => {
    const onResize = () => setCols(readGridColumns())
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return cols
}

function readGridColumns(): 1 | 2 | 3 {
  if (typeof window === 'undefined') return 3
  const w = window.innerWidth
  if (w >= 1024) return 3
  if (w >= 640) return 2
  return 1
}

/** 슬롯 인덱스 → 툴팁 정렬용 열 (0 좌 / 1 중 / 2 우) */
export function gridSlotColumnIndex(index: number, columns: 1 | 2 | 3): 0 | 1 | 2 {
  if (columns === 1) return 1
  if (columns === 2) return index % 2 === 0 ? 0 : 2
  const c = index % 3
  return (c === 0 ? 0 : c === 1 ? 1 : 2) as 0 | 1 | 2
}

export function tooltipAlignFromColumn(column: 0 | 1 | 2): 'start' | 'center' | 'end' {
  if (column === 0) return 'start'
  if (column === 1) return 'center'
  return 'end'
}
