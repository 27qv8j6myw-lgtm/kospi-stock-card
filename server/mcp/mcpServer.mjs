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
import { getDailyBars, getMinuteBars, getInvestorFlow } from './marketHistory.mjs'
import { getFlowEstimate, getOrderbook, getMarketCalendar, getIndexBars, getAnalystOpinions, getEarningsEstimates, getMarketCapRanking, getFlowRanking } from './marketExtras.mjs'
import { getServerStatus } from './serverStatus.mjs'
import { getRuleBacktest } from './ruleBacktest.mjs'

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

  /** 등록한 도구 이름 — get_server_status 가 그대로 돌려줘 커넥터의 도구 목록 캐시와 비교할 수 있다 */
  const toolNames = []
  const registerTool = server.registerTool.bind(server)
  server.registerTool = (name, ...rest) => {
    toolNames.push(name)
    return registerTool(name, ...rest)
  }

  server.registerTool(
    'get_portfolio',
    {
      title: '현재 포트폴리오',
      description:
        '보유 종목(수량·평단·현재가·평가액·비중·수익률), 그룹별 현금과 초기자본, 전체 합계(평가액·매입액·평가손익·실현손익)를 반환합니다. 금액 단위는 원(KRW). 현재가는 KRX+NXT 통합 기준이라 NXT 시간외 체결도 반영됩니다. "지금 포트폴리오 기준으로" 같은 요청에 사용하세요.',
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
        '일별 평가 스냅샷(날짜, 총자산, 주식 평가액, 현금, 초기자본 대비 수익률)을 오래된 날짜부터 반환합니다. 성과 추이나 특정 기간 변화를 볼 때 사용하세요. KRX 정규장 종가 기준으로 하루 1회(15:40) 기록되므로 get_portfolio 의 통합 현재가와는 기준이 다릅니다.',
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
        '국내 종목의 현재가와 시세 지표(전일대비·등락률·시가·고가·저가·거래량·거래대금·시가총액·PER·PBR·EPS·BPS·배당수익률·외국인 지분율)를 반환합니다. 6자리 종목코드와 종목명을 섞어 넣을 수 있습니다(예: ["005930", "SK하이닉스"]). 보유하지 않은 종목도 조회됩니다. 기본은 KRX+NXT 통합가라 NXT 프리마켓(08:00~08:50)·애프터마켓(15:30~20:00) 체결가도 잡힙니다. 응답의 basis 필드가 실제 적용된 기준입니다.',
      inputSchema: z.object({
        symbols: z
          .array(z.string())
          .min(1)
          .max(20)
          .describe('6자리 종목코드 또는 종목명 목록 (최대 20개)'),
        market: z
          .enum(['unified', 'krx', 'nxt'])
          .optional()
          .describe(
            '시세 기준 (기본 unified = KRX+NXT 통합). 정규장 종가 기준만 보려면 krx, 시간외 NXT 체결만 보려면 nxt',
          ),
      }),
      annotations: READ_ONLY,
    },
    async ({ symbols, market }) => {
      try {
        return jsonResult(await getQuotes(symbols, { market }))
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

  const codeSchema = z.string().regex(/^\d{6}$/).describe('6자리 종목코드 (삼성전자: 005930)')
  for (const [name, title, description, schema, handler] of [
    ['get_daily_bars', '과거 일봉', 'KRX 일봉 OHLCV를 오래된 순으로 조회합니다. 기본은 최근 60개·원주가(비수정)입니다. start_date/end_date(YYYYMMDD)로 기간을 지정하거나 limit을 100 넘게 주면 100건씩 나눠 받아 이어 붙여 최대 1500개(약 6년)까지 돌려줍니다. adjusted=true면 수정주가(액면분할·무상증자 반영, 백테스트용)입니다. 당일 봉은 미완성일 수 있습니다.',
      z.object({
        code: codeSchema,
        limit: z.number().int().min(1).max(1500).optional().describe('최대 봉 수 (기본 60, start_date 지정 시 기본 1500). 100 초과는 여러 번 나눠 조회'),
        start_date: z.string().regex(/^\d{8}$/).optional().describe('시작일 YYYYMMDD'),
        end_date: z.string().regex(/^\d{8}$/).optional().describe('종료일 YYYYMMDD (기본 오늘)'),
        adjusted: z.boolean().optional().describe('true면 수정주가, 기본 false면 원주가'),
      }), getDailyBars],
    ['get_minute_bars', '분봉', '1분봉 OHLCV를 오래된 순으로 조회합니다. 아무것도 안 주면 당일 최근 30개입니다(end_time 으로 그 이전 구간). date(YYYYMMDD)를 주면 과거 거래일(최대 1년 전)의 분봉을, interval 을 주면 N분봉으로 묶어서, limit 으로 최대 800개까지 받습니다 — 이 세 가지는 KIS 실전 계정 전용입니다. 하루 전체는 KRX 기준 1분봉 391개이니 장중 고가·저가 도달 시각만 볼 때는 interval 5 이상을 쓰세요. KRX 는 기본으로 15:30 까지만 받으므로 수능일처럼 늦게 끝난 날은 end_time 을 주세요. 날짜가 없는 값은 당일로 단정하지 마세요.',
      z.object({
        code: codeSchema,
        date: z.string().regex(/^\d{8}$/).optional().describe('조회할 거래일 YYYYMMDD (생략하면 당일)'),
        end_time: z.string().regex(/^(?:[01]\d|2[0-3])[0-5]\d[0-5]\d$/).optional().describe('이 시각(HHMMSS)까지의 봉만'),
        limit: z.number().int().min(1).max(800).optional().describe('최대 봉 수 (기본: 당일 최근 조회 30, 그 외 400)'),
        interval: z.number().int().min(1).max(60).optional().describe('봉 간격(분): 1(기본) · 3 · 5 · 10 · 15 · 30 · 60'),
        market: z.enum(['krx', 'unified', 'nxt']).default('krx'),
      }), getMinuteBars],
    ['get_investor_flow', '외국인·기관 순매수', 'KRX 투자자별 일별 순매수 수량(주)·금액(원)과 3·5·20거래일 누계를 최신순으로 반환합니다. 기본은 KIS 최근 20일(최대 30일)입니다. start_date/end_date(YYYYMMDD)를 주거나 limit을 30 넘게 주면 30일보다 오래된 구간을 KIS 종목별 투자자매매동향(일별)로 받아 최대 1000일까지 돌려줍니다(history 필드에 호출 수·대조 결과). 과거 조회가 안 되면 매일 쌓는 누적 테이블로 대체합니다. 누계는 값이 전부 빈 날(pendingDates, 장중 당일 등)을 빼고 값이 있는 최근 N거래일을 합산합니다. 실시간 수급이 아니며 결측치는 null입니다.',
      z.object({
        code: codeSchema,
        limit: z.number().int().min(1).max(1000).optional().describe('최대 일수 (기본 20, start_date 지정 시 기본 1000)'),
        start_date: z.string().regex(/^\d{8}$/).optional().describe('시작일 YYYYMMDD'),
        end_date: z.string().regex(/^\d{8}$/).optional().describe('종료일 YYYYMMDD (기본 오늘)'),
      }), getInvestorFlow],
    ['get_flow_estimate', '장중 외국인·기관 추정 수급', '당일 장중 외국인·기관 순매수 추정치(주, 누계)를 입력 시각별로 반환합니다. 증권사 직원이 09:30~14:30 사이 4~5회 집계해 넣는 값이라 확정 수급이 아니며 금액은 없습니다. 장 마감 전에 그날 수급 방향을 볼 때 쓰고, 확정치는 15:40 이후 get_investor_flow 로 확인하세요. KIS 실전 계정 전용입니다.',
      z.object({ code: codeSchema }), getFlowEstimate],
    ['get_orderbook', '호가·예상체결가', '매도·매수 호가와 잔량, 예상체결가를 반환합니다. 예상체결가는 동시호가(08:30~09:00, 15:20~15:30)와 장 종료 후에만 의미가 있고, 15:20~15:30 에는 당일 종가의 예상값으로 쓸 수 있습니다(확정 종가는 15:30). 종가 기준 손절·매수 판정을 장 마감 직전에 할 때 사용하세요.',
      z.object({
        code: codeSchema,
        market: z.enum(['krx', 'unified', 'nxt']).default('krx').describe('기본 krx (종가 판정은 KRX 정규장 기준)'),
        depth: z.number().int().min(1).max(10).optional().describe('호가 단계 수 (기본 5, 최대 10)'),
      }), getOrderbook],
    ['get_market_calendar', '개장일·휴장일', '주식시장 개장일과 평일 휴장일을 반환합니다. 기본은 오늘부터 21일이고 start_date(YYYYMMDD)와 days(최대 62)로 범위를 바꿉니다. 거래일 수 계산, 매수 마감일·월말 거래일·연휴 확인에 쓰세요. KIS 권고에 따라 하루 단위로 캐시합니다. KIS 실전 계정 전용입니다.',
      z.object({
        start_date: z.string().regex(/^\d{8}$/).optional().describe('시작일 YYYYMMDD (기본 오늘)'),
        days: z.number().int().min(1).max(62).optional().describe('달력 일수 (기본 21, 최대 62)'),
      }), getMarketCalendar],
    ['get_index_bars', '지수 일봉', '코스피·코스닥·코스피200 등 지수(업종)의 일봉을 오래된 순으로 반환합니다. 기본은 KOSPI 최근 60개이고 start_date/end_date(YYYYMMDD)로 기간을, limit 으로 최대 1500개까지 지정합니다. 종목 수익률을 시장과 비교하거나 시장·업종의 추세(20일선 등)를 볼 때 쓰세요. 그 밖의 업종은 4자리 업종코드를 index 에 직접 넣습니다.',
      z.object({
        index: z.string().optional().describe('KOSPI(기본) · KOSDAQ · KOSPI200 또는 4자리 업종코드'),
        limit: z.number().int().min(1).max(1500).optional().describe('최대 봉 수 (기본 60, start_date 지정 시 기본 1500)'),
        start_date: z.string().regex(/^\d{8}$/).optional().describe('시작일 YYYYMMDD'),
        end_date: z.string().regex(/^\d{8}$/).optional().describe('종료일 YYYYMMDD (기본 오늘)'),
      }), getIndexBars],
    ['get_analyst_opinions', '증권사 투자의견·목표가', '종목의 증권사별 투자의견·목표가 이력(최신순)과, 증권사마다 가장 최근 목표가를 모은 요약(평균·중간값·최고·최저, 직전 보고서 대비 상향·하향 수)을 반환합니다. 기본은 최근 180일입니다. 실적 발표 전후 목표가 상·하향 흐름을 볼 때 쓰세요. 영업이익 컨센서스는 없습니다. KIS 실전 계정 전용입니다.',
      z.object({
        code: codeSchema,
        start_date: z.string().regex(/^\d{8}$/).optional().describe('시작일 YYYYMMDD (기본 종료일 180일 전)'),
        end_date: z.string().regex(/^\d{8}$/).optional().describe('종료일 YYYYMMDD (기본 오늘)'),
        limit: z.number().int().min(1).max(300).optional().describe('최대 건수 (기본 100)'),
      }), getAnalystOpinions],
    ['get_earnings_estimates', '한투 추정실적', '한국투자증권 리서치의 종목 추정실적을 결산기별로 반환합니다: 매출·영업이익·순이익과 증감률, EBITDA, EPS, PER, EV/EBITDA, ROE, 부채비율. 매월 초 갱신되는 약 160개 기업 한정이며 여러 증권사를 모은 시장 컨센서스가 아닙니다. 대상이 아니면 covered=false 입니다. KIS 실전 계정 전용입니다.',
      z.object({ code: codeSchema }), getEarningsEstimates],
    ['get_market_cap_ranking', '시가총액 상위', '시가총액 상위 종목의 순위·현재가·등락률·거래량·상장주식수·시가총액(원)·시장 내 비중을 반환합니다. 한 번에 최대 30종목이고, market 을 KOSPI·KOSDAQ 로 나눠 부르면 시장별로 30종목씩 볼 수 있습니다. 대형주 후보군(스크리닝 대상)을 만들 때 쓰고, 종목별 20일선·수급은 get_daily_bars·get_investor_flow 로 이어서 확인하세요. KIS 실전 계정 전용입니다.',
      z.object({
        market: z.enum(['ALL', 'KOSPI', 'KOSDAQ', 'KOSPI200']).optional().describe('ALL(기본, 전체) · KOSPI · KOSDAQ · KOSPI200'),
        share_class: z.enum(['all', 'common', 'preferred']).optional().describe('all(기본) · common(보통주만) · preferred(우선주만)'),
        limit: z.number().int().min(1).max(30).optional().describe('최대 종목 수 (기본·최대 30)'),
      }), getMarketCapRanking],
    ['get_flow_ranking', '외국인·기관 순매수 상위 (장중 가집계)', '당일 장중 외국인·기관 순매수(또는 순매도) 상위 종목과 종목별 외국인·기관 순매수 수량(주)·금액(원)·합계를 반환합니다. 증권사 직원이 09:30~14:30 사이 4~5회 입력하는 가집계 누계라 확정 수급이 아니고 당일치만 있습니다. 오늘 돈이 몰리는 종목을 찾을 때 쓰고, 확정치와 20일 누계는 종목별 get_investor_flow 로 확인하세요. KIS 실전 계정 전용입니다.',
      z.object({
        investor: z.enum(['all', 'foreign', 'institution']).optional().describe('all(기본, 외국인+기관) · foreign · institution'),
        side: z.enum(['buy', 'sell']).optional().describe('buy(기본, 순매수 상위) · sell(순매도 상위)'),
        market: z.enum(['ALL', 'KOSPI', 'KOSDAQ']).optional().describe('ALL(기본) · KOSPI · KOSDAQ'),
        sort: z.enum(['amount', 'shares']).optional().describe('amount(기본, 금액순) · shares(수량순)'),
        limit: z.number().int().min(1).max(100).optional().describe('최대 종목 수 (기본 30)'),
        detail: z.boolean().optional().describe('true 면 투신·은행·보험·기금 등 세부 주체별 값도 포함'),
      }), getFlowRanking],
    ['get_rule_backtest', '월초 선정·규칙 시뮬레이션', '종목 목록과 달(YYYYMM)을 주면 종목별로 (1) 그 달 직전 거래일 종가 기준 선정 지표(20일선 대비·20일 등락·변동성·외국인/기관 20일·5일 순매수)와 (2) 그 달에 매매 규칙(첫 N거래일 안에 종가가 이틀 연속 하락한 날 종가 매수 → 목표가 도달 시 익절, 종가 손절선 이탈 시 다음 날 시가 정리, 아니면 월말 종가)을 적용한 결과를 반환합니다. 비교용으로 첫 거래일 종가 매수(day1)와 매수 창 마지막 날 종가 매수(forced)도 같이 줍니다. 기본은 선정 기준 통과 종목만 돌려주고(include=all 이면 전부), closes 에는 전 종목의 기준일 종가가 들어 있습니다. 여러 달을 차례로 불러 "여러 종목 대기 명단" 규칙을 검증할 때 쓰세요. 수정주가·비용 미반영, 금액은 억원입니다. 종목당 KIS 를 2번 부르므로 80종목이면 10여 초 걸립니다. KIS 실전 계정 전용입니다.',
      z.object({
        codes: z.array(codeSchema).min(1).max(80).describe('6자리 종목코드 목록 (최대 80개)'),
        month: z.string().regex(/^\d{6}$/).describe('시뮬레이션할 달 YYYYMM'),
        window: z.number().int().min(1).max(10).optional().describe('매수 창 거래일 수 (기본 5)'),
        take_profit_pct: z.number().positive().max(100).optional().describe('익절 % (기본 10)'),
        stop_loss_pct: z.number().positive().max(99).optional().describe('종가 손절 % (기본 15)'),
        include: z.enum(['passed', 'all']).optional().describe('passed(기본, 선정 기준 통과 종목만) · all(전 종목)'),
      }), getRuleBacktest],
  ]) {
    server.registerTool(name, { title, description, inputSchema: schema, annotations: READ_ONLY }, async (input) => {
      try { return jsonResult(await handler(input)) } catch (e) { return errorResult(e) }
    })
  }

  server.registerTool(
    'get_server_status',
    {
      title: '서버 연결 상태',
      description:
        'Signal15 MCP 서버가 KIS 실전(prod)·모의(vps) 중 어디에 연결돼 있는지, 배포 버전(커밋·호스트), 등록된 도구 목록을 반환합니다. 비밀값은 포함하지 않습니다. 실전 전용 도구가 모의투자 서버 오류를 내거나 새 도구가 보이지 않을 때 먼저 확인하세요.',
      annotations: READ_ONLY,
    },
    async () => {
      try {
        return jsonResult(getServerStatus(toolNames))
      } catch (e) {
        return errorResult(e)
      }
    },
  )

  return server
}
