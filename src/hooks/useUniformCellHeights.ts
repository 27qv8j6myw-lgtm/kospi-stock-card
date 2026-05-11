import { useCallback, useLayoutEffect, useRef } from 'react'

/**
 * 컨테이너 내부 `[data-uniform-cell]` 요소의 높이를,
 * 해당 섹션에서 가장 큰 자연 높이에 맞춥니다.
 * @param layoutKey 그리드 내용이 바뀔 때마다 달라지는 문자열(재측정 트리거)
 */
export function useUniformCellHeights(layoutKey: string | number) {
  const ref = useRef<HTMLDivElement>(null)

  const measure = useCallback(() => {
    const root = ref.current
    if (!root) return
    const cells = root.querySelectorAll<HTMLElement>('[data-uniform-cell]')
    if (!cells.length) return
    cells.forEach((el) => {
      el.style.minHeight = ''
    })
    void root.offsetHeight
    let max = 0
    cells.forEach((el) => {
      max = Math.max(max, el.getBoundingClientRect().height)
    })
    const h = Math.ceil(max)
    if (h <= 0) return
    cells.forEach((el) => {
      el.style.minHeight = `${h}px`
    })
  }, [])

  useLayoutEffect(() => {
    measure()
    const root = ref.current
    const ro = root ? new ResizeObserver(() => measure()) : null
    if (root && ro) ro.observe(root)
    window.addEventListener('resize', measure)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [measure, layoutKey])

  return ref
}
