import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

/** @type {string[]} */
const STOCKS_JSON_CANDIDATES = [
  path.join(PROJECT_ROOT, 'public/data/stocks.json'),
  path.join(PROJECT_ROOT, 'dist/data/stocks.json'),
  path.join(process.cwd(), 'public/data/stocks.json'),
  path.join(process.cwd(), 'dist/data/stocks.json'),
]

/**
 * 사전 빌드된 DART 종목 JSON 로드 (로컬 public · Vercel dist)
 * @returns {Promise<{ total: number, updatedAt?: string, stocks: Array<{ code: string, name: string, corp_code?: string }> }>}
 */
export async function loadStocksJsonFile() {
  let lastErr = null
  for (const filePath of STOCKS_JSON_CANDIDATES) {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const data = JSON.parse(content)
      const stocks = Array.isArray(data?.stocks) ? data.stocks : []
      const total = typeof data?.total === 'number' ? data.total : stocks.length
      return {
        total,
        updatedAt: data?.updatedAt,
        stocks,
        _filePath: filePath,
      }
    } catch (e) {
      lastErr = e
    }
  }
  const hint = lastErr instanceof Error ? lastErr.message : String(lastErr)
  throw new Error(
    `public/data/stocks.json 없음 (${hint}). 로컬에서 npm run fetch-stocks 실행 후 배포하세요.`,
  )
}
