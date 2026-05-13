import {
  cloneElement,
  isValidElement,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react'
import type { LogicMetric } from '../../types/stock'
import type { IndicatorTooltipBlock } from '../../lib/indicatorTooltipCopy'
import { getIndicatorTooltipCopy } from '../../lib/indicatorTooltipCopy'
import { Card } from './Card'
import { CardHeader } from './CardHeader'
import { IndicatorHelpTooltip } from './IndicatorHelpTooltip'
import { iconColorIconClass, severityRiskLabel, type IconColorToken, type SeverityToken } from './iconTokens'

export type IndicatorCardProps = HTMLAttributes<HTMLDivElement> & {
  icon: ReactNode
  iconColor: IconColorToken
  label: string
  primary: string
  /** 라벨+값 2행(수급/컨센서스 등) — 있으면 primary/primarySlot보다 우선 */
  primaryRows?: Array<{ label: string; value: string; valueColorClass?: string }>
  /** primary 대신 커스텀 본문(수급·컨센 2행 등) */
  primarySlot?: ReactNode
  /** 숫자·퍼센트 등 영문 숫자 타이포 */
  primaryNumeric?: boolean
  /** 주요값 색 (valueEmphasis 등) — primarySlot 미사용 시 */
  primaryClassName?: string
  sub?: string
  subClassName?: string
  /** true면 sub 영역 자체를 렌더하지 않음(수급 카드 등) */
  hideSub?: boolean
  severity?: SeverityToken
  /** 툴팁 문구 매핑용 */
  descriptionKey: LogicMetric['descriptionKey']
  /** ⓘ 정적 COPY 대신 사용 */
  tooltipContent?: IndicatorTooltipBlock
  /** 우측 상단 커스텀 뱃지(컨센서스 "평균 도달" 등) — 있으면 severity 라벨 대신 표시 */
  cornerBadge?: string
  /** 우측 상단 보조 텍스트 (예: 섹터 "관심") */
  supportTag?: string
  /** 그리드 열 (0 좌 / 1 중 / 2 우) — 인포 툴팁 Radix align */
  tooltipColumnIndex?: 0 | 1 | 2
}

function renderIcon(icon: ReactNode, colorClass: string): ReactNode {
  if (!isValidElement(icon)) return icon
  const el = icon as ReactElement<{ className?: string; strokeWidth?: number }>
  const merged = [colorClass, 'size-5 shrink-0', el.props.className].filter(Boolean).join(' ')
  return cloneElement(el, {
    className: merged,
    strokeWidth: el.props.strokeWidth ?? 1.875,
  })
}

export function IndicatorCard({
  icon,
  iconColor,
  label,
  primary,
  primaryRows,
  primarySlot,
  primaryNumeric = false,
  primaryClassName,
  sub,
  subClassName,
  hideSub = false,
  severity = 'normal',
  descriptionKey,
  tooltipContent,
  cornerBadge,
  supportTag,
  tooltipColumnIndex = 1,
  className = '',
  ...rest
}: IndicatorCardProps) {
  const risk = cornerBadge ? null : severityRiskLabel(severity)
  const iconTone = iconColorIconClass(iconColor)
  const tip = tooltipContent ?? getIndicatorTooltipCopy(descriptionKey)

  const unifiedPrimaryCls = `line-clamp-3 min-h-0 text-lg font-bold leading-snug ${primaryClassName ?? 'text-primary'} ${
    primaryNumeric ? 'font-sans-en tabular-nums' : ''
  }`.trim()

  const rows = Array.isArray(primaryRows) ? primaryRows : null
  const rowsSlot = rows?.length ? (
    <div className="flex w-full flex-col gap-1.5">
      {rows.map((row) => (
        <div key={`${row.label}:${row.value}`} className="flex w-full items-baseline justify-between gap-2">
          <span className="min-w-[60px] shrink-0 text-[13px] font-medium text-secondary">{row.label}</span>
          <span
            className={`text-right font-sans-en text-lg font-bold tabular-nums ${
              row.valueColorClass ?? 'text-primary'
            }`.trim()}
          >
            {row.value}
          </span>
        </div>
      ))}
    </div>
  ) : null

  return (
    <Card
      variant="flat"
      padding="none"
      radius="lg"
      className={`relative min-h-[120px] h-full overflow-hidden shadow-card ${className}`.trim()}
      {...rest}
    >
      <div className="flex h-full min-h-0 flex-col gap-1.5 p-3">
        <div className="shrink-0">
          <CardHeader
            icon={renderIcon(icon, iconTone)}
            label={label}
            rightSlot={
              <>
                {supportTag ? (
                  <span className="max-w-[4.5rem] truncate text-[12px] font-medium text-secondary sm:max-w-[6rem]">
                    {supportTag}
                  </span>
                ) : null}
                {cornerBadge ? (
                  <span className="whitespace-nowrap text-[12px] font-medium text-secondary">{cornerBadge}</span>
                ) : null}
                {risk ? (
                  <span className={`whitespace-nowrap text-[12px] font-medium ${risk.className}`}>{risk.text}</span>
                ) : null}
                <IndicatorHelpTooltip content={tip} columnIndex={tooltipColumnIndex} />
              </>
            }
          />
        </div>
        <div className="flex min-h-0 w-full flex-1 flex-col justify-center">
          {rowsSlot ? rowsSlot : primarySlot ? primarySlot : <p className={unifiedPrimaryCls}>{primary}</p>}
        </div>
        {!hideSub && sub ? (
          <p className={`line-clamp-2 shrink-0 text-[11px] leading-snug ${subClassName ?? 'text-tertiary'}`.trim()}>
            {sub}
          </p>
        ) : !hideSub ? (
          <span className="min-h-[2px] shrink-0" aria-hidden />
        ) : null}
      </div>
    </Card>
  )
}
