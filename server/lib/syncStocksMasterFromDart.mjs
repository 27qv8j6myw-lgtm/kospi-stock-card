/**
 * DART corpCode.xml → stocks_master 일괄 upsert
 * @see https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS001&apiId=2019018
 */
import AdmZip from 'adm-zip'
import { parseStringPromise } from 'xml2js'
import { createClient } from '@supabase/supabase-js'

const BATCH_SIZE = 500
const DART_CORP_CODE_URL = 'https://opendart.fss.or.kr/api/corpCode.xml'

function cleanEnv(s) {
  if (s == null || typeof s !== 'string') return ''
  let v = s.trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim()
  }
  return v
}

function getServiceSupabase() {
  const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const key = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY)
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/**
 * @param {unknown} listNode
 * @returns {Array<Record<string, string>>}
 */
function normalizeCorpList(listNode) {
  if (!listNode) return []
  if (Array.isArray(listNode)) return listNode
  if (typeof listNode === 'object') return [listNode]
  return []
}

/**
 * @param {string} dartKey
 * @returns {Promise<Array<{ code: string, name: string, corp_code: string }>>}
 */
export async function fetchListedStocksFromDart(dartKey) {
  const url = `${DART_CORP_CODE_URL}?crtfc_key=${encodeURIComponent(dartKey)}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`DART API HTTP ${response.status}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  const zip = new AdmZip(buffer)
  const xmlEntry = zip.getEntries().find((e) => /\.xml$/i.test(e.entryName))
  if (!xmlEntry) {
    throw new Error('ZIP 안에서 XML 파일을 찾을 수 없습니다')
  }

  const xmlContent = xmlEntry.getData().toString('utf-8')
  const parsed = await parseStringPromise(xmlContent, { explicitArray: false, trim: true })
  const allCorps = normalizeCorpList(parsed?.result?.list)
  console.log(`[Sync] DART 전체 기업 ${allCorps.length}건 수신`)

  const byCode = new Map()
  for (const c of allCorps) {
    const code = String(c?.stock_code ?? '')
      .replace(/\D/g, '')
      .padStart(6, '0')
    if (!/^\d{6}$/.test(code) || code === '000000') continue

    const name = String(c?.corp_name ?? '').trim()
    if (!name) continue

    const corp_code = String(c?.corp_code ?? '').trim()
    byCode.set(code, { code, name, corp_code })
  }

  return [...byCode.values()]
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Array<{ code: string, name: string, corp_code?: string }>} rows
 * @param {{ includeCorpCode: boolean }} opts
 * @returns {Promise<{ ok: true, inserted: number } | { ok: false, error: string }>}
 */
async function upsertOneBatch(supabase, rows, opts) {
  const batch = rows.map((s) => {
    const row = {
      code: s.code,
      name: s.name,
      updated_at: new Date().toISOString(),
    }
    if (opts.includeCorpCode && s.corp_code) {
      row.corp_code = s.corp_code
    }
    return row
  })

  const { error } = await supabase.from('stocks_master').upsert(batch, { onConflict: 'code' })
  if (error) {
    return { ok: false, error: error.message }
  }
  return { ok: true, inserted: batch.length }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Array<{ code: string, name: string, corp_code?: string }>} rows
 * @param {{ includeCorpCode: boolean }} opts
 */
async function upsertBatches(supabase, rows, opts) {
  let upserted = 0
  const batchErrors = []

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const slice = rows.slice(i, i + BATCH_SIZE)
    const out = await upsertOneBatch(supabase, slice, opts)
    if (!out.ok) {
      batchErrors.push({ offset: i, message: out.error })
      console.error(`[Sync] 배치 실패 (${i}~${i + slice.length}):`, out.error)
    } else {
      upserted += out.inserted
      console.log(`[Sync] ${upserted}/${rows.length}`)
    }
  }

  return { upserted, batchErrors }
}

const MAX_CHUNK = 500

/**
 * API 청크 1회 upsert (최대 500건)
 * @param {Array<{ code?: string, name?: string, corp_code?: string }>} stocks
 */
export async function upsertStocksMasterChunk(stocks) {
  const supabase = getServiceSupabase()
  if (!supabase) {
    return { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY 또는 URL 없음' }
  }

  if (!Array.isArray(stocks) || stocks.length === 0) {
    return { ok: false, error: 'stocks 배열 필요' }
  }
  if (stocks.length > MAX_CHUNK) {
    return { ok: false, error: '한 번에 500개 이하' }
  }

  const rows = []
  for (const s of stocks) {
    const code = String(s?.code ?? '')
      .replace(/\D/g, '')
      .padStart(6, '0')
    if (!/^\d{6}$/.test(code) || code === '000000') continue
    const name = String(s?.name ?? '').trim()
    if (!name) continue
    const corp_code = String(s?.corp_code ?? '').trim()
    rows.push({ code, name, corp_code: corp_code || undefined })
  }

  if (!rows.length) {
    return { ok: false, error: '유효한 종목 없음' }
  }

  let out = await upsertOneBatch(supabase, rows, { includeCorpCode: true })
  if (!out.ok && /corp_code|column/i.test(out.error)) {
    console.warn('[Sync-Batch] corp_code 컬럼 없음 — code/name 만 등록')
    out = await upsertOneBatch(supabase, rows, { includeCorpCode: false })
  }

  return out
}

/**
 * @returns {Promise<
 *   | { ok: true, total: number, inserted: number, batchErrors: Array<{ offset: number, message: string }> }
 *   | { ok: false, error: string }
 * >}
 */
export async function syncStocksMasterFromDart() {
  const dartKey = cleanEnv(process.env.DART_API_KEY)
  if (!dartKey) {
    return { ok: false, error: 'DART_API_KEY 가 설정되지 않았습니다' }
  }

  const supabase = getServiceSupabase()
  if (!supabase) {
    return { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY 또는 URL 없음' }
  }

  try {
    console.log('[Sync] DART corpCode 다운로드 시작')
    const listedStocks = await fetchListedStocksFromDart(dartKey)
    console.log(`[Sync] 상장 종목 ${listedStocks.length}개 추출`)

    let { upserted, batchErrors } = await upsertBatches(supabase, listedStocks, { includeCorpCode: true })

    if (
      batchErrors.length > 0 &&
      batchErrors.some((e) => /corp_code|column/i.test(e.message))
    ) {
      console.warn('[Sync] corp_code 컬럼 없음 — code/name 만 재시도')
      const retry = await upsertBatches(supabase, listedStocks, { includeCorpCode: false })
      upserted = retry.upserted
      batchErrors = retry.batchErrors
    }

    const { count, error: countErr } = await supabase
      .from('stocks_master')
      .select('*', { count: 'exact', head: true })

    if (countErr) {
      console.warn('[Sync] count 조회 실패:', countErr.message)
    }

    return {
      ok: true,
      total: listedStocks.length,
      inserted: upserted,
      tableCount: count ?? null,
      batchErrors,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[Sync] 실패:', message)
    return { ok: false, error: message }
  }
}
