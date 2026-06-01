/**
 * 프로덕션 배치 API로 stocks_master.market 일괄 갱신 (로컬 Supabase 키 불필요)
 *
 * 사전: Vercel `STOCK_MARKET_REFRESH_SECRET` 설정 + `api/refresh-stock-market-batch` 배포
 *
 * 실행:
 *   STOCK_MARKET_REFRESH_SECRET=... node server/scripts/refreshStockMarketRemote.mjs
 *   node server/scripts/refreshStockMarketRemote.mjs --base=https://signal15.vercel.app
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..', '..')

dotenv.config({ path: path.join(PROJECT_ROOT, '.env'), override: false, quiet: true })
dotenv.config({ path: path.join(PROJECT_ROOT, '.env.local'), override: false, quiet: true })

function parseArg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`))
  return hit ? hit.split('=').slice(1).join('=') : fallback
}

const BASE = parseArg('--base', 'https://signal15.vercel.app').replace(/\/$/, '')
const SECRET = parseArg('--secret', process.env.STOCK_MARKET_REFRESH_SECRET || '')
const LIMIT = Number(parseArg('--limit', '20')) || 20
const DELAY_MS = Number(parseArg('--delay', '400')) || 400
const START_OFFSET = Math.max(0, Number(parseArg('--from', '0')) || 0)
const MAX_RETRIES = 4

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  if (!SECRET) {
    throw new Error('STOCK_MARKET_REFRESH_SECRET 환경변수 또는 --secret= 필요')
  }

  let offset = START_OFFSET
  let total = null
  let totals = { updated: 0, delisted: 0, errors: 0, unchanged: 0, processed: 0 }

  while (true) {
    let body = /** @type {Record<string, unknown>} */ ({})
    let res = null
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      res = await fetch(`${BASE}/api/refresh-stock-market-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-stock-market-refresh-secret': SECRET,
        },
        body: JSON.stringify({ offset, limit: LIMIT }),
      })
      body = await res.json().catch(() => ({}))
      if (res.ok) break
      const errMsg =
        typeof body.error === 'string'
          ? body.error
          : JSON.stringify(body.error ?? body) || `HTTP ${res.status}`
      if (attempt + 1 >= MAX_RETRIES) {
        throw new Error(`${errMsg} (offset=${offset})`)
      }
      console.warn(`[remote] 재시도 ${attempt + 1}/${MAX_RETRIES} offset=${offset}:`, errMsg)
      await sleep(2000 * (attempt + 1))
    }
    if (!res?.ok) {
      throw new Error(`HTTP ${res?.status ?? '?'} (offset=${offset})`)
    }

    total = body.total ?? total
    totals.updated += body.updated ?? 0
    totals.delisted += body.delisted ?? 0
    totals.errors += body.errors ?? 0
    totals.unchanged += body.unchanged ?? 0
    totals.processed += body.processed ?? 0

    const next = body.nextOffset
    console.log(
      `[remote] ${offset}~${offset + (body.processed ?? 0)}/${total} — 갱신 ${body.updated}, null ${body.delisted}, 동일 ${body.unchanged}, KIS오류 ${body.errors}`,
    )

    if (body.done || next == null) break
    offset = next
    await sleep(DELAY_MS)
  }

  console.log('[remote] 완료', { total, ...totals })
}

main().catch((e) => {
  console.error('[remote] 실패:', e)
  process.exit(1)
})
