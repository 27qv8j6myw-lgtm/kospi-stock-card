import { useCallback, useEffect, useState } from 'react'

function normalizePathname(raw: string): string {
  if (raw === '/design-test' || raw.startsWith('/design-test/')) return raw
  if (raw === '/compare' || raw.startsWith('/compare/')) return raw
  if (raw === '/' || raw === '') return '/stocks/005930'
  if (raw === '/stocks' || raw === '/stocks/') return '/stocks/005930'
  if (raw.startsWith('/stocks/')) {
    const ok = /^\/stocks\/\d{6}\/?$/.test(raw)
    if (!ok) return '/stocks/005930'
  }
  return raw
}

export function useAppNavigation() {
  const [pathname, setPathname] = useState(() => {
    if (typeof window === 'undefined') return '/stocks/005930'
    const raw = window.location.pathname
    const next = normalizePathname(raw)
    if (next !== raw) {
      window.history.replaceState({}, '', next)
    }
    return next
  })

  useEffect(() => {
    const onPop = () => {
      const raw = window.location.pathname
      const next = normalizePathname(raw)
      if (next !== raw) {
        window.history.replaceState({}, '', next)
      }
      setPathname(next)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = useCallback((to: string) => {
    const next = normalizePathname(to)
    window.history.pushState({}, '', next)
    setPathname(next)
  }, [])

  const replace = useCallback((to: string) => {
    const next = normalizePathname(to)
    window.history.replaceState({}, '', next)
    setPathname(next)
  }, [])

  return { pathname, navigate, replace }
}
