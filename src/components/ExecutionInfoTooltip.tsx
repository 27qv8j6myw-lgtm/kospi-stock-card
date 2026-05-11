import { useRef } from 'react'
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
  'text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400'

export function ExecutionInfoTooltip({
  educationKey,
  open,
  onOpen,
  onClose,
  onToggle,
  tooltipSide,
}: ExecutionInfoTooltipProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const edu = executionEducation[educationKey]
  const alignClass = tooltipSide === 'start' ? 'left-0' : 'right-0'

  return (
    <div
      ref={wrapRef}
      className="relative ml-1 inline-flex shrink-0"
      onMouseEnter={() => {
        onOpen()
      }}
      onMouseLeave={onClose}
    >
      <button
        type="button"
        onClick={() => {
          onToggle()
        }}
        aria-label={`${edu.title} 설명 보기`}
        className="rounded-full p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
      >
        <Info className="size-3.5" />
      </button>
      <div
        className={`absolute top-6 z-[90] w-[min(20rem,calc(100vw-1.25rem))] max-h-[min(72vh,26rem)] overflow-y-auto rounded-xl border border-slate-600 bg-slate-900 p-4 text-left shadow-2xl transition-all duration-150 ${alignClass} ${
          open
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : 'pointer-events-none -translate-y-1 opacity-0'
        }`}
      >
        <h4 className="text-sm font-semibold leading-snug text-slate-50">{edu.title}</h4>

        <hr className="my-3 border-slate-700" />

        <p className={sectionLabelClass}>쉬운 설명</p>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-300">{edu.simple}</p>

        <hr className="my-3 border-slate-700" />

        <p className={sectionLabelClass}>왜 중요한가</p>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-300">{edu.why}</p>

        <hr className="my-3 border-slate-700" />

        <p className={sectionLabelClass}>읽는 법</p>
        <ul className="mt-2 space-y-2.5">
          {edu.howToRead.map((row) => (
            <li key={row.label} className="text-xs leading-relaxed text-slate-300">
              <span className="font-semibold text-slate-100">{row.label}</span>
              <span className="text-slate-500"> — </span>
              {row.meaning}
            </li>
          ))}
        </ul>

        <hr className="my-3 border-slate-700" />

        <p className={sectionLabelClass}>핵심</p>
        <p className="mt-1.5 text-xs font-medium leading-relaxed text-slate-100">{edu.takeaway}</p>
      </div>
    </div>
  )
}
