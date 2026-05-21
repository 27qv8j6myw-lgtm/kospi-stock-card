/**
 * 종목카드(일반·Pro) 공통 디자인 토큰 — `stockCardPage` article/section 패턴 + Pro 섹션 헤더 패턴
 */
export const stockCardTokens = {
  page: 'mx-auto min-w-0 max-w-6xl overflow-x-hidden px-4 py-8 sm:px-6 lg:px-8',
  shell: 'overflow-visible rounded-2xl border border-default bg-card shadow-card',
  section: 'border-t border-default px-6 py-6 sm:px-8',
  sectionHeader: {
    wrap: 'mb-3 flex items-center justify-between',
    left: 'flex items-center gap-1.5',
    iconBox:
      'flex size-5 shrink-0 items-center justify-center rounded-md bg-neutral-bg text-secondary [&_svg]:size-[11px]',
    title: 'text-[11px] font-bold uppercase tracking-wider text-secondary',
    meta: 'text-[10px] text-tertiary',
  },
  dataBox: {
    wrap: 'rounded-lg border border-default bg-neutral-bg px-3 py-2.5',
    label: 'mb-1 text-[9px] font-semibold uppercase text-tertiary',
    value: 'text-[12px] font-bold tabular-nums text-primary',
    sub: 'mt-0.5 text-[9px] text-secondary',
  },
  dataGrid: 'grid grid-cols-2 gap-2 sm:grid-cols-4',
  price: {
    name: 'text-2xl font-bold leading-tight text-primary',
    subtitle: 'mt-1 text-sm text-secondary',
    current: 'font-sans-en text-3xl font-bold leading-none tabular-nums text-primary',
    change: 'mt-1.5 font-sans-en text-xl font-semibold tabular-nums',
    up: 'text-price-up',
    down: 'text-price-down',
    flat: 'text-secondary',
  },
  proBadge:
    'rounded-full bg-gradient-to-br from-amber-400 to-amber-600 px-2 py-0.5 text-[9px] font-extrabold tracking-wider text-white',
  proOpus: {
    section: 'border-b border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100 px-6 py-4 sm:px-8',
    iconBox:
      'flex size-5 shrink-0 items-center justify-center rounded-md bg-amber-200 text-amber-800 [&_svg]:size-[11px]',
    title: 'text-[11px] font-bold uppercase tracking-wider text-amber-900',
    loading: 'text-[10px] text-amber-700',
  },
  listItem: {
    wrap: 'flex items-start gap-3 rounded-lg border border-default bg-neutral-bg p-2.5 transition-colors hover:bg-neutral-bg/80',
    date: 'w-10 shrink-0 text-[10px] tabular-nums text-tertiary',
    title: 'text-[12px] leading-snug text-primary',
    source: 'mt-0.5 text-[10px] text-secondary',
  },
  stickySearch: {
    bar: 'sticky top-0 z-30 border-b border-default bg-card px-4 py-3',
    input:
      'w-full rounded-xl border border-default bg-neutral-bg py-2 pl-9 pr-9 text-[13px] text-primary focus:border-amber-500 focus:bg-card focus:outline-none',
  },
  footer: 'border-t border-default bg-neutral-bg/70 px-6 py-4 text-xs leading-relaxed text-secondary sm:px-8',
} as const

export function changeToneClass(changePct: number | null | undefined): string {
  const n = changePct ?? 0
  if (n > 0) return stockCardTokens.price.up
  if (n < 0) return stockCardTokens.price.down
  return stockCardTokens.price.flat
}
