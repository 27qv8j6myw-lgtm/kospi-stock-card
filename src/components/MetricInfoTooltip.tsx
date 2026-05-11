import { useRef } from 'react'
import { Info } from 'lucide-react'
import {
  metricEducation,
  parseClvFromMetricValue,
  formatClvSigned,
  type MetricEducationBlock,
  type MetricInterpretationRow,
} from '../lib/metricEducation'
import type { LogicMetric } from '../types/stock'

type MetricInfoTooltipProps = {
  metric: LogicMetric
  open: boolean
  onOpen: () => void
  onClose: () => void
  onToggle: () => void
  /** 왼쪽 열: start(패널은 오른쪽으로 펼침). 오른쪽 열: end(패널은 왼쪽으로 펼침). */
  tooltipSide: 'start' | 'end'
}

const sectionLabelClass =
  'text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500'

function signedNumberClass(n: number): string {
  if (n > 0) return 'font-semibold text-rose-600'
  if (n < 0) return 'font-semibold text-sky-600'
  return 'font-semibold text-slate-700'
}

function highlightSignedNumbers(text: string) {
  const parts = text.split(/([+-]?\d+(?:\.\d+)?)/g)
  return parts.map((part, i) => {
    if (/^[+-]?\d+(?:\.\d+)?$/.test(part)) {
      const v = Number(part)
      return (
        <span key={i} className={signedNumberClass(v)}>
          {part}
        </span>
      )
    }
    return <span key={i}>{part}</span>
  })
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-3.5 sm:px-4 sm:py-4">
      {children}
    </div>
  )
}

