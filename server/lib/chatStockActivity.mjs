import { logActivity } from './activityLogger.mjs'
import { isValidStockCode, normalizeKisIscd } from './stockCode.mjs'

/** 종목 code 인자를 받는 채팅 Tool Use — view_stock 기록 대상 */
const CHAT_STOCK_VIEW_TOOLS = new Set([
  'getStockQuote',
  'get52Week',
  'getInvestorTrend',
  'getValuation',
  'getDailyChart',
  'getDisclosures',
  'getAnalystReports',
])

/**
 * Pro 채팅 Tool Use에서 종목 조회 도구 실행 시 view_stock 기록 (source: chat)
 * @param {string | null | undefined} userId
 * @param {string} toolName
 * @param {Record<string, unknown>} [input]
 * @param {Set<string> | null} [loggedCodes] 요청(메시지) 스코프 — code 당 1회만 기록
 */
export function logChatStockViewFromTool(userId, toolName, input = {}, loggedCodes = null) {
  if (!userId || !CHAT_STOCK_VIEW_TOOLS.has(toolName)) return

  const code = normalizeKisIscd(String(input?.code ?? ''))
  if (!isValidStockCode(code)) return

  if (loggedCodes) {
    if (loggedCodes.has(code)) return
    loggedCodes.add(code)
  }

  void logActivity(userId, 'view_stock', { code, source: 'chat' }, true)
}
