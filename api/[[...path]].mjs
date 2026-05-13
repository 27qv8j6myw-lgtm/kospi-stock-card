/**
 * Vercel Node Serverless Function — `/api`, `/api/*` 요청을 Express 앱으로 위임.
 * 로컬은 `server/index.mjs` 가 직접 listen (8787); 프로덕션은 이 엔트리만 사용.
 */
import app from '../server/index.mjs'

export default app
