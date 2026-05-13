import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'
import type { IndicatorTooltipBlock } from '../../lib/indicatorTooltipCopy'

type IndicatorHelpTooltipProps = {
  content: IndicatorTooltipBlock
  /** 3열 기준 0=좌·1=중·2=우 — 패널 가로 정렬 */
  columnIndex?: 0 | 1 | 2
}

type PanelPos = { top: number; left: number; width: number }

function computePanelPos(trigger: HTMLElement, columnIndex: 0 | 1 | 2): PanelPos {
  const r = trigger.getBoundingClientRect()
  const maxW = Math.min(320, Math.max(200, window.innerWidth - 32))
  const margin = 8
  let left = r.left + r.width / 2 - maxW / 2
  if (columnIndex === 0) left = r.left
  if (columnIndex === 2) left = r.right - maxW
  left = Math.max(margin, Math.min(left, window.innerWidth - maxW - margin))
  const top = r.bottom + 6
  return { top, left, width: maxW }
}

export function IndicatorHelpTooltip({ content, columnIndex = 1 }: IndicatorHelpTooltipProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<PanelPos | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const updatePos = useCallback(() => {
    const el = wrapRef.current
    if (!el || !open) return
    setPos(computePanelPos(el, columnIndex))
  }, [open, columnIndex])

  useLayoutEffect(() => {
    if (!open) return
    updatePos()
  }, [open, updatePos])

  useEffect(() => {
    if (!open) return
    const onScroll = () => updatePos()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open, updatePos])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node
      if (wrapRef.current?.contains(t)) return
      if (panelRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close, { passive: true })
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const panel =
    open && pos && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={`${content.title} 안내`}
            className="fixed z-[400] max-h-[min(70vh,24rem)] overflow-y-auto rounded-xl border border-default bg-card px-3 py-3 text-left shadow-lg"
            style={{
              top: pos.top,
              left: pos.left,
              width: pos.width,
              maxWidth: 'calc(100vw - 2rem)',
            }}
          >
            <p className="text-sm font-semibold text-primary">{content.title}</p>
            <p className="mt-2 text-sm font-medium leading-snug text-primary">{content.description}</p>
            <p className="mt-2 text-xs leading-relaxed text-tertiary">{content.thresholds}</p>
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <div ref={wrapRef} className="relative inline-flex shrink-0">
        <button
          type="button"
          className="-m-1 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded p-1 text-tertiary transition-colors hover:bg-black/[0.04] hover:text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-medium sm:min-h-0 sm:min-w-0"
          aria-expanded={open}
          aria-label={`${content.title} 지표 안내`}
          onClick={(e) => {
            e.stopPropagation()
            setOpen((v) => !v)
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Info className="size-3.5 sm:size-3.5" strokeWidth={1.75} aria-hidden />
        </button>
      </div>
      {panel}
    </>
  )
}
