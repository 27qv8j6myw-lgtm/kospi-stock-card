export type IconColorToken = 'blue' | 'green' | 'orange' | 'purple' | 'pink' | 'yellow' | 'cyan' | 'rose'

/** 파스텔 배경 + 아이콘 색 (토큰) */
export function iconColorBoxClass(c: IconColorToken): string {
  switch (c) {
    case 'blue':
      return 'bg-icon-blue-bg text-icon-blue'
    case 'green':
      return 'bg-icon-green-bg text-icon-green'
    case 'orange':
      return 'bg-icon-orange-bg text-icon-orange'
    case 'purple':
      return 'bg-icon-purple-bg text-icon-purple'
    case 'pink':
      return 'bg-icon-pink-bg text-icon-pink'
    case 'yellow':
      return 'bg-icon-yellow-bg text-icon-yellow'
    case 'cyan':
      return 'bg-icon-cyan-bg text-icon-cyan'
    case 'rose':
      return 'bg-icon-rose-bg text-icon-rose'
    default:
      return 'bg-neutral-bg text-secondary'
  }
}

export type SeverityToken = 'normal' | 'caution' | 'warning' | 'danger' | 'info'

/** 지표 카드 아이콘 단독 색 (배경 없음) */
export function iconColorIconClass(c: IconColorToken): string {
  switch (c) {
    case 'blue':
      return 'text-icon-blue'
    case 'green':
      return 'text-icon-green'
    case 'orange':
      return 'text-icon-orange'
    case 'purple':
      return 'text-icon-purple'
    case 'pink':
      return 'text-icon-pink'
    case 'yellow':
      return 'text-icon-yellow'
    case 'cyan':
      return 'text-icon-cyan'
    case 'rose':
      return 'text-icon-rose'
    default:
      return 'text-secondary'
  }
}

/** 우상단 위험도 텍스트 (배경 없음) — normal·info 는 미표시 */
export function severityRiskLabel(s: SeverityToken): { text: string; className: string } | null {
  switch (s) {
    case 'caution':
      return { text: '주의', className: 'text-[#6B7280]' }
    case 'warning':
      return { text: '경고', className: 'text-[#B86E12]' }
    case 'danger':
      return { text: '임계 초과', className: 'text-[#C53030]' }
    default:
      return null
  }
}

