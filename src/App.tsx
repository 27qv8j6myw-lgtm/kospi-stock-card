import { useEffect, type ReactNode } from 'react'
import { useAppNavigation } from './hooks/useAppNavigation'
import { useAuth } from './hooks/useAuth'
import { useIsBlocked } from './hooks/useIsBlocked'
import { useIsAdmin } from './hooks/useIsAdmin'
import Page from './stockCardPage/page'
import DesignTestPage from './pages/DesignTestPage'
import ScreeningPage from './pages/ScreeningPage'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import BlockedPage from './pages/BlockedPage'
import AdminPage from './pages/AdminPage'
import ProDashboard from './pages/ProDashboard'
import ProChatPage from './pages/ProChatPage'
import { isProUser } from './lib/proAccess'
// 격리: React #300 원인 후보 — ComparePage 비활성화 (복구 시 주석 해제)
// import ComparePage from './compare/ComparePage'
import { MainTabs } from './components/MainTabs'

/** 탭·화면은 전부 URL(`pathname`) 기준 — `activeTab` 같은 별도 state 없음 */
function App() {
  // 모든 hook 은 early return 이전에 동일 순서로 호출 (React #310 방지)
  const { user, loading } = useAuth()
  const blocked = useIsBlocked()
  const { pathname, navigate, replace } = useAppNavigation()
  const { isAdmin: isUserAdmin, ready: isAdminRoleReady } = useIsAdmin(user)

  /** 구체적 라우트 판별 — isHome 은 정확히 `/` 만 (다른 경로를 홈으로 취급하지 않음) */
  const stockMatch = pathname.match(/^\/stocks\/(\d+)/)
  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/')
  const isScreening = pathname === '/screening' || pathname.startsWith('/screening/')
  const isProChat = pathname === '/pro/chat' || pathname.startsWith('/pro/chat/')
  const isPro = pathname === '/pro' || (pathname.startsWith('/pro/') && !isProChat)
  const isProArea = isPro || isProChat
  const isHome = pathname === '/' || pathname === ''
  const showPro = isProUser(user?.email)
  const showMainTabs =
    isHome ||
    Boolean(stockMatch) ||
    isScreening ||
    (isProArea && showPro) ||
    (isAdminRoleReady && isUserAdmin && isAdmin)
  useEffect(() => {
    if (!stockMatch) return
    window.scrollTo(0, 0)
  }, [pathname, stockMatch?.[1]])

  useEffect(() => {
    if (!isProArea || showPro) return
    replace('/')
  }, [isProArea, showPro, replace])

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-app">
        <div className="text-sm text-gray-400">로딩 중...</div>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  if (blocked === null) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-app">
        <div className="text-sm text-gray-400">확인 중...</div>
      </div>
    )
  }

  if (blocked) {
    return <BlockedPage />
  }

  if (pathname === '/design-test' || pathname.startsWith('/design-test/')) {
    return <DesignTestPage />
  }

  /** 구체적인 것부터 매칭 (순서 중요): 종목 → 관리 → 스크리닝 → 홈 → fallback */
  let mainContent: ReactNode = null
  if (stockMatch) {
    mainContent = <Page key={stockMatch[1]} initialCode={stockMatch[1]} />
  } else if (isAdmin) {
    if (!isAdminRoleReady) {
      mainContent = (
        <div className="flex min-h-svh items-center justify-center bg-app">
          <div className="text-sm text-gray-400">확인 중...</div>
        </div>
      )
    } else if (isUserAdmin) {
      mainContent = <AdminPage />
    } else {
      mainContent = <HomePage />
    }
  } else if (isScreening) {
    mainContent = <ScreeningPage />
  } else if (isProChat) {
    mainContent = showPro ? <ProChatPage /> : <HomePage />
  } else if (isPro) {
    mainContent = showPro ? <ProDashboard /> : <HomePage />
  } else if (isHome) {
    mainContent = <HomePage />
  } else {
    mainContent = <HomePage />
  }

  return (
    <div className="min-h-svh min-w-0 max-w-[100vw] bg-app pb-[max(env(safe-area-inset-bottom),0.75rem)]">
      {showMainTabs ? (
        <MainTabs pathname={pathname} navigate={navigate} isAdmin={isUserAdmin} />
      ) : null}
      {/* {isCompare ? <ComparePage /> : null} */}
      <div className="overflow-x-hidden">{mainContent}</div>
    </div>
  )
}

export default App
