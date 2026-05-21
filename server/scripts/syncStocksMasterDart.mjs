/**
 * DART → stocks_master CLI 동기화
 * 실행: `node server/scripts/syncStocksMasterDart.mjs` (루트 .env 필요)
 */
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { syncStocksMasterFromDart } from '../lib/syncStocksMasterFromDart.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../.env') })
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') })

const out = await syncStocksMasterFromDart()
if (!out.ok) {
  console.error('[sync] 실패:', out.error)
  process.exit(1)
}
console.log('[sync] 완료', out)
process.exit(out.batchErrors?.length ? 1 : 0)
