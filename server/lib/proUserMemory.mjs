/**
 * Pro 채팅 메모리 — 사용자가 대화에서 정한 매매 원칙/선호를 영구 보관하고
 * 새 대화 시스템 프롬프트에 주입한다. (pro_user_memory)
 *
 * - 명시적 "기억해줘" 또는 N턴마다 자동 추출(Haiku)로 원칙 후보를 뽑아 저장
 * - 모든 조회/저장은 best-effort: 실패해도 채팅 흐름에 영향 없음
 */

const HAIKU_MODEL = 'claude-haiku-4-5-20251001'
/** 사용자당 최대 보관 개수 (초과 시 오래된 것부터 정리) */
const MAX_MEMORIES = 50
/** 프롬프트 주입 시 최신 N개만 */
const INJECT_LIMIT = 30
/** 1회 추출 최대 개수 */
const EXTRACT_LIMIT = 3

/**
 * @param {string} s
 */
function normalizeForDedup(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[.,!?·•\-"'()[\]]/g, '')
}

/**
 * 활성 메모리 최신순 조회.
 * @param {import('@supabase/supabase-js').SupabaseClient | null | undefined} supabaseService
 * @param {string} userId
 * @param {number} [limit]
 * @returns {Promise<Array<{ id: string, content: string, created_at: string }>>}
 */
export async function fetchUserMemories(supabaseService, userId, limit = INJECT_LIMIT) {
  if (!supabaseService || !userId) return []
  try {
    const { data, error } = await supabaseService
      .from('pro_user_memory')
      .select('id, content, created_at')
      .eq('user_id', userId)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(Math.max(1, limit))
    if (error || !Array.isArray(data)) return []
    return data
  } catch (e) {
    console.warn('[proUserMemory] fetch', e instanceof Error ? e.message : String(e))
    return []
  }
}

/**
 * 메모리 행들을 시스템 프롬프트 블록으로 변환. 비어 있으면 빈 문자열.
 * @param {Array<{ content: string }>} rows
 * @returns {string}
 */
export function buildMemoryContextPrompt(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return ''
  const lines = rows
    .map((r) => String(r.content || '').trim())
    .filter(Boolean)
    .map((c) => `- ${c}`)
  if (lines.length === 0) return ''

  return `

[사용자 매매 원칙·선호 (기억)]
아래는 사용자가 과거 대화에서 정한 매매 원칙·선호입니다. 분석·답변 시 반드시 반영하세요. (단, 현재 시점의 최신 데이터·리스크 경고가 우선이며, 원칙이 비합리적이면 그 점을 정중히 짚어주세요.)
${lines.join('\n')}`
}

/**
 * 최근 대화에서 사용자의 "지속적인 매매 원칙/선호"를 추출 (Haiku). 새 항목만 반환.
 * @param {import('@anthropic-ai/sdk').default} client
 * @param {{ recentMessages: Array<{ role: string, content: string }>, existingMemories: string[] }} opts
 * @returns {Promise<string[]>}
 */
export async function extractMemoriesFromConversation(client, opts) {
  const { recentMessages = [], existingMemories = [] } = opts || {}
  const convo = recentMessages
    .filter((m) => m && m.content)
    .map((m) => `${m.role === 'assistant' ? 'AI' : '사용자'}: ${String(m.content).slice(0, 1200)}`)
    .join('\n')
  if (!convo.trim()) return []

  const existingBlock = existingMemories.length
    ? `\n\n[이미 저장된 원칙 — 중복 제외]\n${existingMemories.map((m) => `- ${m}`).join('\n')}`
    : ''

  const prompt = `다음 대화에서 "사용자"가 밝힌 **지속적으로 적용할 매매 원칙·투자 선호·규칙**만 추출하세요.
- 일회성 질문·특정 종목 단발성 의견·AI의 분석 내용은 제외
- 예: "손절은 -7% 고정", "반도체 비중 30% 이하 유지", "실적 발표 전엔 신규 진입 안 함"
- 새로 추가할 원칙이 없으면 빈 배열 []
- 이미 저장된 원칙과 의미가 같으면 제외
- 각 항목은 한국어 한 문장(40자 이내), 최대 ${EXTRACT_LIMIT}개
- 반드시 JSON 문자열 배열만 출력 (설명·코드펜스 금지). 예: ["손절 -7% 고정","현금 20% 이상 유지"]${existingBlock}

[대화]
${convo}`

  try {
    const res = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = res.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('')
      .trim()
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/i, '')
      .trim()

    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((x) => String(x || '').trim())
      .filter((x) => x.length >= 2 && x.length <= 80)
      .slice(0, EXTRACT_LIMIT)
  } catch (e) {
    console.warn('[proUserMemory] extract', e instanceof Error ? e.message : String(e))
    return []
  }
}

