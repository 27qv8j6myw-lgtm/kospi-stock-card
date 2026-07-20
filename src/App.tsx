import { useEffect, useRef, type ReactNode } from 'react'
import { useAppNavigation } from './hooks/useAppNavigation'
import { useAuth } from './hooks/useAuth'
import { useIsBlocked } from './hooks/useIsBlocked'
import { useIsAdmin } from './hooks/useIsAdmin'
import Page from './stockCardPage/page'
import DesignTestPage from './pages/DesignTestPage'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import BlockedPage from './pages/BlockedPage'
import AdminPage from './pages/AdminPage'
import ProDashboard from './pages/ProDashboard'
import ProChatPage from './pages/ProChatPage'
import ProStockCardPage from './pages/ProStockCardPage'
import ProHoldingDetailPage from './pages/ProHoldingDetailPage'
import ProHoldingsPage from './pages/ProHoldingsPage'
import ProTradesLogPage from './pages/ProTradesLogPage'
import ProTrendsPage from './pages/ProTrendsPage'
import ProScreenerPage from './pages/ProScreenerPage'
import ProScreenerArchivePage from './pages/ProScreenerArchivePage'
import ProDiagnosisArchivePage from './pages/ProDiagnosisArchivePage'
import { useIsProUser } from './hooks/useIsProUser'
import { useIsScreenerUser } from './hooks/useIsScreenerUser'
// 격리: React #300 원인 후보 — ComparePage 비활성화 (복구 시 주석 해제)
// import ComparePage from './compare/ComparePage'
import { MainTabs } from './components/MainTabs'
import { PWAUpdatePrompt } from './components/PWAUpdatePrompt'
import { MarketIndicesStrip } from './components/home/MarketIndicesStrip'
import { consumeProDeepLink, saveProDeepLink } from './lib/proDeepLink'
import { PRO_HOME_SKIP_REDIRECT_KEY } from './lib/proHomeRedirect'

/** `key={pathname}` 시 `/pro/chat` → `/pro/chat/:id` 전환마다 채팅 페이지가 리마운트되어 스트림 UI가 끊김 */
function mainContentMountKey(pathname: string): string {
  if (pathname === '/pro/chat' || pathname.startsWith('/pro/chat/')) return '/pro/chat'
  return pathname
}

