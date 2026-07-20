import { useEffect, useState } from 'react'

/** 모바일 placeholder — 폭이 좁아 문구 없이 빈칸 유지 */
export const PRO_STOCK_SEARCH_PLACEHOLDER_MOBILE = ''

export const PRO_STOCK_SEARCH_PLACEHOLDER_DESKTOP =
  '종목명 또는 코드 (예: 산일전기, 062040)'

const PRO_STOCK_SEARCH_PLACEHOLDER_STICKY_DESKTOP = '종목 검색 (예: 산일전기, 062040)'

/** @param {'dashboard' | 'sticky'} [variant] */
export function useProStockSearchPlaceholder(variant: 'dashboard' | 'sticky' = 'dashboard') {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(max-width: 767px)').matches
      : false,
  )

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  if (mobile) return PRO_STOCK_SEARCH_PLACEHOLDER_MOBILE
  return variant === 'sticky'
    ? PRO_STOCK_SEARCH_PLACEHOLDER_STICKY_DESKTOP
    : PRO_STOCK_SEARCH_PLACEHOLDER_DESKTOP
}

/** Pro 검색창 — iOS/Safari 자동완성·비밀번호 관리자 차단 (모바일 autofocus 금지 → ProDashboard 줌 유발) */
export const proSearchInputProps = {
  type: 'search' as const,
  name: 'stock-search-query',
  autoComplete: 'off',
  autoCorrect: 'off',
  autoCapitalize: 'off',
  spellCheck: false,
  inputMode: 'text' as const,
  'data-lpignore': 'true',
  'data-1p-ignore': 'true',
  'aria-autocomplete': 'none' as const,
}