/**
 * 메모리 저장 (기존과 중복 제거 후 insert + prune).
 * @param {import('@supabase/supabase-js').SupabaseClient | null | undefined} supabaseService
 * @param {string} userId
 * @param {string[]} contents
 * @param {string | null} [conversationId]
 * @returns {Promise<number>} 저장된 개수
 */
export async function saveMemories(supabaseService, userId, contents, conversationId = null) {
  if (!supabaseService || !userId) return 0
  const candidates = (Array.isArray(contents) ? contents : [])
    .map((c) => String(c || '').trim())
    .filter(Boolean)
  if (candidates.length === 0) return 0

  try {
    const existing = await fetchUserMemories(supabaseService, userId, MAX_MEMORIES)
    const existingNorm = new Set(existing.map((r) => normalizeForDedup(r.content)))

    /** @type {Array<{ user_id: string, content: string, source_conversation_id: string | null }>} */
    const rows = []
    for (const content of candidates) {
      const norm = normalizeForDedup(content)
      if (!norm || existingNorm.has(norm)) continue
      existingNorm.add(norm)
      rows.push({ user_id: userId, content, source_conversation_id: conversationId })
    }
    if (rows.length === 0) return 0

    const { error } = await supabaseService.from('pro_user_memory').insert(rows)
    if (error) {
      console.warn('[proUserMemory] insert', error.message)
      return 0
    }
    void pruneOld(supabaseService, userId)
    return rows.length
  } catch (e) {
    console.warn('[proUserMemory] save', e instanceof Error ? e.message : String(e))
    return 0
  }
}

/**
 * 수동 단건 추가.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseService
 * @param {string} userId
 * @param {string} content
 * @returns {Promise<{ id: string, content: string, created_at: string } | null>}
 */
export async function addMemory(supabaseService, userId, content) {
  const text = String(content || '').trim()
  if (!text) return null
  const { data, error } = await supabaseService
    .from('pro_user_memory')
    .insert({ user_id: userId, content: text.slice(0, 200), source_conversation_id: null })
    .select('id, content, created_at')
    .single()
  if (error) throw new Error(error.message)
  void pruneOld(supabaseService, userId)
  return data
}

/**
 * 단건 삭제 (본인 것만).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseService
 * @param {string} userId
 * @param {string} id
 */
export async function deleteMemory(supabaseService, userId, id) {
  const { error } = await supabaseService
    .from('pro_user_memory')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
}

/**
 * 최신 MAX_MEMORIES 개만 유지, 초과분 삭제.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseService
 * @param {string} userId
 */
async function pruneOld(supabaseService, userId) {
  try {
    const { data, error } = await supabaseService
      .from('pro_user_memory')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(MAX_MEMORIES, MAX_MEMORIES + 199)
    if (error || !data?.length) return
    await supabaseService
      .from('pro_user_memory')
      .delete()
      .in('id', data.map((r) => r.id))
  } catch {
    // prune 실패 무시
  }
}
