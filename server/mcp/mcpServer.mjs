/**
 * Signal15 MCP 서버 — Claude 커스텀 커넥터용 읽기 전용 도구.
 *
 * 도구는 전부 조회만 하므로 readOnlyHint 를 달아 클라이언트가 확인 없이 실행할 수 있게 한다.
 * 쓰기(매매 기록 추가 등)는 의도적으로 노출하지 않는다.
 */
import { McpServer } from '@modelcontextprotocol/server'
import * as z from 'zod'
import { getPortfolio, getSnapshots, getTrades } from './portfolioData.mjs'
import { getQuotes, getWatchlist } from './quoteData.mjs'

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
}

/**
 * 도구 결과를 텍스트(JSON) + structuredContent 로 함께 반환.
 * @param {unknown} payload
 */
function jsonResult(payload) {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload) }],
    structuredContent: /** @type {Record<string, unknown>} */ (payload),
  }
}

/**
 * @param {unknown} e
 */
function errorResult(e) {
  const message = e instanceof Error ? e.message : String(e)
  return {
    content: [{ type: 'text', text: `조회 실패: ${message}` }],
    isError: true,
  }
}

/**
 * 요청마다 새 인스턴스를 만든다 (stateless 서버리스 — 인스턴스 재사용 금지).
 * @param {string} userId 조회 대상 사용자 (MCP_USER_ID 로 고정)
 */
export function createSignal15McpServer(userId) {
  const server = new McpServer({ name: 'signal15', version: '1.0.0' })

  server.registerTool(
    'get_portfolio',
    {
      title: '현재 포트폴리오',
      description:
        '보유 종목(수량·평단·현재가·평가액·비중·수익률), 그룹별 현금과 초기자본, 전체 합계(평가액·매입액·평가손익·실현손익)를 반환합니다. 금액 단위는 원(KRW). "지금 포트폴리오 기준으로" 같은 요청에 사용하세요.',
      annotations: READ_ONLY,
    },
    async () => {
      try {
        return jsonResult(await getPortfolio(userId))
      } catch (e) {
        return errorResult(e)
      }
    },
  )

  server.registerTool(
    'get_snapshots',
    {
      title: '일별 자산 추이',
      description:
        '일별 평가 스냅샷(날짜, 총자산, 주식 평가액, 현금, 초기자본 대비 수익률)을 오래된 날짜부터 반환합니다. 성과 추이나 특정 기간 변화를 볼 때 사용하세요. 장 마감 후 하루 1회 기록됩니다.',
      inputSchema: z.object({
        days: z
          .number()
          .int()
          .min(1)
          .max(365)
          .optional()
          .describe('조회할 최근 일수 (기본 30, 최대 365)'),
      }),
      annotations: READ_ONLY,
    },
    async ({ days }) => {
      try {
        return jsonResult(await getSnapshots(userId, { days }))
      } catch (e) {
        return errorResult(e)
      }
    },
  )

  server.registerTool(
    'get_trades',
    {
      title: '최근 매매 내역',
      description:
        '매매일지의 최근 거래(날짜, 종목, 매수/매도, 수량, 단가, 거래금액, 실현손익, 메모)를 최신순으로 반환합니다. 매매 복기나 특정 종목의 거래 이력을 확인할 때 사용하세요.',
      inputSchema: z.object({
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe('반환할 거래 건수 (기본 20, 최대 100)'),
        code: z.string().optional().describe('특정 종목만 조회할 때의 6자리 종목코드 (예: 005930)'),
        days: z.number().int().min(1).max(3650).optional().describe('최근 N일 이내로 제한'),
      }),
      annotations: READ_ONLY,
    },
    async ({ limit, code, days }) => {
      try {
        return jsonResult(await getTrades(userId, { limit, code, days }))
      } catch (e) {
        return errorResult(e)
      }
    },
  )

  server.registerTool(
    'get_quote',
    {
      title: '종목 현재가',
      description:
        '국내 종목의 현재가와 시세 지표(전일대비·등락률·시가·고가·저가·거래량·거래대금·시가총액·PER·PBR·EPS·BPS·배당수익률·외국인 지분율)를 반환합니다. 6자리 종목코드와 종목명을 섞어 넣을 수 있습니다(예: ["005930", "SK하이닉스"]). 보유하지 않은 종목도 조회됩니다. 장중에는 실시간에 가까운 값, 장 마감 후에는 종가입니다.',
      inputSchema: z.object({
        symbols: z
          .array(z.string())
          .min(1)
          .max(20)
          .describe('6자리 종목코드 또는 종목명 목록 (최대 20개)'),
      }),
      annotations: READ_ONLY,
    },
    async ({ symbols }) => {
      try {
        return jsonResult(await getQuotes(symbols))
      } catch (e) {
        return errorResult(e)
      }
    },
  )

  server.registerTool(
    'get_watchlist',
    {
      title: '관심종목 시세',
      description:
        '관심종목(감시 리스트)에 등록한 종목의 메모·등록일과 현재 시세를 함께 반환합니다. 후보 종목들의 가격을 한 번에 추적할 때 사용하세요.',
      inputSchema: z.object({
        include_quotes: z
          .boolean()
          .optional()
          .describe('현재가를 함께 조회할지 (기본 true, false 면 목록만 빠르게 반환)'),
      }),
      annotations: READ_ONLY,
    },
    async ({ include_quotes }) => {
      try {
        return jsonResult(await getWatchlist(userId, { includeQuotes: include_quotes }))
      } catch (e) {
        return errorResult(e)
      }
    },
  )

  return server
}
