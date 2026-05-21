/** Anthropic Tool Use — Pro 매매 어시스턴트 */
export const STOCK_TOOLS = [
  {
    name: 'searchStock',
    description: '종목명/코드로 검색해서 종목 정보 찾기',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '종목명 또는 코드' },
      },
      required: ['query'],
    },
  },
  {
    name: 'getStockQuote',
    description: '종목의 실시간 시세 (현재가, 등락률, 거래량, 거래대금)',
    input_schema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: '6자리 종목 코드' },
      },
      required: ['code'],
    },
  },
  {
    name: 'get52Week',
    description: '종목의 52주 최고/최저가 + 현재 위치',
    input_schema: {
      type: 'object',
      properties: {
        code: { type: 'string' },
      },
      required: ['code'],
    },
  },
  {
    name: 'getInvestorTrend',
    description: '종목의 외국인/기관 N일 누적 순매수 동향. 단기 모멘텀 핵심 지표.',
    input_schema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: '6자리 종목 코드' },
        days: { type: 'number', description: '조회 일수 (기본 5일)' },
      },
      required: ['code'],
    },
  },
  {
    name: 'getValuation',
    description: '종목의 가치 평가 지표 (PER, PBR, EPS, BPS, 배당수익률). 동종 업종 평균과 비교.',
    input_schema: {
      type: 'object',
      properties: {
        code: { type: 'string' },
      },
      required: ['code'],
    },
  },
  {
    name: 'getDailyChart',
    description: '종목의 N일 일봉 데이터 (시가/고가/저가/종가/거래량). 추세 패턴 분석용.',
    input_schema: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        days: { type: 'number', description: '조회 일수 (기본 20일, 최대 100)' },
      },
      required: ['code'],
    },
  },
  {
    name: 'getTopByVolume',
    description: '오늘 거래대금 상위 종목 (시장 관심 종목 파악)',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: '몇 개 가져올지 (기본 10, 최대 30)' },
      },
    },
  },
  {
    name: 'getTopByMomentum',
    description: '오늘 등락률 상위 종목 (단기 모멘텀 강한 종목, 거래대금 상위 풀 기준)',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: '몇 개 (기본 10)' },
      },
    },
  },
  {
    name: 'getMarketIndices',
    description: '주요 지수 현황 (KOSPI, KOSDAQ, 나스닥, S&P500, USD/KRW, WTI)',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'getMyRecentViews',
    description: '현재 사용자의 최근 조회 종목 5개 (관심 종목 파악)',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'searchNews',
    description: '종목명/키워드로 최근 뉴스 검색 (Google News RSS)',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '검색어 (종목명 권장)' },
        limit: { type: 'number', description: '최대 건수 (기본 5)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'getDisclosures',
    description: '종목의 최근 DART 공시 목록 (네이버 금융)',
    input_schema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: '6자리 종목 코드' },
        days: { type: 'number', description: '조회 일수 (기본 30)' },
      },
      required: ['code'],
    },
  },
  {
    name: 'getAnalystReports',
    description: '증권사 컨센서스 (평균 목표주가, 투자의견, 상승여력)',
    input_schema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: '6자리 종목 코드' },
      },
      required: ['code'],
    },
  },
]
