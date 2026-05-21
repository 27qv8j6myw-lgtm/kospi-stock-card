/**
 * Vercel Node Serverless Function — `/api`, `/api/*` 요청을 Express 앱으로 위임.
 * 로컬은 `server/index.mjs` 가 직접 listen (8787); 프로덕션은 이 엔트리만 사용.
 *
 * 일부 런타임에서 `req.url` 이 `/api` 접두사 없이 전달되는 경우가 있어 Express의 `/api/...` 라우트와 맞춘다.
 */
import app from '../server/index.mjs'

export default function handler(req, res) {
  try {
    const u = String(req.url ?? '')
    if (u && u !== '/' && !u.startsWith('/api')) {
      req.url = `/api${u.startsWith('/') ? u : `/${u}`}`
    }
    if (typeof req.originalUrl === 'string' && req.originalUrl && !req.originalUrl.startsWith('/api')) {
      req.originalUrl = req.url
    }
  } catch {
    /* ignore */
  }
  return app(req, res)
}