/** 탭·화면은 전부 URL(`pathname`) 기준 — `activeTab` 같은 별도 state 없음 */
function App() {
  // 모든 hook 은 early return 이전에 동일 순서로 호출 (React #310 방지)
  const { user, loading } = useAuth()
  const blocked = useIsBlocked()
  const { pathname, navigate, replace } = useAppNavigation()
  const { isAdmin: isUserAdmin, ready: isAdminRoleReady } = useIsAdmin(user)
  const prevPathnameRef = useRef(pathname)
  const appChromeRef = useRef<HTMLDivElement>(null)

  /** 구체적 라우트 판별 — isHome 은 정확히 `/` 만 (다른 경로를 홈으로 취급하지 않음) */
  const stockMatch = pathname.match(/^\/stocks\/(\d+)/)
  const proStockMatch = pathname.match(/^\/pro\/stock\/([0-9A-Za-z]{6})\/?$/i)
  const proHoldingMatch = pathname.match(
    /^\/pro\/holdings\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/?$/i,
  )
  const isProHoldingsList = pathname === '/pro/holdings' || pathname === '/pro/holdings/'
  const isProTradesLog = pathname === '/pro/trades' || pathname === '/pro/trades/'
  const isProTrends = pathname === '/pro/trends' || pathname.startsWith('/pro/trends/')
  const isProScreenerArchive =
    pathname === '/pro/screener/archive' || pathname === '/pro/screener/archive/'
  const isProScreener =
    (pathname === '/pro/screener' || pathname.startsWith('/pro/screener/')) && !isProScreenerArchive
  const isProArchive = pathname === '/pro/archive' || pathname.startsWith('/pro/archive/')
  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/')
  const isProChat = pathname === '/pro/chat' || pathname.startsWith('/pro/chat/')
  const isProStock = Boolean(proStockMatch)
  const isProHolding = Boolean(proHoldingMatch)
  const isPro =
    pathname === '/pro' ||
    (pathname.startsWith('/pro/') &&
      !isProChat &&
      !isProStock &&
      !isProHolding &&
      !isProHoldingsList &&
      !isProTradesLog &&
      !isProTrends &&
      !isProScreener &&
      !isProScreenerArchive &&
      !isProArchive)
  const isProArea =
    isPro ||
    isProChat ||
    isProStock ||
    isProHolding ||
    isProHoldingsList ||
    isProTradesLog ||
    isProTrends ||
    isProScreener ||
    isProScreenerArchive ||
    isProArchive
  const isHome = pathname === '/' || pathname === ''
  const { isProUser: showPro, ready: proReady } = useIsProUser(user)
  const { isScreenerUser, ready: screenerReady } = useIsScreenerUser(user)
  const canUseScreener = isUserAdmin || isScreenerUser
  const showMainTabs =
    isHome ||
    Boolean(stockMatch) ||
    (isProArea && showPro) ||
    (isAdminRoleReady && isUserAdmin && isAdmin)
  useEffect(() => {
    if (!stockMatch) return
    window.scrollTo(0, 0)
  }, [pathname, stockMatch?.[1]])

  useEffect(() => {
    if (!proReady || !isProArea || showPro) return
    replace('/')
  }, [isProArea, showPro, proReady, replace])

  /** 스크리너(및 아카이브)는 관리자 또는 screener_enabled 권한자만 — 그 외 Pro 사용자는 Pro 홈으로 */
  useEffect(() => {
    if (
      (!isProScreener && !isProScreenerArchive) ||
      !showPro ||
      !isAdminRoleReady ||
      !screenerReady ||
      canUseScreener
    )
      return
    replace('/pro')
  }, [
    isProScreener,
    isProScreenerArchive,
    showPro,
    isAdminRoleReady,
    screenerReady,
    canUseScreener,
    replace,
  ])

  /** Pro 딥링크 — 로그인·리다이렉트로 `/`·`/pro`에 온 경우만 복원 (채팅 → `/pro` 뒤로가기는 복원 금지) */
  useEffect(() => {
    const prev = prevPathnameRef.current
    prevPathnameRef.current = pathname

    if (!proReady || !showPro || loading) return
    if (pathname !== '/' && pathname !== '' && pathname !== '/pro') return

    if (prev.startsWith('/pro/chat') && pathname === '/pro') {
      return
    }

    const restore = consumeProDeepLink()
    if (restore) replace(restore)
  }, [proReady, showPro, loading, pathname, replace])

  /** Pro 권한 — 앱 첫 진입(`/`) 시 Pro 대시보드로 (딥링크 복원 대상 제외) */
  useEffect(() => {
    if (!proReady || !showPro) return
    if (pathname !== '/' && pathname !== '') return
    try {
      if (sessionStorage.getItem(PRO_HOME_SKIP_REDIRECT_KEY) === '1') {
        sessionStorage.removeItem(PRO_HOME_SKIP_REDIRECT_KEY)
        return
      }
    } catch {
      // ignore
    }
    replace('/pro')
  }, [proReady, showPro, pathname, replace])

  useEffect(() => {
    if (!showPro || !pathname.startsWith('/pro/') || pathname === '/pro') return
    saveProDeepLink(pathname)
  }, [pathname, showPro])

  /** 상단 탭·(선택) 지수바 fixed — 본문 padding-top (--app-chrome-height) */
  const showFixedChrome = showMainTabs && !isProChat
  /** Pro 채팅 데스크탑 — 상단 탭(md:block) 높이를 --app-chrome-height 로 측정 */
  const measureAppChrome = showMainTabs
  /** 종목카드·Pro 종목카드·관리 — 고정 영역은 탭만 (지수는 페이지 본문 또는 미표시) */
  const chromeTabsOnly = Boolean(stockMatch) || isAdmin || isProStock
  const showIndicesInChrome = isProArea && showPro && !chromeTabsOnly && !isProChat

  useEffect(() => {
    const el = appChromeRef.current
    if (!el || !measureAppChrome) {
      document.documentElement.style.setProperty('--app-chrome-height', '0px')
      return
    }

    const measure = () => {
      const h = el.getBoundingClientRect().height
      document.documentElement.style.setProperty('--app-chrome-height', `${h}px`)
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
      document.documentElement.style.setProperty('--app-chrome-height', '0px')
    }
  }, [measureAppChrome, showIndicesInChrome, isProArea, showPro, isUserAdmin, pathname])

  if (loading || (user && !proReady)) {
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
  } else if (isProStock) {
    mainContent = showPro ? <ProStockCardPage /> : <HomePage />
  } else if (isProHoldingsList) {
    mainContent = showPro ? <ProHoldingsPage /> : <HomePage />
  } else if (isProTradesLog) {
    mainContent = showPro ? <ProTradesLogPage /> : <HomePage />
  } else if (isProHolding) {
    mainContent = showPro ? <ProHoldingDetailPage /> : <HomePage />
  } else if (isProChat) {
    mainContent = showPro ? <ProChatPage /> : <HomePage />
  } else if (isProTrends) {
    mainContent = showPro ? <ProTrendsPage /> : <HomePage />
  } else if (isProScreenerArchive) {
    mainContent =
      showPro && isAdminRoleReady && screenerReady && canUseScreener ? (
        <ProScreenerArchivePage />
      ) : (
        <HomePage />
      )
  } else if (isProScreener) {
    mainContent =
      showPro && isAdminRoleReady && screenerReady && canUseScreener ? (
        <ProScreenerPage />
      ) : (
        <HomePage />
      )
  } else if (isProArchive) {
    mainContent = showPro ? <ProDiagnosisArchivePage /> : <HomePage />
  } else if (isPro) {
    mainContent = showPro ? <ProDashboard /> : <HomePage />
  } else if (isHome) {
    mainContent = <HomePage />
  } else {
    mainContent = <HomePage />
  }

  return (
    <>
    <div
      className={`min-w-0 w-full max-w-full ${
        isProChat
          ? 'pro-chat-app-root flex h-full min-h-0 w-full flex-col overflow-hidden bg-white md:h-svh md:max-h-svh'
          : 'min-h-svh bg-app pb-[max(env(safe-area-inset-bottom),0.75rem)]'
      }`}
    >
      {showMainTabs ? (
        <div
          ref={appChromeRef}
          className={`safe-top z-40 w-full min-w-0 max-w-full border-b border-gray-100 bg-white ${
            isProChat ? 'hidden md:block' : ''
          } fixed top-0 left-0 right-0`}
        >
          <MainTabs pathname={pathname} navigate={navigate} isAdmin={isUserAdmin} />
          {showIndicesInChrome ? (
            <MarketIndicesStrip variant="pro" className="mb-0 w-full min-w-0 max-w-full" />
          ) : null}
        </div>
      ) : null}
      {/* {isCompare ? <ComparePage /> : null} */}
      <div
        key={mainContentMountKey(pathname)}
        className={`w-full min-w-0 max-w-full ${
          showFixedChrome
            ? 'app-main-below-chrome'
            : isProChat
              ? 'pro-chat-page-shell min-h-0 flex-1'
              : ''
        }`}
      >
        {mainContent}
      </div>
    </div>
    <PWAUpdatePrompt />
    </>
  )
}

export default App
