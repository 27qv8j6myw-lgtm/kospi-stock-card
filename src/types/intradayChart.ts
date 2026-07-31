export type IntradayDataPoint = {
  time: string
  timestamp: number
  price: number
  volume?: number
}

export type IntradayMarketStatus = 'pre_open' | 'open' | 'closed'

export type IntradayChartData = {
  date: string
  openPrice: number
  /** 전일 종가 — 등락률 기준선 */
  prevClose?: number | null
  data: IntradayDataPoint[]
  marketStatus: IntradayMarketStatus
}

export type IntradaySeriesPoint = {
  /** 09:00 기준 경과 분 (슬롯 끝 시각) */
  x: number
  time: string
  value: number | null
  /** 슬롯 구간 거래량 합 */
  volume?: number | null
}

export type IntradayChartApiResponse = IntradayChartData & {
  interval: string
  suffix: string
  series: IntradaySeriesPoint[]
  stepMinutes: number
  cached?: boolean
  fetchedAt?: string
  /** 09:00 기준 x축 범위 — 시간외 구간이 있으면 음수/390 초과로 넓어진다 */
  xMin?: number
  xMax?: number
  extended?: {
    /** NXT 프리마켓(08:00~08:50) 체결 존재 */
    pre: boolean
    /** NXT 애프터마켓(15:30~20:00) 체결 존재 */
    after: boolean
    /** 정규장 마감 위치 (x) */
    sessionEndX: number
  }
}
