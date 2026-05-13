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
    'ai-fill',
    'ai-briefing',
    'screener-briefing',
    'market-briefing',
    'research-stock',
    'health',
    'screening',
    'compare-stock',
  ]
  return paths.map((p) => ({
    source: `/api/${p}`,
    destination: `${expressProxy}/api/${p}`,
  }))
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /** 기존 Vite 코드베이스 ESLint 규칙과 충돌 — CI에서 lint 단계 분리 권장 */
  eslint: { ignoreDuringBuilds: true },
  async rewrites() {
    return devApiProxyRewrites()
  },
}

export default nextConfig
