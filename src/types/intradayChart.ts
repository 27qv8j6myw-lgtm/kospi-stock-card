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
  data: IntradayDataPoint[]
  marketStatus: IntradayMarketStatus
}

export type IntradaySeriesPoint = {
  /** 09:00 기준 경과 분 (슬롯 끝 시각) */
  x: number
  time: string
  value: number | null
}

export type IntradayChartApiResponse = IntradayChartData & {
  interval: string
  suffix: string
  series: IntradaySeriesPoint[]
  stepMinutes: number
  cached?: boolean
  fetchedAt?: string
}
