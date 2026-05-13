import { useAppNavigation } from './hooks/useAppNavigation'
import Page from './stockCardPage/page'
import DesignTestPage from './pages/DesignTestPage'
import ScreeningPage from './pages/ScreeningPage'
// 격리: React #300 원인 후보 — ComparePage 비활성화 (복구 시 주석 해제)
// import ComparePage from './compare/ComparePage'
import { MainTabs } from './components/MainTabs'

function App() {
  const { pathname, navigate } = useAppNavigation()

  if (pathname === '/design-test' || pathname.startsWith('/design-test/')) {
    return <DesignTestPage />
  }

  const showMainTabs =
    pathname.startsWith('/stocks') ||
    pathname === '/screening' ||
    pathname.startsWith('/screening/')
  // pathname === '/compare' ||
  // pathname.startsWith('/compare/')

  const stockMatch = pathname.match(/^\/stocks\/(\d{6})\/?$/)
  const isScreening = pathname === '/screening' || pathname.startsWith('/screening/')
  // const isCompare = pathname === '/compare' || pathname.startsWith('/compare/')

  return (
    <div className="min-h-svh min-w-0 max-w-[100vw] overflow-x-hidden bg-app pb-[max(env(safe-area-inset-bottom),0.75rem)]">
      {showMainTabs ? <MainTabs pathname={pathname} navigate={navigate} /> : null}
      {isScreening ? <ScreeningPage /> : null}
      {/* {isCompare ? <ComparePage /> : null} */}
      {stockMatch ? <Page key={stockMatch[1]} initialCode={stockMatch[1]} /> : null}
    </div>
  )
}

export default App
