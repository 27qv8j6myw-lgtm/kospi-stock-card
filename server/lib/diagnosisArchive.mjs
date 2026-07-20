/**
 * Pro AI 진단 아카이브 기록 — 진단이 새로 생성될 때만 1건 보관.
 * service_role 로 insert (RLS 우회). 실패해도 진단 응답에 영향 없도록 best-effort.
 */

/** 사용자/종류별 최대 보관 건수 (초과 시 오래된 것부터 정리) */
const MAX_PER_USER_KIND = 100

/** 종합 의견 후보 키워드 (우선순위 순) */
const VERDICT_KEYWORDS = ['추가매수', '일부익절', '익절', '손절', '홀딩', '관망', '매수', '매도']

/**
 * 분석 본문에서 원화 금액 추출 (예: "230,000원", "230,000~250,000원").
 * @param {string} segment
 * @returns {number[]}
 */
function extractWonNumbers(segment) {
  if (!segment) return []
  const out = []
  const re = /([0-9][0-9,]{2,})\s*원/g
  let m
  while ((m = re.exec(segment)) !== null) {
    const n = Number(m[1].replace(/,/g, ''))
    if (Number.isFinite(n) && n > 0) out.push(n)
    if (out.length >= 4) break
  }
  return out
}

/**
 * 진단 본문에서 구조화 요약 추출 (best-effort, 실패해도 빈 값).
 * @param {string} analysis
 * @returns {{ verdict: string | null, summary: string | null, targetPrices: number[], stopPrices: number[] }}
 */
