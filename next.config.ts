import type { NextConfig } from 'next'

const expressProxy = process.env.EXPRESS_PROXY_URL || 'http://127.0.0.1:8787'

/** 개발 시 Express(8787)로 `/api/*` 프록시 (프로덕션은 `api/[[...path]].mjs` + 동일 Express) */
const devApiProxyRewrites = (): { source: string; destination: string }[] => {
  if (process.env.NODE_ENV !== 'development') return []
  const paths = [
    'quote',
    'chart',
    'intraday-chart',
    'logic-indicators',
    'ai-briefing',
    'screener-briefing',
    'market-briefing',
    'research-stock',
    'portfolio/analyze',
    'health',
    'market-indices',
    'market-summary',
    'compare-stock',
    'stocks/search',
    'stocks-search',
    'market-top-volume',
    'market-top-momentum',
    'user-recent-views',
    'pro-chat',
    'pro-conversations',
    'pro-messages',
    'pro-conversation',
    'pro-chat-stream',
    'pro-stock-quote',
    'pro-stock-summary',
    'pro-stock-analysis',
    'pro-stock-chart',
    'pro-stock-technical',
    'pro-watchlist',
    'pro-watchlist-enriched',
    'pro-top-flow',
    'pro-trends',
    'pro-profile',
    'pro-group-snapshots',
    'cron-snapshot',
    'pro-holding-opus',
    'pro-holdings',
    'pro-holdings-quotes',
    'pro-holding-detail',
    'pro-holdings-group',
    'pro-holdings-ocr',
    'pro-groups',
    'pro-group-opus',
    'pro-portfolio-analysis',
    'pro-portfolio-opus',
    'admin-pro-toggle',
    'admin-user-portfolio-counts',
    'admin-anthropic-cost',
    'admin-pro-stats-users',
    'admin-pro-stats-stocks',
    'admin-pro-stats-hours',
    'admin-pro-watchlist-stats',
    'admin-logs',
    'admin-usage-stats',
    'admin-sync-stocks-fetch',
    'admin-sync-stocks-batch',
  ]
  return paths.map((p) => ({
    source: `/api/${p}`,
    destination: `${expressProxy}/api/${p}`,
  }))
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /** Vercel에 `VITE_SUPABASE_*` 만 있을 때 클라 번들에 노출 (Phase 1 환경변수 호환) */
  env: {
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '',
  },
  /** 기존 Vite 코드베이스 ESLint 규칙과 충돌 — CI에서 lint 단계 분리 권장 */
  eslint: { ignoreDuringBuilds: true },
  async redirects() {
    return [
      { source: '/portfolio', destination: '/stocks/000660', permanent: false },
      { source: '/portfolio/:path*', destination: '/stocks/000660', permanent: false },
      { source: '/screening', destination: '/', permanent: false },
      { source: '/screening/:path*', destination: '/', permanent: false },
    ]
  },
  async rewrites() {
    return devApiProxyRewrites()
  },
}

export default nextConfig
