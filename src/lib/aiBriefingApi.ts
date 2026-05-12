import type { DetailedInvestmentMemoResult } from '../types/aiBriefing'
import type { NewsItem } from './newsSearch'
import type { BrokerReport } from './reportSearch'
import type { BriefingSource } from './marketBriefingSource'

/**
 * 서버 `POST /api/ai-briefing` 호출 — API 키는 서버(Vercel 환경변수 `ANTHROPIC_API_KEY`)에만 둡니다.
 */
export async function fetchAiBriefing(prompt: string): Promise<DetailedInvestmentMemoResult> {
  const res = await fetch('/api/ai-briefing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  })
  const text = await res.text()
  let json: { error?: string } & Partial<DetailedInvestmentMemoResult> | null = null
  try {
    json = JSON.parse(text) as { error?: string } & Partial<DetailedInvestmentMemoResult>
  } catch {
    throw new Error(text.slice(0, 240))
  }
  if (!res.ok) {
    throw new Error(json?.error || `HTTP ${res.status}`)
  }
  if (!json || typeof json.title !== 'string' || !Array.isArray(json.paragraphs)) {
    throw new Error('브리핑 JSON 형식이 올바르지 않습니다.')
  }
  const strArr = (v: unknown, max = 10) =>
    Array.isArray(v)
      ? v.filter((x) => typeof x === 'string' && x.trim()).slice(0, max).map((x) => String(x).trim())
      : []
  const str = (v: unknown, fallback = '') => (typeof v === 'string' && v.trim() ? v.trim() : fallback)
  const toNum = (v: unknown) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }

  const toneRaw = str(json.tone, 'neutral').toLowerCase()
  const tone = ['bullish', 'neutral', 'caution'].includes(toneRaw)
    ? (toneRaw as DetailedInvestmentMemoResult['tone'])
    : 'neutral'

  let paragraphs = strArr(json.paragraphs, 10)
  const pad = '이 문단은 모델이 비워 두었습니다. 로컬 메모를 참고하세요.'
  while (paragraphs.length < 6) paragraphs.push(pad)
  paragraphs = paragraphs.slice(0, 6)

  const keyPoints = strArr(json.keyPoints, 8)
  const risks = strArr(json.risks, 8)
  const strategyPlanRaw =
    json && typeof json.strategyPlan === 'object'
      ? (json.strategyPlan as Record<string, unknown>)
      : null
  const strategyPlan = strategyPlanRaw
    ? {
        title: str(strategyPlanRaw.title, '지금 전략'),
        marketView: str(strategyPlanRaw.marketView, ''),
        timingView: str(strategyPlanRaw.timingView, ''),
        positioningView: str(strategyPlanRaw.positioningView, ''),
        riskView: str(strategyPlanRaw.riskView, ''),
        strategyMemo: str(strategyPlanRaw.strategyMemo, ''),
        evidence: strArr(strategyPlanRaw.evidence, 8),
        confidence: Math.max(0, Math.min(100, toNum(strategyPlanRaw.confidence) ?? 50)),
      }
    : undefined

  return {
    title: str(json.title, '투자 메모'),
    atAGlanceTitle: str(json.atAGlanceTitle, ''),
    atAGlanceStrategy: str(json.atAGlanceStrategy, ''),
    paragraphs,
    keyPoints: keyPoints.length ? keyPoints : ['핵심 포인트를 생성하지 못했습니다.'],
    risks: risks.length ? risks : ['리스크 항목을 생성하지 못했습니다.'],
    strategyPlan,
    strategyComment: str(json.strategyComment, ''),
    confidence: strategyPlan?.confidence,
    tone,
  }
}

export async function fetchMarketBriefing(params: {
  stockName: string
  stockCode: string
  metrics: Record<string, unknown>
  strategy: Record<string, unknown>
}): Promise<{
  briefing: DetailedInvestmentMemoResult
  news: NewsItem[]
  reports: BrokerReport[]
  sources: BriefingSource[]
  updatedAt: string
}> {
  const res = await fetch('/api/screener-briefing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  const text = await res.text()
  let json: any = null
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(text.slice(0, 240))
  }
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)
  if (!json?.briefing || typeof json.briefing?.title !== 'string') {
    throw new Error('시장 브리핑 응답 형식이 올바르지 않습니다.')
  }
  return {
    briefing: json.briefing as DetailedInvestmentMemoResult,
    news: Array.isArray(json.news) ? (json.news as NewsItem[]) : [],
    reports: Array.isArray(json.reports) ? (json.reports as BrokerReport[]) : [],
    sources: Array.isArray(json.sources) ? (json.sources as BriefingSource[]) : [],
    updatedAt: typeof json.updatedAt === 'string' ? json.updatedAt : new Date().toISOString(),
  }
}

export type ScreenerMemoInput = {
  stockName: string
  sector: string
  currentPrice: number
  targetPrice1M: number
  expectedReturnPct: number
  finalScore: number
  executionScore: number
  supplyScore: number
  sectorFlowScore: number
  consensusUpsidePct: number
  valuationScore: number
  riskNote?: string
}

export async function generateInvestmentMemo(input: ScreenerMemoInput): Promise<{
  oneLine: string
  whyNow: string
  risk: string
  strategy: string
}> {
  const prompt = [
    '당신은 한국 주식 단기 스윙(1개월 +15%) 전략 분석가입니다.',
    '말투는 존댓말, 숫자 기반으로 간결하게 작성하세요.',
    '출력은 JSON만 반환하고 키는 oneLine, whyNow, risk, strategy 를 사용하세요.',
    '뉴스 나열은 금지하고 왜 움직일지/왜 지금인지를 설명하세요.',
    `종목: ${input.stockName} / 섹터: ${input.sector}`,
    `현재가: ${input.currentPrice}원`,
    `1개월 목표가: ${input.targetPrice1M}원 (${input.expectedReturnPct.toFixed(1)}%)`,
    `점수: final ${input.finalScore}, execution ${input.executionScore}, supply ${input.supplyScore}, sectorFlow ${input.sectorFlowScore}, consensusUpside ${input.consensusUpsidePct.toFixed(1)}%, valuation ${input.valuationScore}`,
    `리스크 참고: ${input.riskNote || '단기 과열/눌림 여부를 포함'}`,
    '전략 기준: 손절 -5~-7%, +10% 분할익절, 강한 종목 1~2개 집중',
  ].join('\n')

  const memo = await fetchAiBriefing(prompt)
  const oneLine = memo.atAGlanceTitle || memo.keyPoints[0] || memo.paragraphs[0] || ''
  const whyNow = memo.paragraphs[0] || memo.strategyComment || ''
  const risk = memo.risks[0] || '단기 변동성 확대 가능성을 관리하셔야 합니다.'
  const strategy = memo.atAGlanceStrategy || memo.strategyComment || memo.paragraphs[1] || ''
  return {
    oneLine: oneLine.trim(),
    whyNow: whyNow.trim(),
    risk: risk.trim(),
    strategy: strategy.trim(),
  }
}