export function extractDiagnosisSummary(analysis) {
  const text = String(analysis || '')
  if (!text.trim()) return { verdict: null, summary: null, targetPrices: [], stopPrices: [] }

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  // 종합 의견 라인 우선 탐색
  const opinionLine =
    lines.find((l) => l.includes('종합 의견') || l.includes('종합의견')) || ''

  let verdict = null
  const verdictScope = opinionLine || text.slice(0, 400)
  for (const kw of VERDICT_KEYWORDS) {
    if (verdictScope.includes(kw)) {
      verdict = kw
      break
    }
  }

  // 요약: 종합 의견 라인의 마크다운/번호/대괄호 제거, 없으면 프로필(📊) 줄 제외 첫 문장
  let summary = null
  if (opinionLine) {
    summary = opinionLine
      .replace(/^[0-9]+\.\s*/, '')
      .replace(/\[[^\]]*\]/g, '')
      .replace(/[*#>-]/g, '')
      .trim()
  }
  if (!summary) {
    const firstMeaningful = lines.find((l) => !l.startsWith('📊') && l.length > 8)
    summary = firstMeaningful ? firstMeaningful.replace(/[*#>-]/g, '').trim() : null
  }
  if (summary && summary.length > 160) summary = `${summary.slice(0, 157)}...`

  // 목표가 / 손절가: 키워드 부근 본문에서 원화 숫자
  const targetSeg = lines.filter((l) => l.includes('목표')).join(' ')
  const stopSeg = lines.filter((l) => l.includes('손절')).join(' ')

  return {
    verdict,
    summary,
    targetPrices: extractWonNumbers(targetSeg),
    stopPrices: extractWonNumbers(stopSeg),
  }
}

/**
 * 서울 기준 날짜 문자열(YYYY-MM-DD).
 * @param {string} iso
 * @returns {string}
 */
function formatSeoulDate(iso) {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/**
 * AI 분석 시 참고할 과거 진단을 최신순으로 조회 (best-effort, 실패 시 빈 배열).
 * @param {import('@supabase/supabase-js').SupabaseClient | null | undefined} supabaseService
 * @param {{ userId: string, kind: 'holding' | 'portfolio' | 'group', code?: string | null, refId?: string | null, limit?: number, before?: string | null }} opts
 *   before: 지정 시 created_at <= before 인 항목만 (특정 시점 이전 진단 조회용)
 * @returns {Promise<Array<{ created_at: string, current_price: number | null, profit_pct: number | null, meta: Record<string, unknown> | null }>>}
 */
export async function fetchRecentDiagnoses(supabaseService, opts) {
  const { userId, kind, code = null, refId = null, limit = 2, before = null } = opts || {}
  if (!supabaseService || !userId || !kind) return []
  try {
    let q = supabaseService
      .from('pro_diagnosis_archive')
      .select('created_at, current_price, profit_pct, meta')
      .eq('user_id', userId)
      .eq('kind', kind)
      .order('created_at', { ascending: false })
      .limit(Math.max(1, limit))
    if (code) q = q.eq('code', code)
    if (refId) q = q.eq('ref_id', refId)
    if (before) q = q.lte('created_at', before)
    const { data, error } = await q
    if (error || !Array.isArray(data)) return []
    return data
  } catch (e) {
    console.warn('[diagnosisArchive] fetchRecent', e instanceof Error ? e.message : String(e))
    return []
  }
}

/**
 * 과거 진단 행들을 프롬프트에 붙일 컨텍스트 블록으로 변환.
 * 비어 있으면 빈 문자열.
 * @param {Array<{ created_at: string, current_price: number | null, profit_pct: number | null, meta: Record<string, unknown> | null }>} rows
 * @returns {string}
 */
export function buildArchiveContextPrompt(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return ''
  const lines = rows
    .map((r) => {
      const date = formatSeoulDate(r.created_at)
      if (!date) return null
      const meta = r.meta || {}
      const verdict = meta.verdict ? `의견 "${meta.verdict}"` : '의견 기록 없음'
      const price =
        Number(r.current_price) > 0
          ? `, 진단가 ${Math.round(Number(r.current_price)).toLocaleString('ko-KR')}원`
          : ''
      const pct =
        Number.isFinite(Number(r.profit_pct)) && r.profit_pct != null
          ? ` (${Number(r.profit_pct) > 0 ? '+' : ''}${Number(r.profit_pct).toFixed(1)}%)`
          : ''
      const summary = meta.summary ? ` — ${String(meta.summary)}` : ''
      return `- ${date}: ${verdict}${price}${pct}${summary}`
    })
    .filter(Boolean)

  if (lines.length === 0) return ''

  return `

[이전 진단 기록 (제가 과거에 받은 진단, 참고용)]
${lines.join('\n')}

위 과거 진단을 참고해, 직전 대비 입장(매수/홀딩/익절/손절 등)이 바뀌었다면 무엇이 왜 바뀌었는지 1줄로 짚어주시고, 동일하게 유지된다면 그 일관성의 근거를 덧붙여 주세요. 단, 현재 시점의 최신 데이터를 우선하고 과거 진단을 맹신하지 마세요.`
}

/**
 * @typedef {object} DiagnosisArchiveRow
 * @property {string} userId
 * @property {'holding' | 'portfolio' | 'group'} kind
 * @property {string | null} [refId]
 * @property {string | null} [code]
 * @property {string} title
 * @property {string} analysis
 * @property {number | null} [profitPct]
 * @property {number | null} [currentPrice]
 * @property {string | null} [model]
 * @property {Record<string, unknown>} [meta]
 */

/**
 * 진단 결과를 아카이브에 기록 (best-effort, fire-and-forget 가능).
 * @param {import('@supabase/supabase-js').SupabaseClient | null | undefined} supabaseService
 * @param {DiagnosisArchiveRow} row
 * @returns {Promise<void>}
 */
export async function archiveDiagnosis(supabaseService, row) {
  if (!supabaseService) return
  if (!row?.userId || !row?.kind || !row?.title || !row?.analysis) return

  try {
    const summary = extractDiagnosisSummary(row.analysis)
    const meta = {
      ...(row.meta ?? {}),
      verdict: summary.verdict,
      summary: summary.summary,
      targetPrices: summary.targetPrices,
      stopPrices: summary.stopPrices,
    }
    const { error } = await supabaseService.from('pro_diagnosis_archive').insert({
      user_id: row.userId,
      kind: row.kind,
      ref_id: row.refId ?? null,
      code: row.code ?? null,
      title: row.title,
      analysis: row.analysis,
      profit_pct: Number.isFinite(row.profitPct) ? row.profitPct : null,
      current_price: Number.isFinite(row.currentPrice) ? row.currentPrice : null,
      model: row.model ?? null,
      meta,
    })
    if (error) {
      console.warn('[diagnosisArchive] insert', error.message)
      return
    }
    void pruneOld(supabaseService, row.userId, row.kind)
  } catch (e) {
    console.warn('[diagnosisArchive]', e instanceof Error ? e.message : String(e))
  }
}

/**
 * 사용자/종류별 최신 MAX_PER_USER_KIND 건만 유지하고 초과분 삭제.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseService
 * @param {string} userId
 * @param {'holding' | 'portfolio' | 'group'} kind
 */
async function pruneOld(supabaseService, userId, kind) {
  try {
    const { data, error } = await supabaseService
      .from('pro_diagnosis_archive')
      .select('id')
      .eq('user_id', userId)
      .eq('kind', kind)
      .order('created_at', { ascending: false })
      .range(MAX_PER_USER_KIND, MAX_PER_USER_KIND + 199)

    if (error || !data?.length) return
    const ids = data.map((r) => r.id)
    await supabaseService.from('pro_diagnosis_archive').delete().in('id', ids)
  } catch {
    // prune 실패는 무시
  }
}
