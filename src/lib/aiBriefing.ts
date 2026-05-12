/**
 * 투자 메모 브리핑.
 * - 로컬: `generateDetailedInvestmentMemo` (규칙·숫자 기반)
 * - Claude: `buildInvestmentMemoPrompt` → `fetchAiBriefing` → 동일 JSON 스키마
 */
export { generateDetailedInvestmentMemo } from './investmentMemoLocal'
export { memoFmtWon as formatKrwPrice, memoFmtPctSigned as formatPercentDiff } from './investmentMemoLocal'
export { buildInvestmentMemoPrompt } from './investmentMemoPrompt'
