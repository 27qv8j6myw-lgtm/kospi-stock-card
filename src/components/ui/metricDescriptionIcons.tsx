import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  AlertTriangle,
  BarChart2,
  BarChart3,
  Briefcase,
  Building2,
  CalendarDays,
  CandlestickChart,
  Droplets,
  Landmark,
  Layers,
  MessageSquare,
  PieChart,
  RefreshCw,
  Star,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react'
import type { LogicMetric } from '../../types/stock'
import type { IconColorToken } from './iconTokens'

export type IndicatorPresentation = {
  Icon: LucideIcon
  iconColor: IconColorToken
}

/** 지표 키·제목 기반 아이콘·파스텔 색 (레퍼런스 매핑) */
export function resolveIndicatorPresentation(metric: LogicMetric): IndicatorPresentation {
  const t = metric.title
  const key = metric.descriptionKey

  if (key === 'structure' || /구조/i.test(t)) return { Icon: Building2, iconColor: 'blue' }
  if (key === 'execution' || /실행/i.test(t)) return { Icon: Target, iconColor: 'green' }
  if (key === 'atrDistance' || /ATR/i.test(t)) return { Icon: Activity, iconColor: 'orange' }
  if (key === 'consecutiveRise' || /연속/i.test(t)) return { Icon: TrendingUp, iconColor: 'green' }
  if (key === 'market' || /시장/i.test(t)) return { Icon: AlertTriangle, iconColor: 'yellow' }
  if (key === 'sectorFlow' || /로테|섹터|자금/i.test(t)) return { Icon: RefreshCw, iconColor: 'purple' }
  if (key === 'structureState' || /구조 상태/i.test(t)) return { Icon: BarChart3, iconColor: 'pink' }
  if (key === 'supply' || /수급/i.test(t)) return { Icon: Users, iconColor: 'rose' }
  if (key === 'valuation' || /밸류|보정/i.test(t)) return { Icon: PieChart, iconColor: 'yellow' }
  if (key === 'candleQuality' || /캔들/i.test(t)) return { Icon: CandlestickChart, iconColor: 'orange' }
  if (key === 'indicators' || /지표/i.test(t)) return { Icon: Activity, iconColor: 'blue' }
  if (key === 'special' || /특이/i.test(t)) return { Icon: Star, iconColor: 'yellow' }
  if (key === 'earnings' || /실적/i.test(t)) return { Icon: CalendarDays, iconColor: 'purple' }
  if (key === 'statistics' || /통계/i.test(t)) return { Icon: BarChart2, iconColor: 'pink' }
  if (key === 'consensus' || /컨센/i.test(t)) return { Icon: MessageSquare, iconColor: 'blue' }
  if (key === 'roe') return { Icon: TrendingUp, iconColor: 'green' }
  if (key === 'epsGrowth' || /EPS\s*성장/i.test(t)) return { Icon: BarChart3, iconColor: 'purple' }
  if (key === 'fundamental' || key.startsWith('fundamental') || /펀더멘털/i.test(t))
    return { Icon: Briefcase, iconColor: 'blue' }
  if (/유동/i.test(t)) return { Icon: Droplets, iconColor: 'cyan' }
  if (/금리|매크로/i.test(t)) return { Icon: Landmark, iconColor: 'yellow' }

  const toneColor = (x: LogicMetric['tone']): IconColorToken => {
    switch (x) {
      case 'blue':
        return 'blue'
      case 'violet':
      case 'indigo':
        return 'purple'
      case 'amber':
      case 'orange':
        return 'orange'
      case 'sky':
      case 'cyan':
      case 'teal':
        return 'cyan'
      case 'emerald':
        return 'green'
      case 'rose':
      case 'red':
        return 'rose'
      default:
        return 'blue'
    }
  }

  return { Icon: Layers, iconColor: toneColor(metric.tone) }
}