function InterpretationList({
  rows,
  title,
}: {
  rows: MetricInterpretationRow[]
  title: string
}) {
  return (
    <SectionCard>
      <p className={sectionLabelClass}>{title}</p>
      <ul className="mt-3 space-y-3">
        {rows.map((row) => (
          <li key={row.label} className="text-xs leading-relaxed text-slate-700">
            <span className="font-semibold text-slate-900">{highlightSignedNumbers(row.label)}</span>
            <span className="text-slate-400"> — </span>
            <span>{highlightSignedNumbers(row.meaning)}</span>
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}

function CandleQualityTooltipBody({
  metric,
  edu,
}: {
  metric: LogicMetric
  edu: MetricEducationBlock
}) {
  const { clv5, clv10 } = parseClvFromMetricValue(metric.value)

  return (
    <div className="space-y-5 sm:space-y-4">
      <div>
        <h4 className="text-sm font-semibold leading-snug text-slate-900">{edu.title}</h4>
        {edu.tooltipTagline ? (
          <p className="mt-2 text-[11px] leading-relaxed text-slate-600">{edu.tooltipTagline}</p>
        ) : null}
      </div>

      {clv5 != null || clv10 != null ? (
        <SectionCard>
          <p className={sectionLabelClass}>현재 값</p>
          <div className="mt-2 space-y-1.5 text-xs tabular-nums">
            {clv5 != null ? (
              <p className="leading-relaxed">
                <span className="text-slate-600">CLV5 </span>
                <span className={signedNumberClass(clv5)}>{formatClvSigned(clv5)}</span>
              </p>
            ) : null}
            {clv10 != null ? (
              <p className="leading-relaxed">
                <span className="text-slate-600">CLV10 </span>
                <span className={signedNumberClass(clv10)}>{formatClvSigned(clv10)}</span>
              </p>
            ) : null}
          </div>
        </SectionCard>
      ) : null}

      <SectionCard>
        <p className={sectionLabelClass}>쉬운 설명</p>
        <p className="mt-2 text-xs leading-relaxed text-slate-700">{edu.simple}</p>
      </SectionCard>

      <SectionCard>
        <p className={sectionLabelClass}>왜 중요한가</p>
        <p className="mt-2 text-xs leading-relaxed text-slate-700">{edu.why}</p>
      </SectionCard>

      {edu.concepts?.length ? (
        <SectionCard>
          <p className={sectionLabelClass}>CLV란?</p>
          <ul className="mt-3 space-y-3">
            {edu.concepts.map((c) => (
              <li key={c.name} className="text-xs leading-relaxed text-slate-700">
                <span className="font-semibold text-slate-900">{c.name}</span>
                <span className="text-slate-400"> — </span>
                {c.description}
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <InterpretationList rows={edu.interpretation} title="숫자·구간 읽는 법" />

      {edu.additionalMetrics?.length ? (
        <SectionCard>
          <p className={sectionLabelClass}>CLV5 · CLV10</p>
          <ul className="mt-3 space-y-3">
            {edu.additionalMetrics.map((m) => (
              <li key={m.name} className="text-xs leading-relaxed text-slate-700">
                <span className="font-semibold text-slate-900">{m.name}</span>
                <span className="text-slate-400"> — </span>
                {m.description}
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      {edu.howToRead?.length ? (
        <InterpretationList rows={edu.howToRead} title="둘을 같이 읽는 법" />
      ) : null}

      <SectionCard>
        <p className={sectionLabelClass}>예시</p>
        <p className="mt-2 text-xs leading-relaxed text-slate-700">
          {highlightSignedNumbers(edu.example)}
        </p>
      </SectionCard>

      <SectionCard>
        <p className={sectionLabelClass}>핵심 요약</p>
        <p className="mt-2 text-xs font-medium leading-relaxed text-slate-800">{edu.takeaway}</p>
      </SectionCard>
    </div>
  )
}

export function MetricInfoTooltip({
  metric,
  open,
  onOpen,
  onClose,
  onToggle,
  tooltipSide,
}: MetricInfoTooltipProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const edu = metricEducation[metric.descriptionKey]
  const isCandleQuality = metric.descriptionKey === 'candleQuality'
  const alignClass = tooltipSide === 'start' ? 'left-0' : 'right-0'

  return (
    <div
      ref={wrapRef}
      className="relative ml-1 shrink-0"
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
        aria-label={`${edu.title} 지표 설명 보기`}
        className="rounded-full p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300"
      >
        <Info className="size-3.5" />
      </button>
      <div
        className={`absolute top-6 z-[80] ${
          isCandleQuality
            ? 'w-[min(22.5rem,calc(100vw-1.25rem))]'
            : 'w-[min(20.5rem,calc(100vw-1.25rem))]'
        } max-h-[min(78vh,32rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 text-left shadow-xl sm:p-5 transition-all duration-150 ${alignClass} ${
          open
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : 'pointer-events-none -translate-y-1 opacity-0'
        }`}
      >
        {isCandleQuality ? (
          <CandleQualityTooltipBody metric={metric} edu={edu} />
        ) : (
          <>
            <h4 className="text-sm font-semibold leading-snug text-slate-900">{edu.title}</h4>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              이 카드 표시: <span className="font-medium text-slate-700">{metric.value}</span>
              {metric.subValue ? (
                <>
                  {' '}
                  <span className="text-slate-400">·</span> {metric.subValue}
                </>
              ) : null}
            </p>

            <hr className="my-3 border-slate-200" />

            <p className={sectionLabelClass}>쉬운 설명</p>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-700">{edu.simple}</p>

            <hr className="my-3 border-slate-200" />

            <p className={sectionLabelClass}>왜 중요한가</p>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-700">{edu.why}</p>

            <hr className="my-3 border-slate-200" />

            <p className={sectionLabelClass}>숫자·표현 읽는 법</p>
            <ul className="mt-2 space-y-2.5">
              {edu.interpretation.map((row) => (
                <li key={row.label} className="text-xs leading-relaxed text-slate-700">
                  <span className="font-semibold text-slate-900">{row.label}</span>
                  <span className="text-slate-400"> — </span>
                  {row.meaning}
                </li>
              ))}
            </ul>

            <hr className="my-3 border-slate-200" />

            <p className={sectionLabelClass}>예시</p>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-700">{edu.example}</p>

            <hr className="my-3 border-slate-200" />

            <p className={sectionLabelClass}>핵심 요약</p>
            <p className="mt-1.5 text-xs font-medium leading-relaxed text-slate-800">{edu.takeaway}</p>

            {metric.descriptionKey === 'supply' && metric.tooltipSummary ? (
              <>
                <hr className="my-3 border-slate-200" />
                <p className={sectionLabelClass}>이 종목 수급 요약</p>
                <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-slate-700">
                  {metric.tooltipSummary}
                </p>
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
