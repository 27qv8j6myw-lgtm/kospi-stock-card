/**
 * 투자 메모 브리핑.
 * - 로컬: `generateDetailedInvestmentMemo` (규칙·숫자 기반)
 * - GPT: `buildInvestmentMemoPromptForGPT` → `fetchGPTBriefing` → 동일 JSON 스키마
 */
export { generateDetailedInvestmentMemo } from './investmentMemoLocal'
export { memoFmtWon as formatKrwPrice, memoFmtPctSigned as formatPercentDiff } from './investmentMemoLocal'
export { buildInvestmentMemoPromptForGPT } from './gptPrompt'
