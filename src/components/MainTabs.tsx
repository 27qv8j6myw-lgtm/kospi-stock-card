import type { LucideIcon } from 'lucide-react'
import { Crown, LineChart, Shield } from 'lucide-react'
import { UserMenu } from '@/components/portfolio/UserMenu'
import { useAuth } from '@/hooks/useAuth'
import { useIsProUser } from '@/hooks/useIsProUser'

/**
 * 상단 탭 — 활성 상태는 `useState`가 아니라 **`pathname`에서만 derive**합니다.
 * (`App` → `useAppNavigation` → `history.pushState` / `popstate`)
 */
export type MainTabsProps = {
  pathname: string
  navigate: (to: string) => void
  /** `App`에서 `useIsAdmin(user)`(Supabase `is_admin` RPC) 결과 — `MainTabs` 안에서 `useAuth` 중복 호출하지 않음 */
  isAdmin?: boolean
}

export function MainTabs({ pathname, navigate, isAdmin = false }: MainTabsProps) {
  const { user } = useAuth()
  const { isProUser: showPro } = useIsProUser(user)

  const tabs: { id: string; label: string; icon: LucideIcon; path: string; pro?: boolean }[] = [
    { id: 'stocks', label: '종목 카드', icon: LineChart, path: '/' },
  ]
  if (showPro) {
    tabs.push({ id: 'pro', label: 'PRO', icon: Crown, path: '/pro', pro: true })
  }
  if (isAdmin) {
    tabs.push({ id: 'admin', label: '관리', icon: Shield, path: '/admin' })
  }

  const isActive = (id: string) => {
    if (id === 'admin') return pathname === '/admin' || pathname.startsWith('/admin/')
    if (id === 'pro')
      return (
        pathname === '/pro' ||
        pathname === '/pro/chat' ||
        pathname.startsWith('/pro/chat/') ||
        pathname.startsWith('/pro/stock/')
      )
    if (id === 'stocks')
      return pathname === '/' || pathname === '' || /^\/stocks\/\d{6}\/?$/.test(pathname)
    return false
  }

  return (
    <header className="sticky top-0 z-50 border-b border-default bg-card/95 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3 pb-px">
          <nav
            className="-mx-4 flex min-w-0 max-w-full flex-1 gap-1 overflow-x-auto overflow-y-hidden px-4 sm:mx-0 sm:px-0"
            aria-label="주요 메뉴"
          >
            {tabs.map((tab) => {
              const Icon = tab.icon
              const active = isActive(tab.id)
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-label={tab.label}
                  onClick={() => navigate(tab.path)}
                  className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors min-h-[44px] sm:min-h-0 ${
                    tab.pro
                      ? `pro-tab ${active ? 'active border-amber-600' : 'border-transparent'}`
                      : active
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-secondary hover:text-primary'
                  }`}
                >
                  <Icon className="size-6 shrink-0 sm:size-4" strokeWidth={2} aria-hidden />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              )
            })}
          </nav>
          {/* 사용자 메뉴: 아바타·이름(데스크탑)·로그아웃만 — AI 모델 배지 없음 */}
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
