/**
 * Pro 스크리너 아카이브 기록 — 사용자별 일자당 1건 보관.
 * service_role 로 upsert (RLS 우회). 조회 응답에 영향 없도록 best-effort.
 * `(user_id, archive_date)` unique 제약 + ignoreDuplicates 로 그날 첫 스냅샷만 저장.
 */
import { seoulSnapshotDateKey } from './snapshotProGroups.mjs'

/**
 * @typedef {Object} ScreenerArchiveItem
 * @property {number} rank
 * @property {string} code
 * @property {string} name
 * @property {string} [sectorLabel]
 * @property {number} [score]
 * @property {number} [currentPrice]
 * @property {number} [per]
 * @property {number|null} [consensusUpside]
 * @property {number} [expected1MPct]
 * @property {string} [aiCandidateLabel]
 * @property {string} [aiHeadline]
 * @property {string} [aiSummary]
 * @property {string} [aiKeyDriver]
 * @property {string} [aiRisk]
 */

/**
 * @typedef {Object} ScreenerArchiveRow
 * @property {string} userId
 * @property {string|null} [generatedAt]
 * @property {string|null} [model]
 * @property {ScreenerArchiveItem[]} items
 */

/**
 * 스크리너 TOP5 스냅샷을 사용자별 당일 1건으로 보관.
 * @param {import('@supabase/supabase-js').SupabaseClient | null} supabaseService
 * @param {ScreenerArchiveRow} row
 * @returns {Promise<void>}
 */
export async function archiveScreenerSnapshot(supabaseService, row) {
  try {
    if (!supabaseService || !row?.userId) return
    const items = Array.isArray(row.items) ? row.items : []
    if (items.length === 0) return

    const archiveDate = seoulSnapshotDateKey()
    const { error } = await supabaseService.from('pro_screener_archive').upsert(
      {
        user_id: row.userId,
        archive_date: archiveDate,
        generated_at: row.generatedAt ?? null,
        model: row.model ?? null,
        items,
      },
      { onConflict: 'user_id,archive_date', ignoreDuplicates: true },
    )

    if (error) {
      console.warn('[Screener Archive] upsert 실패:', error.message)
    }
  } catch (e) {
    console.warn('[Screener Archive] 예외:', e instanceof Error ? e.message : String(e))
  }
}

/**
 * 사용자의 가장 최근 스크리너 추천 스냅샷 1건 조회 (best-effort, 실패 시 null).
 * @param {import('@supabase/supabase-js').SupabaseClient | null | undefined} supabaseService
 * @param {string} userId
 * @returns {Promise<{ archive_date: string, generated_at: string | null, model: string | null, items: ScreenerArchiveItem[] } | null>}
 */
export async function fetchLatestScreenerArchive(supabaseService, userId) {
  try {
    if (!supabaseService || !userId) return null
    const { data, error } = await supabaseService
      .from('pro_screener_archive')
      .select('archive_date, generated_at, model, items')
      .eq('user_id', userId)
      .order('archive_date', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error || !data) return null
    return data
  } catch (e) {
    console.warn('[Screener Archive] fetchLatest:', e instanceof Error ? e.message : String(e))
    return null
  }
}

/**
 * 최근 스크리너 추천 스냅샷을 프롬프트 컨텍스트 블록으로 변환. 비어 있으면 빈 문자열.
 * @param {{ archive_date: string, items: ScreenerArchiveItem[] } | null | undefined} row
 * @returns {string}
 */
export function buildScreenerArchiveContextPrompt(row) {
  if (!row || !Array.isArray(row.items) || row.items.length === 0) return ''
  const lines = row.items
    .slice(0, 5)
    .map((it) => {
      const rank = Number(it.rank) > 0 ? `${it.rank}. ` : '- '
      const name = String(it.name || '').trim() || String(it.code || '').trim()
      if (!name) return null
      const code = it.code ? `(${it.code})` : ''
      const price =
        Number(it.currentPrice) > 0
          ? `, 추천시 ${Math.round(Number(it.currentPrice)).toLocaleString('ko-KR')}원`
          : ''
      const headline = it.aiHeadline ? ` — ${String(it.aiHeadline).trim()}` : ''
      return `${rank}${name}${code}${price}${headline}`
    })
    .filter(Boolean)

  if (lines.length === 0) return ''

  return `

[최근 AI 스크리너 추천 TOP5 (${row.archive_date} 기준, 참고용)]
${lines.join('\n')}

사용자가 스크리너 추천이나 "추천 종목"을 언급하면 위 목록을 참고하되, 현재 시점의 최신 실시간 데이터를 우선해 재검증하세요.`
}
