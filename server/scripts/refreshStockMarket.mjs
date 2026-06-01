/**
 * stocks_master.market — KIS 현재가 기준 거래중/상폐 구분 (일회성 CLI)
 *
 * - 시세·가격 있음 → market 갱신 (KOSPI/KOSDAQ/KONEX)
 * - 시세 없음·오류 → market = null (삭제하지 않음)
 *
 * 실행: `node server/scripts/refreshStockMarket.mjs` (프로젝트 루트 .env)
 * 옵션: `--dry-run`, `--batch=10`, `--delay=500`
 * 로컬에 Supabase 키 없으면: `refreshStockMarketRemote.mjs` (프로덕션 API)
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { refreshStockMarketSlice } from '../lib/refreshStockMarketCore.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..', '..')

dotenv.config({ path: path.join(PROJECT_ROOT, '.env'), override: false, quiet: true })
dotenv.config({ path: path.join(PROJECT_ROOT, '.env.local'), override: false, quiet: true })
dotenv.config({ path: path.join(PROJECT_ROOT, '.env.production'), override: false, quiet: true })

function cleanEnv(s) {
  if (s == null || typeof s !== 'string') return ''
  let v = s.trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim()
  }
  return v
}

function getKisEnv() {
  const appKey = cleanEnv(process.env.KIS_APP_KEY)
  const appSecret = cleanEnv(process.env.KIS_APP_SECRET)
  const env = process.env.KIS_ENV === 'prod' ? 'prod' : 'vps'
  if (!appKey || !appSecret) {
    throw new Error('KIS_APP_KEY, KIS_APP_SECRET 이 필요합니다 (.env)')
  }
  return { appKey, appSecret, env }
}

function parseArg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`))
  if (!hit) return fallback
  const n = Number(hit.split('=')[1])
  return Number.isFinite(n) && n > 0 ? n : fallback
}

const DRY_RUN = process.argv.includes('--dry-run')
const BATCH = parseArg('--batch', 10)
const DELAY_MS = parseArg('--delay', 500)
const PAGE = 1000

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
async function fetchAllStocks(supabase) {
  /** @type {Array<{ code: string, name: string, market: string | null }>} */
  const all = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('stocks_master')
      .select('code,name,market')
      .order('code', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data?.length) break
    all.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return all
}

async function main() {
  const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const key = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY)
  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 가 필요합니다 (.env 또는 .env.production). 없으면 refreshStockMarketRemote.mjs 사용',
    )
  }

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const kis = getKisEnv()

  const all = await fetchAllStocks(supabase)
  console.log(`[refreshStockMarket] 전체 종목: ${all.length} (dry-run=${DRY_RUN}, batch=${BATCH}, delay=${DELAY_MS}ms)`)

  let updated = 0
  let delisted = 0
  let errors = 0
  let unchanged = 0

  for (let i = 0; i < all.length; i += BATCH) {
    const batch = all.slice(i, i + BATCH)
    const stats = await refreshStockMarketSlice(supabase, kis, batch, {
      dryRun: DRY_RUN,
      parallel: BATCH,
    })
    updated += stats.updated
    delisted += stats.delisted
    errors += stats.errors
    unchanged += stats.unchanged

    if (i % 500 === 0 || i + BATCH >= all.length) {
      console.log(
        `[refreshStockMarket] 진행: ${Math.min(i + BATCH, all.length)}/${all.length} — 거래중 갱신 ${updated}, 상폐의심(null) ${delisted}, 동일 ${unchanged}, KIS오류 ${errors}`,
      )
    }
    if (i + BATCH < all.length) await sleep(DELAY_MS)
  }

  const { count: active } = await supabase
    .from('stocks_master')
    .select('*', { count: 'exact', head: true })
    .not('market', 'is', null)
  const { count: inactive } = await supabase
    .from('stocks_master')
    .select('*', { count: 'exact', head: true })
    .is('market', null)

  console.log(
    `[refreshStockMarket] 완료 — 거래중 갱신 ${updated}, 상폐의심(null) ${delisted}, 변경없음 ${unchanged}, KIS오류 ${errors}`,
  )
  if (!DRY_RUN) {
    console.log(`[refreshStockMarket] DB 집계 — market NOT NULL: ${active ?? '?'}, market NULL: ${inactive ?? '?'}`)
  }
}

main().catch((e) => {
  console.error('[refreshStockMarket] 실패:', e)
  process.exit(1)
})
