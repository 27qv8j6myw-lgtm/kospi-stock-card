import {
  Battery,
  Building2,
  Car,
  CircuitBoard,
  Clapperboard,
  Cpu,
  Dna,
  FlaskConical,
  Landmark,
  Shield,
  Ship,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { iconColorIconClass } from '@/components/ui/iconTokens'
import { sectorDefinitions, type ScreenerSectorKey } from '@/lib/sectorDefinitions'

/** 로그인 전용 — 스크리닝 코어 외 브랜딩 표시 */
type LoginExtraSectorKey = 'bio' | 'chemical' | 'entertainment' | 'finance'

type LoginSectorKey = ScreenerSectorKey | LoginExtraSectorKey

type LoginSectorTile = {
  Icon: LucideIcon
  iconClassName: string
}

const LOGIN_CORE_TILES: Record<ScreenerSectorKey, LoginSectorTile> = {
  semi: { Icon: Cpu, iconClassName: iconColorIconClass('blue') },
  ai_power: { Icon: Zap, iconClassName: iconColorIconClass('yellow') },
  nuclear: { Icon: CircuitBoard, iconClassName: iconColorIconClass('cyan') },
  shipbuilding: { Icon: Ship, iconClassName: 'text-sky-600' },
  defense: { Icon: Shield, iconClassName: iconColorIconClass('rose') },
  construction: { Icon: Building2, iconClassName: iconColorIconClass('orange') },
  battery: { Icon: Battery, iconClassName: 'text-lime-600' },
  auto: { Icon: Car, iconClassName: iconColorIconClass('green') },
}

const LOGIN_EXTRA_TILES: Record<LoginExtraSectorKey, LoginSectorTile> = {
  bio: { Icon: Dna, iconClassName: 'text-teal-600' },
  chemical: { Icon: FlaskConical, iconClassName: iconColorIconClass('purple') },
  entertainment: { Icon: Clapperboard, iconClassName: 'text-fuchsia-600' },
  finance: { Icon: Landmark, iconClassName: 'text-indigo-600' },
}

/** 4×3 — 통신(맨 아래 오른쪽) 제외 */
const LOGIN_ICON_ORDER: LoginSectorKey[] = [
  ...sectorDefinitions.map((d) => d.key),
  'bio',
  'chemical',
  'entertainment',
  'finance',
]

function tileFor(key: LoginSectorKey): LoginSectorTile {
  if (key in LOGIN_CORE_TILES) return LOGIN_CORE_TILES[key as ScreenerSectorKey]
  return LOGIN_EXTRA_TILES[key as LoginExtraSectorKey]
}

function SectorIcon({ sectorKey }: { sectorKey: LoginSectorKey }) {
  const { Icon, iconClassName } = tileFor(sectorKey)
  return (
    <Icon
      className={`size-8 sm:size-9 ${iconClassName}`}
      strokeWidth={2}
      aria-hidden
    />
  )
}

/** 로그인 브랜딩 — 12섹터 아이콘 4×3 */
export function LoginSectorIconGrid() {
  return (
    <div
      role="img"
      aria-label="SignAI 12개 섹터"
      className="w-full max-w-[17rem] sm:max-w-[19rem]"
    >
      <div className="grid grid-cols-4 gap-x-5 gap-y-4 sm:gap-x-6 sm:gap-y-5">
        {LOGIN_ICON_ORDER.map((key) => (
          <div key={key} className="flex justify-center">
            <SectorIcon sectorKey={key} />
          </div>
        ))}
      </div>
    </div>
  )
}
