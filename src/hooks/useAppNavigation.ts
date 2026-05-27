import { useCallback, useSyncExternalStore } from 'react'
import { saveProDeepLink } from '@/lib/proDeepLink'

const DEFAULT_HOME_PATH = '/'
const DEFAULT_STOCK_PATH = '/stocks/000660'

function normalizePathname(raw: string): string {
  if (raw === '/design-test' || raw.startsWith('/design-test/')) return raw
  if (raw === '/compare' || raw.startsWith('/compare/')) return raw
  if (raw === '/portfolio' || raw.startsWith('/portfolio/')) return DEFAULT_STOCK_PATH
  if (raw === '/admin' || raw.startsWith('/admin/')) return raw
  if (raw === '/pro/chat') return '/pro/chat'
  const proChatId = raw.match(/^\/pro\/chat\/([0-9a-f-]{36})\/?$/i)
  if (proChatId) return `/pro/chat/${proChatId[1]}`
  const proStock = raw.match(/^\/pro\/stock\/([0-9A-Za-z]{6})\/?$/i)
  if (proStock) return `/pro/stock/${proStock[1].toUpperCase()}`
  const proHolding = raw.match(
    /^\/pro\/holdings\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/?$/i,
  )
  if (proHolding) return `/pro/holdings/${proHolding[1]}`
  if (raw === '/pro/holdings' || raw === '/pro/holdings/') return '/pro/holdings'
  if (raw === '/pro') return '/pro'
  if (raw === '/' || raw === '') return DEFAULT_HOME_PATH
  if (raw === '/stocks' || raw === '/stocks/') return DEFAULT_STOCK_PATH
  if (raw.startsWith('/stocks/')) {
    const ok = /^\/stocks\/\d{6}\/?$/.test(raw)
    if (!ok) return DEFAULT_STOCK_PATH
  }
  return raw
}

/** App·HomePage 등 여러 컴포넌트가 같은 훅을 쓸 때 pathname 이 분리되지 않도록 단일 스토어 */
let currentPathname =
  typeof window !== 'undefined'
    ? normalizePathname(window.location.pathname)
    : DEFAULT_HOME_PATH

if (typeof window !== 'undefined') {
  const raw = window.location.pathname
  const next = normalizePathname(raw)
  if (next !== raw) {
    window.history.replaceState({}, '', next)
  }
  currentPathname = next
  saveProDeepLink(next)
}

const listeners = new Set<() => void>()

function emit() {
  for (const cb of listeners) cb()
}

let popstateAttached = false

function onPopState() {
  if (typeof window === 'undefined') return
  const raw = window.location.pathname
  let next = normalizePathname(raw)
  if (next !== raw) {
    window.history.replaceState({}, '', next)
  }
  currentPathname = next
  emit()
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange)
  if (typeof window !== 'undefined' && !popstateAttached) {
    window.addEventListener('popstate', onPopState)
    popstateAttached = true
  }
  return () => {
    listeners.delete(onStoreChange)
  }
}

function getSnapshot() {
  return currentPathname
}

function getServerSnapshot() {
  if (typeof window !== 'undefined') {
    return normalizePathname(window.location.pathname)
  }
  return DEFAULT_HOME_PATH
}

export function useAppNavigation() {
  const pathname = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const navigate = useCallback((to: string) => {
    if (typeof window === 'undefined') return
    const next = normalizePathname(to)
    console.log('[navigate] 이동:', next)
    console.trace('[navigate] 호출 위치')
    if (next === window.location.pathname) {
      currentPathname = next
      emit()
      window.dispatchEvent(new PopStateEvent('popstate'))
      window.scrollTo({ top: 0, behavior: 'smooth' })
      console.log('[navigate] 완료. 현재 URL:', window.location.pathname)
      return
    }
    window.history.pushState({}, '', next)
    window.dispatchEvent(new PopStateEvent('popstate'))
    console.log('[navigate] 완료. 현재 URL:', window.location.pathname)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const replace = useCallback((to: string) => {
    if (typeof window === 'undefined') return
    const next = normalizePathname(to)
    window.history.replaceState({}, '', next)
    currentPathname = next
    emit()
  }, [])

  return { pathname, navigate, replace }
}
