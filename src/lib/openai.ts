import type { DetailedInvestmentMemoResult } from '../types/aiBriefing'

/**
 * 서버 `POST /api/ai-briefing` 호출 — API 키는 서버(Vercel 환경변수)에만 둡니다.
 * Vercel: Project → Settings → Environment Variables → `OPENAI_API_KEY`, `OPENAI_MODEL`
 */
export async function fetchGPTBriefing(prompt: string): Promise<DetailedInvestmentMemoResult> {
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

  const toneRaw = str(json.tone, 'neutral').toLowerCase()
  const tone = ['bullish', 'neutral', 'caution'].includes(toneRaw)
    ? (toneRaw as DetailedInvestmentMemoResult['tone'])
    : 'neutral'

  let paragraphs = strArr(json.paragraphs, 8)
  const pad = '이 문단은 모델이 비워 두었습니다. 로컬 메모를 참고하세요.'
  while (paragraphs.length < 5) paragraphs.push(pad)
  paragraphs = paragraphs.slice(0, 5)

  const keyPoints = strArr(json.keyPoints, 8)
  const risks = strArr(json.risks, 8)

  return {
    title: str(json.title, '투자 메모'),
    atAGlanceTitle: str(json.atAGlanceTitle, ''),
    atAGlanceStrategy: str(json.atAGlanceStrategy, ''),
    paragraphs,
    keyPoints: keyPoints.length ? keyPoints : ['핵심 포인트를 생성하지 못했습니다.'],
    risks: risks.length ? risks : ['리스크 항목을 생성하지 못했습니다.'],
    strategyComment: str(json.strategyComment, ''),
    tone,
  }
}

/** @deprecated `fetchGPTBriefing` 사용 — 과거 mock 문자열 반환용 이름 */
export async function generateGPTBriefing(prompt: string): Promise<string> {
  const b = await fetchGPTBriefing(prompt)
  return JSON.stringify(b)
}
