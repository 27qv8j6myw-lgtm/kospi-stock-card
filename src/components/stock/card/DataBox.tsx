import { stockCardTokens } from '@/lib/stockCardDesignTokens'

type Props = {
  label: string
  value: string
  sub?: string
  valueClassName?: string
}

export function DataBox({ label, value, sub, valueClassName }: Props) {
  const t = stockCardTokens.dataBox
  return (
    <div className={t.wrap}>
      <div className={t.label}>{label}</div>
      <div className={`${t.value} ${valueClassName ?? ''}`.trim()}>{value}</div>
      {sub ? <div className={t.sub}>{sub}</div> : null}
    </div>
  )
}
