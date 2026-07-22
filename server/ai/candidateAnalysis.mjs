import Anthropic from '@anthropic-ai/sdk'
import { cleanEnvSecret } from '../aiClient.mjs'
import { createAnthropicMessage, SCREENING_AI_TIMEOUT_MS } from '../lib/anthropicTimed.mjs'
import { safeJsonParse } from '../lib/safeJson.mjs'
import { getUserModel, resolveModelId } from '../lib/userModel.mjs'
import { normalizeCandidateLabel, SCREENING_AI_DEFAULT_MODEL } from './screeningAnalysis.mjs'

const BATCH_SIZE = 4

/**
 * @param {unknown} v
 */
function toNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * @param {unknown} raw
 */
function normalizeScenarioPct(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      entry: '',
      entryReason: '',
      target1Pct: null,
      target1Reason: '',
      target2Pct: null,
      target2Reason: '',
      stopLossPct: null,
      stopLossReason: '',
    }
  }
  const o = /** @type {Record<string, unknown>} */ (raw)
  const pick = (k) => String(o[k] ?? '').trim()
  return {
    entry: pick('entry'),
    entryReason: pick('entryReason') || pick('entryDetail'),
    target1Pct: toNum(o.target1Pct),
    target1Reason: pick('target1Reason') || pick('target1Detail'),
    target2Pct: toNum(o.target2Pct),
    target2Reason: pick('target2Reason') || pick('target2Detail'),
    stopLossPct: toNum(o.stopLossPct),
    stopLossReason: pick('stopLossReason') || pick('stopLossDetail'),
  }
}

/**
 * @param {string} flow
 */
function formatFlowLabel(flow) {
  const t = String(flow ?? '').replace(/%/g, '').trim()
  if (!t) return '0'
  return t.startsWith('+') || t.startsWith('-') ? t : `+${t}`
}

/**
 * @param {unknown} label
 */
function normalizeActionLabel(label) {
  return String(label ?? '')
    .replace(/\s+/g, '')
    .trim()
}

/**
 * @param {Record<string, unknown>} stock
 */
export function isInterestCandidate(stock) {
  if (!stock?.code) return false
  const grade = String(stock.grade ?? '').trim()
  if (grade.startsWith('A')) return true

  const fromLabel =
    normalizeCandidateLabel(stock.candidateLabel) || normalizeCandidateLabel(stock.action)
  if (fromLabel === '관심후보') return true

  const action = normalizeActionLabel(stock.action)
  if (action === '관심후보' || action.includes('관심후보')) return true

  const candidateLabel = normalizeActionLabel(stock.candidateLabel)
  if (candidateLabel === '관심후보' || candidateLabel.includes('관심후보')) return true

  return false
}

/**
 * 그리드에 표시된 모든 섹터의 관심후보 수집 (코드 중복 제거).
 * @param {Array<{ rank?: number, name: string, flow?: string, reason?: string, stocks?: Array<Record<string, unknown>> }>} sectors
 */
export function collectInterestCandidates(sectors) {
  const seenCodes = new Set()
  const out = []

  for (const sector of Array.isArray(sectors) ? sectors : []) {
    const sectorRank = Number(sector.rank) || 99
    for (const stock of sector.stocks || []) {
      if (!isInterestCandidate(stock)) continue
      const code = String(stock.code).replace(/\D/g, '').padStart(6, '0')
      if (!/^\d{6}$/.test(code) || seenCodes.has(code)) continue
      seenCodes.add(code)
      out.push({
        ...stock,
        code,
        sectorName: sector.name,
        sectorReason: sector.reason ?? '',
        sectorFlow: formatFlowLabel(sector.flow),
        sectorRank,
        stockRank: Number(stock.rank) || 99,
      })
    }
  }

  out.sort(
    (a, b) =>
      Number(a.sectorRank) - Number(b.sectorRank) ||
      Number(a.stockRank) - Number(b.stockRank),
  )
  return out
}

/**
 * @param {Array<Record<string, unknown>>} stocks
 */
