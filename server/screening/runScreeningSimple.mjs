/**
 * `/api/screening` 전용 엔트리.
 *
 * 실제 구현은 `runScreening.mjs`:
 * - 메모리 캐시 TTL 1시간 (`CACHE_TTL_MS`)
 * - 룰 상위 15개 후보를 `server/ai/screeningAnalysis.mjs` 의 `selectTopFiveWithAnalysis` 로 AI 재선정
 * - 종목 표시명: `sectorMaster.mjs` 의 `resolveScreeningStockDisplayName` (40종목 마스터 우선, KIS 업종명 오인 방지)
 */
export { runScreening as runScreeningSimple } from './runScreening.mjs'
