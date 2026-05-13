import { useEffect, useRef } from 'react'
import { Info } from 'lucide-react'
import {
  executionEducation,
  type ExecutionEducationKey,
} from '../lib/executionEducation'

type ExecutionInfoTooltipProps = {
  educationKey: ExecutionEducationKey
  open: boolean
  onOpen: () => void
  onClose: () => void
  onToggle: () => void
  tooltipSide: 'start' | 'end'
}

const sectionLabelClass =
  'text-[10px] font-semibold uppercase tracking-[0.08em] text-tertiary'

export function ExecutionInfoTooltip({
  educationKey,
  open,
  onOpen: _onOpen,
  onClose,
  onToggle,
  tooltipSide,
}: ExecutionInfoTooltipProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const edu = executionEducation[educationKey]
  const alignClass = tooltipSide === 'start' ? 'left-0' : 'right-0'

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node
      if (wrapRef.current?.contains(t)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close, { passive: true })
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  return (
    <div ref={wrapRef} className="relative ml-1 inline-flex shrink-0">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
        onPointerDown={(e) => e.stopPropagation()}
        aria-expanded={open}
        aria-label={`${edu.title} 설명 보기`}
        className="-m-1 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full p-1 text-tertiary transition-colors hover:bg-app hover:text-secondary focus:outline-none focus:ring-2 focus:ring-medium sm:min-h-0 sm:min-w-0 sm:p-0.5"
      >
        <Info className="size-3.5" />
      </button>
      <div
        className={`absolute top-6 z-[90] w-[min(20rem,calc(100vw-2rem))] max-h-[min(72vh,26rem)] overflow-y-auto rounded-xl border border-medium bg-primary p-4 text-left shadow-2xl transition-all duration-150 ${alignClass} ${
          open
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : 'pointer-events-none -translate-y-1 opacity-0'
        }`}
      >
        <h4 className="text-sm font-semibold leading-snug text-card">{edu.title}</h4>

        <hr className="my-3 border-default/40" />

        <p className={sectionLabelClass}>쉬운 설명</p>
        <p className="mt-1.5 text-xs leading-relaxed text-tertiary">{edu.simple}</p>

        <hr className="my-3 border-default/40" />

        <p className={sectionLabelClass}>왜 중요한가</p>
        <p className="mt-1.5 text-xs leading-relaxed text-tertiary">{edu.why}</p>

        <hr className="my-3 border-default/40" />

        <p className={sectionLabelClass}>읽는 법</p>
        <ul className="mt-2 space-y-2.5">
          {edu.howToRead.map((row) => (
            <li key={row.label} className="text-xs leading-relaxed text-tertiary">
              <span className="font-semibold text-card">{row.label}</span>
              <span className="text-secondary"> — </span>
              {row.meaning}
            </li>
          ))}
        </ul>

        <hr className="my-3 border-default/40" />

        <p className={sectionLabelClass}>핵심</p>
        <p className="mt-1.5 text-xs font-medium leading-relaxed text-card">{edu.takeaway}</p>
      </div>
    </div>
  )
}
