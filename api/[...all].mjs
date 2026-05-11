/**
 * Vercel은 Express 앱 default export를 직접 호출한다.
 * serverless-http는 Node 24 런타임에서 응답이 완료되지 않는 경우가 있어 사용하지 않는다.
 */
import app from '../server/index.mjs'

export default app
