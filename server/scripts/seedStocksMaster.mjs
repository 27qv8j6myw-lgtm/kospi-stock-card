/**
 * `stocks_master` 테이블 upsert 시드.
 * 실행: `node server/scripts/seedStocksMaster.mjs` (프로젝트 루트 .env 에 Supabase URL + service_role)
 *
 * @see scripts/supabase-stocks-master.sql (DDL 참고)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..', '..')
const ENV_PATH = path.join(PROJECT_ROOT, '.env')

dotenv.config({ path: ENV_PATH, override: true, quiet: true })

function cleanEnv(s) {
  if (s == null || typeof s !== 'string') return ''
  let v = s.trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim()
  }
  return v
}

/** KRX `kr-stocks.json` 에 없을 때 보조 — 코스닥 위주 */
const KOSDAQ_EXTRA = new Set(
  [
    '247540', '196170', '086520', '277810', '263750', '086900', '293490', '041510', '145020', '131970', '141080',
    '214450', '253450', '278470', '225570', '310210', '356860', '348370', '183300', '161580', '222800', '214370',
    '237690', '403870', '417200', '377300', '259960', '352820', '352480', '068760', '251270', '180640',
  ].map((c) => c.padStart(6, '0')),
)

const KOSPI_FORCE = new Set(['373220', '086790', '323410', '316140', '039490', '071050', '302440'])

function marketForCode(code) {
  if (KOSPI_FORCE.has(code)) return 'KOSPI'
  if (KOSDAQ_EXTRA.has(code)) return 'KOSDAQ'
  const n = Number(code)
  if (n >= 200_000 && n < 700_000) return 'KOSDAQ'
  return 'KOSPI'
}

function loadBuiltin() {
  const p = path.join(__dirname, 'stocksMasterSeedBuiltin.json')
  const raw = JSON.parse(fs.readFileSync(p, 'utf-8'))
  return raw.map((r) => ({
    code: String(r.code).replace(/\D/g, '').padStart(6, '0'),
    name: String(r.name || '').trim(),
    market: String(r.market || 'KOSPI'),
    sector: String(r.sector || '기타').trim() || '기타',
  }))
}

function loadKrStocksOptional(maxExtra) {
  const p = path.join(PROJECT_ROOT, 'public', 'kr-stocks.json')
  if (!fs.existsSync(p)) return []
  const list = JSON.parse(fs.readFileSync(p, 'utf-8'))
  if (!Array.isArray(list)) return []
  const out = []
  for (const row of list) {
    const code = String(row.c || row.code || '')
      .replace(/\D/g, '')
      .padStart(6, '0')
    const name = String(row.n || row.name || '').trim()
    if (!/^\d{6}$/.test(code) || !name) continue
    out.push({
      code,
      name,
      market: marketForCode(code),
      sector: '기타',
    })
    if (out.length >= maxExtra) break
  }
  return out
}

async function main() {
  const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const key = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY)
  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL 및 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.')
    process.exit(1)
  }

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

  const merged = new Map()
  for (const r of loadBuiltin()) merged.set(r.code, r)
  const extra = loadKrStocksOptional(450)
  let fromJson = 0
  for (const r of extra) {
    if (merged.has(r.code)) continue
    merged.set(r.code, r)
    fromJson += 1
  }

  const rows = [...merged.values()]
  const chunk = 200
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk)
    const { error } = await supabase.from('stocks_master').upsert(slice, { onConflict: 'code' })
    if (error) {
      console.error('[upsert]', error.message)
      process.exit(1)
    }
  }

  const { count, error: cErr } = await supabase.from('stocks_master').select('*', { count: 'exact', head: true })
  if (cErr) {
    console.warn('[count]', cErr.message, '— 이번 upsert 건수만 보고')
    console.log(`Upserted ${rows.length} rows (builtin + ${fromJson} from public/kr-stocks.json)`)
    return
  }
  console.log(`Upserted ${rows.length} rows (builtin + ${fromJson} from public/kr-stocks.json).`)
  console.log(`stocks_master total row count (estimate): ${count ?? 'unknown'}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
