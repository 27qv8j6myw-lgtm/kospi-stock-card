/**
 * `/api/screening` 전용 엔트리.
 *
 * 실제 구현은 `runScreening.mjs`:
 * - 메모리 캐시 TTL 1시간 (`CACHE_TTL_MS`)
 * - TOP 5 산출 후 `server/ai/screeningAnalysis.mjs` 의 `analyzeTopThree` 로 TOP 3만 AI 호출 (Sonnet 4.6 기본)
 * - 종목 한글명은 `scoreStock.mjs` 의 `scoreSingleStock` 이 KIS `basicInfo`·`raw` 필드에서 조합
 */
export { runScreening as runScreeningSimple } from './runScreening.mjs'
