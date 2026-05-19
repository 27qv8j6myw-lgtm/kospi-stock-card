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
]
