import {
  Battery,
  Building2,
  Car,
  Cpu,
  Shield,
  Ship,
  Zap,
  type LucideIcon,
} from 'lucide-react'

export type SectorIconStyle = {
  Icon: LucideIcon
  /** 아이콘용 Tailwind 색상 (배경 없음) */
  iconClassName: string
  /** 섹터명 텍스트 색상 */
  titleClassName: string
}

type SectorStyleRule = SectorIconStyle & { match: (name: string) => boolean }

const SECTOR_STYLE_RULES: SectorStyleRule[] = [
  {
    match: (n) => n.includes('반도체'),
    Icon: Cpu,
    iconClassName: 'text-violet-600',
    titleClassName: 'text-violet-700',
  },
  {
    match: (n) => n.includes('전력') || n.includes('인프라') || n.includes('전기'),
    Icon: Zap,
    iconClassName: 'text-amber-500',
    titleClassName: 'text-amber-700',
  },
  {
    match: (n) => n.includes('원자력') || n.includes('SMR'),
    Icon: Shield,
    iconClassName: 'text-emerald-600',
    titleClassName: 'text-emerald-700',
  },
  {
    match: (n) => n.includes('조선'),
    Icon: Ship,
    iconClassName: 'text-sky-600',
    titleClassName: 'text-sky-700',
  },
  {
    match: (n) => n.includes('방산'),
    Icon: Shield,
    iconClassName: 'text-rose-600',
    titleClassName: 'text-rose-700',
  },
  {
    match: (n) => n.includes('건설') || n.includes('플랜트'),
    Icon: Building2,
    iconClassName: 'text-orange-600',
    titleClassName: 'text-orange-700',
  },
  {
    match: (n) => n.includes('2차전지') || n.includes('배터리'),
    Icon: Battery,
    iconClassName: 'text-lime-600',
    titleClassName: 'text-lime-700',
  },
  {
    match: (n) => n.includes('자동차'),
    Icon: Car,
    iconClassName: 'text-blue-600',
    titleClassName: 'text-blue-700',
  },
  {
    match: (n) => n.includes('바이오'),
    Icon: Cpu,
    iconClassName: 'text-teal-600',
    titleClassName: 'text-teal-700',
  },
  {
    match: (n) => n.includes('엔터') || n.includes('미디어'),
    Icon: Zap,
    iconClassName: 'text-fuchsia-600',
    titleClassName: 'text-fuchsia-700',
  },
]

const DEFAULT_STYLE: SectorIconStyle = {
  Icon: Cpu,
  iconClassName: 'text-indigo-600',
  titleClassName: 'text-indigo-700',
}

/**
 * @param {string} sectorName
 */
export function getSectorIconStyle(sectorName: string): SectorIconStyle {
  const n = String(sectorName ?? '').trim()
  for (const rule of SECTOR_STYLE_RULES) {
    if (rule.match(n)) {
      return {
        Icon: rule.Icon,
        iconClassName: rule.iconClassName,
        titleClassName: rule.titleClassName,
      }
    }
  }
  return DEFAULT_STYLE
}

/**
 * @param {string} sectorName
 */
export function getSectorIcon(sectorName: string): LucideIcon {
  return getSectorIconStyle(sectorName).Icon
}

/**
 * 로딩 카드용 짧은 라벨.
 * @param {string} sectorName
 */
export function getShortLabel(sectorName: string): string {
  const name = String(sectorName ?? '').trim()
  if (name.includes('/')) {
    return name.split('/')[0].trim()
  }
  if (name.length > 7) {
    return `${name.slice(0, 6)}…`
  }
  return name
}