function buildKeyCandidatePrompt(stocks) {
  const n = stocks.length
  const list = stocks
    .map((s, i) => {
      const flow = formatFlowLabel(s.sectorFlow)
      return `
${i + 1}. ${s.name} (${s.code})
   - 섹터: ${s.sectorName} (자금 흐름 ${flow}%)
   - 등급: ${s.grade ?? '—'} · ${s.action ?? '—'}
   - 섹터 모멘텀: ${s.sectorReason || '—'}`
    })
    .join('')

  return `당신은 한국 주식 시장 베테랑 트레이더입니다. 아래 ${n}개 관심후보 종목을 각각 매우 상세하게 분석하세요.

[분석 대상 - 관심후보 ${n}개 전부]
${list}

⚠️ 반드시 위 ${n}개 종목 각각에 대해 analyses 배열 항목 1개씩 작성. ${n}개 미만·초과 불가.
⚠️ 가격, 등락률, 시가총액, 목표가(원) 등 절대가격 숫자는 응답에 포함하지 마.
시나리오는 % 단위만 사용한다.

[각 종목별 5개 그룹]
1. catalyst (150~250자)
2. scenario (% 만): entry, entryReason, target1Pct, target1Reason, target2Pct, target2Reason, stopLossPct, stopLossReason
3. strengths (4~5개)
4. risks (2~3개)
5. timing (200자 이상)

[톤 가이드]
모든 텍스트(catalyst, scenario 의 entryReason/targetReason/stopLossReason, strengths, risks, timing)는 정중한 존댓말로 작성합니다.
- "~합니다", "~됩니다", "~예상됩니다" 사용 · 반말 ("~함", "~됨") 금지

자주 쓰는 표현 예:
- "현재가 대비 ~% 분할 매수를 권장드립니다"
- "전고점 돌파 시 추가 매수를 고려할 수 있습니다"
- "단기 차익실현 매물이 출회될 가능성이 있습니다"
- "외국인 매수세가 지속되고 있어 추가 상승 여지가 있습니다"
- "20일선 이탈 시 손절을 권장드립니다"

리스크 표현 예:
- "주의 사항이 있습니다"
- "리스크 요인으로 작용할 수 있습니다"
- "단기 변동성 확대가 우려됩니다"

❌ "외국인 매수세 강함" → ✅ "외국인 매수세가 강합니다"
❌ "단기 조정 후 진입 추천" → ✅ "단기 조정 후 진입을 추천드립니다"

[출력 - JSON 만]
{
  "analyses": [
    { "code": "6자리", "name": "종목명", "catalyst": "...", "scenario": { ... }, "strengths": [], "risks": [], "timing": "..." }
  ]
}

analyses.length 는 정확히 ${n} 이어야 합니다.`
}

/**
 * @param {Record<string, unknown>} input
 * @param {Record<string, unknown>} ai
 */
function mergeAnalysisRow(input, ai) {
  const code = String(input.code).replace(/\D/g, '').padStart(6, '0')
  const strengths = Array.isArray(ai.strengths)
    ? ai.strengths.map((x) => String(x).trim()).filter(Boolean).slice(0, 5)
    : []
  const risks = Array.isArray(ai.risks)
    ? ai.risks.map((x) => String(x).trim()).filter(Boolean).slice(0, 3)
    : []

  return {
    code,
    name: String(ai.name || input.name || '').trim() || code,
    sectorName: input.sectorName,
    sectorReason: input.sectorReason,
    sectorFlow: input.sectorFlow,
    grade: input.grade,
    action: input.action,
    catalyst: String(ai.catalyst ?? '').trim(),
    scenario: normalizeScenarioPct(ai.scenario),
    strengths,
    risks,
    timing: String(ai.timing ?? '').trim(),
  }
}

/**
 * @param {import('@anthropic-ai/sdk').default} client
 * @param {string} modelId
 * @param {Array<Record<string, unknown>>} stocks
 */
