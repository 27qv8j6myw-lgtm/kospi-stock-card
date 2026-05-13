import { LineChart, Target } from 'lucide-react'

export type MainTabsProps = {
  pathname: string
  navigate: (to: string) => void
}

function resolveStockTabPath(pathname: string): string {
  const m = pathname.match(/^\/stocks\/(\d{6})\/?$/)
  if (m) return `/stocks/${m[1]}`
  try {
    const last = sessionStorage.getItem('lastStockCode')
    if (last && /^\d{6}$/.test(last)) return `/stocks/${last}`
  } catch {
    /* ignore */
  }
  return '/stocks/005930'
}

export function MainTabs({ pathname, navigate }: MainTabsProps) {
  const tabs = [
    { id: 'stocks', label: '종목 카드', icon: LineChart, path: resolveStockTabPath(pathname) },
    { id: 'screening', label: '섹터 스크리닝', icon: Target, path: '/screening' },
    // 격리: 비교 분석 탭 — React #300 후보 (복구 시 주석 해제)
    // { id: 'compare', label: '비교 분석', icon: GitCompare, path: '/compare' },
  ] as const

  const isActive = (id: (typeof tabs)[number]['id']) => {
    if (id === 'screening') return pathname === '/screening' || pathname.startsWith('/screening/')
    // if (id === 'compare') return pathname === '/compare' || pathname.startsWith('/compare/')
    return pathname.startsWith('/stocks/')
  }

  return (
    <header className="sticky top-0 z-40 border-b border-default bg-card/95 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <nav className="-mx-4 flex min-w-0 gap-1 overflow-x-auto overflow-y-hidden px-4 pb-px scrollbar-none sm:mx-0 sm:px-0" aria-label="주요 메뉴">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const active = isActive(tab.id)
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => navigate(tab.path)}
                className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors min-h-[44px] sm:min-h-0 ${
                  active
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-secondary hover:text-primary'
                }`}
              >
                <Icon className="size-4 shrink-0" strokeWidth={2} aria-hidden />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
