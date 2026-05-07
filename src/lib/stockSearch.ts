import Fuse from 'fuse.js'

/** public/kr-stocks.json 한 줄 (빌드 스크립트와 동일 키) */
export type StockRow = {
  c: string
  n: string
  /** 한글 종목명 로마자(영문 검색용) */
  r: string
}

let rowsCache: StockRow[] | null = null
let fuse: Fuse<StockRow> | null = null

export async function loadStockRows(): Promise<StockRow[]> {
  if (rowsCache) return rowsCache
  const res = await fetch('/kr-stocks.json')
  if (!res.ok) throw new Error(`종목 목록 로드 실패 (${res.status})`)
  rowsCache = (await res.json()) as StockRow[]
  return rowsCache
}

function ensureFuse(rows: StockRow[]) {
  if (!fuse) {
    fuse = new Fuse(rows, {
      keys: [
        { name: 'n', weight: 0.5 },
        { name: 'r', weight: 0.38 },
        { name: 'c', weight: 0.12 },
      ],
      threshold: 0.34,
      ignoreLocation: true,
      minMatchCharLength: 1,
      isCaseSensitive: false,
    })
  }
  return fuse
}

/** 숫자만 → 종목코드 부분 일치 우선 */
function searchByCodeDigits(q: string, rows: StockRow[], limit: number) {
  const digits = q.replace(/\D/g, '')
  if (!digits.length) return []
  const out: StockRow[] = []
  for (const row of rows) {
    if (row.c.includes(digits)) out.push(row)
    if (out.length >= limit) break
  }
  return out
}

/**
 * 종목명(한글)·로마자(영문 유사)·코드로 검색
 */
export async function searchStocks(
  query: string,
  limit: number = 18,
): Promise<StockRow[]> {
  const q = query.trim()
  if (!q) return []

  const rows = await loadStockRows()

  if (/^\d+$/.test(q)) {
    return searchByCodeDigits(q, rows, limit)
  }

  const f = ensureFuse(rows)
  return f.search(q, { limit }).map((x) => x.item)
}