async function analyzeKeyCandidateBatch(client, modelId, stocks) {
  if (stocks.length === 0) return new Map()

  const prompt = buildKeyCandidatePrompt(stocks)
  const maxTokens = Math.min(16000, 2000 + stocks.length * 2200)

  const response = await createAnthropicMessage(
    client,
    {
      model: modelId,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    },
    SCREENING_AI_TIMEOUT_MS,
  )

  const text = response.content.find((b) => b.type === 'text')?.text ?? ''
  const parsed = safeJsonParse(text, { context: 'Key Candidate Analysis' })
  const rows = Array.isArray(parsed?.analyses) ? parsed.analyses : []

  const byCode = new Map()
  for (const row of rows) {
    if (!row || typeof row.code !== 'string') continue
    const code = String(row.code).replace(/\D/g, '').padStart(6, '0')
    if (!/^\d{6}$/.test(code) || byCode.has(code)) continue
    byCode.set(code, row)
  }
  return byCode
}

/**
 * 관심후보 전체에 대한 Opus 심층 분석 (배치 + 누락 종목 단건 재시도).
 * @param {Array<{ rank?: number, name: string, flow?: string, reason?: string, stocks?: Array<Record<string, unknown>> }>} sectors
 * @param {{ userId?: string | null, modelId?: string }} [opts]
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function analyzeKeyCandidates(sectors, opts = {}) {
  const uniqueKeyStocks = collectInterestCandidates(sectors)

  if (uniqueKeyStocks.length === 0) {
    console.log('[Key Candidates] 관심후보 0개 — 상세 분석 생략')
    return []
  }

  console.log(`[Key Candidates] 관심후보 ${uniqueKeyStocks.length}개 수집 → 상세 분석 시작`)

  const apiKey = cleanEnvSecret(process.env.ANTHROPIC_API_KEY)
  if (!apiKey) {
    console.warn('[Key Candidates] ANTHROPIC_API_KEY 없음 — 심층 분석 생략')
    return []
  }

  const userModel = opts.userId ? await getUserModel(opts.userId) : 'sonnet'
  const modelId =
    opts.modelId?.trim() ||
    (opts.userId ? resolveModelId(userModel) : null) ||
    process.env.SCREENING_AI_MODEL?.trim() ||
    SCREENING_AI_DEFAULT_MODEL
  const client = new Anthropic({ apiKey })

  const mergedAi = new Map()

  for (let i = 0; i < uniqueKeyStocks.length; i += BATCH_SIZE) {
    const batch = uniqueKeyStocks.slice(i, i + BATCH_SIZE)
    try {
      const part = await analyzeKeyCandidateBatch(client, modelId, batch)
      for (const [code, row] of part) {
        mergedAi.set(code, row)
      }
      console.log(
        `[Key Candidates] 배치 ${Math.floor(i / BATCH_SIZE) + 1}: ${part.size}/${batch.length}건`,
      )
    } catch (e) {
      console.error(
        '[Key Candidates] 배치 실패:',
        e instanceof Error ? e.message : e,
      )
    }
  }

  const missing = uniqueKeyStocks.filter((s) => {
    const code = String(s.code).replace(/\D/g, '').padStart(6, '0')
    return !mergedAi.has(code)
  })

  if (missing.length > 0) {
    console.warn(`[Key Candidates] 누락 ${missing.length}건 — 단건 재시도`)
    for (const stock of missing) {
      try {
        const part = await analyzeKeyCandidateBatch(client, modelId, [stock])
        for (const [code, row] of part) {
          mergedAi.set(code, row)
        }
      } catch (e) {
        console.error(
          `[Key Candidates] ${stock.code} 단건 실패:`,
          e instanceof Error ? e.message : e,
        )
      }
    }
  }

  const out = []
  for (const input of uniqueKeyStocks) {
    const code = String(input.code).replace(/\D/g, '').padStart(6, '0')
    const ai = mergedAi.get(code)
    if (!ai) continue
    out.push(mergeAnalysisRow(input, ai))
  }

  console.log(`[Key Candidates] 완료 ${out.length}/${uniqueKeyStocks.length}건`)
  return out
}
