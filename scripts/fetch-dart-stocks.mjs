/**
 * DART corpCode.xml → public/data/stocks.json (로컬 1–2분, Vercel 타임아웃 회피)
 * @see npm run fetch-stocks
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { fetchListedStocksFromDart } from '../server/lib/syncStocksMasterFromDart.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

dotenv.config({ path: path.join(root, '.env.local') })
dotenv.config({ path: path.join(root, '.env') })

function cleanEnv(s) {
  if (s == null || typeof s !== 'string') return ''
  let v = s.trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim()
  }
  return v
}

/**
 * @param {string} outputPath
 */
async function writeStocksJson(outputPath, stocks, source) {
  stocks.sort((a, b) => a.code.localeCompare(b.code))
  const payload = {
    total: stocks.length,
    updatedAt: new Date().toISOString(),
    source,
    stocks,
  }
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8')
  return payload
}

/**
 * DART 키 없을 때 KRX 마스터(kr-stocks.json)로 stocks.json 생성
 */
async function buildFromKrStocks(outputPath) {
  const krPath = path.join(root, 'public/kr-stocks.json')
  const raw = JSON.parse(await fs.readFile(krPath, 'utf-8'))
  if (!Array.isArray(raw) || !raw.length) {
    throw new Error('public/kr-stocks.json 이 비어 있습니다. npm run build:stocks 먼저 실행')
  }
  const stocks = raw
    .map((row) => ({
      code: String(row.c ?? '').padStart(6, '0'),
      name: String(row.n ?? '').trim(),
    }))
    .filter((s) => /^\d{6}$/.test(s.code) && s.name)
  return writeStocksJson(outputPath, stocks, 'kr-stocks')
}

async function main() {
  const outputPath = path.join(root, 'public/data/stocks.json')
  const startTime = Date.now()
  const dartKey = cleanEnv(process.env.DART_API_KEY)

  if (!dartKey) {
    console.warn('[Fetch] DART_API_KEY 없음 → kr-stocks.json 으로 생성 (corp_code 없음)')
    const payload = await buildFromKrStocks(outputPath)
    const elapsed = Math.round((Date.now() - startTime) / 1000)
    console.log(`[Fetch] 완료: ${payload.total}개 → ${outputPath} (${elapsed}초, ${payload.source})`)
    return
  }

  console.log('[Fetch] DART 다운로드 시작')
  const listed = await fetchListedStocksFromDart(dartKey)
  const payload = await writeStocksJson(
    outputPath,
    listed.map(({ code, name, corp_code }) => ({
      code,
      name,
      corp_code: corp_code || undefined,
    })),
    'dart',
  )

  const elapsed = Math.round((Date.now() - startTime) / 1000)
  console.log(`[Fetch] 완료: ${payload.total}개 종목 → ${outputPath} (${elapsed}초, ${payload.source})`)
}

main().catch((e) => {
  console.error('[Fetch 실패]', e)
  process.exit(1)
})
