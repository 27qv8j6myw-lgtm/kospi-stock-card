import { useCallback, useSyncExternalStore } from 'react'
import { clearProDeepLink, saveProDeepLink } from '@/lib/proDeepLink'

const DEFAULT_HOME_PATH = '/'
const DEFAULT_STOCK_PATH = '/stocks/000660'

/**
 * @param {string} raw - pathname only (no ?query or #hash)
 */
function normalizePathname(raw: string): string {
  const pathOnly = raw.split('?')[0].split('#')[0] || '/'
  if (pathOnly === '/design-test' || pathOnly.startsWith('/design-test/')) return pathOnly
  if (pathOnly === '/compare' || pathOnly.startsWith('/compare/')) return pathOnly
  if (pathOnly === '/portfolio' || pathOnly.startsWith('/portfolio/')) return DEFAULT_STOCK_PATH
  if (pathOnly === '/admin' || pathOnly.startsWith('/admin/')) return pathOnly
  if (pathOnly === '/pro/chat') return '/pro/chat'
  const proChatId = pathOnly.match(/^\/pro\/chat\/([0-9a-f-]{36})\/?$/i)
  if (proChatId) return `/pro/chat/${proChatId[1]}`
  const proStock = pathOnly.match(/^\/pro\/stock\/([0-9A-Za-z]{6})\/?$/i)
  if (proStock) return `/pro/stock/${proStock[1].toUpperCase()}`
  const proHolding = pathOnly.match(
    /^\/pro\/holdings\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/?$/i,
  )
  if (proHolding) return `/pro/holdings/${proHolding[1]}`
  if (pathOnly === '/pro/holdings' || pathOnly === '/pro/holdings/') return '/pro/holdings'
  if (pathOnly === '/pro/trades' || pathOnly === '/pro/trades/') return '/pro/trades'
  if (pathOnly === '/pro') return '/pro'
  if (pathOnly === '/' || pathOnly === '') return DEFAULT_HOME_PATH
  if (pathOnly === '/stocks' || pathOnly === '/stocks/') return DEFAULT_STOCK_PATH
  if (pathOnly.startsWith('/stocks/')) {
    const ok = /^\/stocks\/\d{6}\/?$/.test(pathOnly)
    if (!ok) return DEFAULT_STOCK_PATH
  }
  return pathOnly
}

/**
 * @param {string} to
 * @returns {{ pathname: string, href: string }}
 */
function parseRouteTo(to: string): { pathname: string; href: string } {
  if (typeof window === 'undefined') {
    const pathname = normalizePathname(to)
    return { pathname, href: pathname }
  }
  try {
    const url = new URL(to, window.location.origin)
    const pathname = normalizePathname(url.pathname)
    return { pathname, href: `${pathname}${url.search}${url.hash}` }
  } catch {
    const pathname = normalizePathname(to)
    return { pathname, href: pathname }
  }
}

function currentBrowserHref(): string {
  if (typeof window === 'undefined') return '/'
  return `${window.location.pathname}${window.location.search}${window.location.hash}`
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
  if (next === '/pro') {
    clearProDeepLink()
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
    const { pathname: next, href } = parseRouteTo(to)
    if (next === '/pro') {
      clearProDeepLink()
    }
    if (href === currentBrowserHref()) {
      if (currentPathname !== next) {
        currentPathname = next
        emit()
      }
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    window.history.pushState({}, '', href)
    currentPathname = next
    emit()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const replace = useCallback((to: string) => {
    if (typeof window === 'undefined') return
    const { pathname: next, href } = parseRouteTo(to)
    if (next === '/pro') {
      clearProDeepLink()
    }
    window.history.replaceState({}, '', href)
    currentPathname = next
    emit()
  }, [])

  return { pathname, navigate, replace }
}
