/**
 * KIS OpenAPI
 *
 * **보안:** `KIS_APP_KEY` / `KIS_APP_SECRET` 은 브라우저에 넣지 않는다.
 * 이 저장소에서는 `server/kisClient.mjs`가 `fetch`로 토큰 발급·REST 호출을 수행한다.
 *
 * 한국투자 개발자센터 문서의 axios 예시와 동일한 엔드포인트이며,
 * 클라이언트(Vite)는 동일 출처 `/api/quote`, `/api/chart` 등만 호출한다.
 *
 * @see https://apiportal.koreainvestment.com/
 */
export const KIS_REST_PROD = 'https://openapi.koreainvestment.com:9443' as const
export const KIS_REST_VPS = 'https://openapivts.koreainvestment.com:29443' as const

export type KisEnv = 'prod' | 'vps'
