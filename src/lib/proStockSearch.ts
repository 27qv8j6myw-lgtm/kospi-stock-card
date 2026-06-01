import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'

export type ProStockSearchRow = { code: string; name: string; market?: string }

/**
 * @param {unknown} data
 * @returns {ProStockSearchRow[]}
 */
export function parseStockSearchRows(data: unknown): ProStockSearchRow[] {
  if (!data || typeof data !== 'object') return []
  const d = data as { results?: ProStockSearchRow[]; items?: ProStockSearchRow[] }
  if (Array.isArray(d.results)) return d.results
  if (Array.isArray(d.items)) return d.items
  return []
}

/**
 * @param {string} query
 */
export async function fetchStockSearch(query: string): Promise<ProStockSearchRow[]> {
  const trimmed = query.trim()
  if (!trimmed) return []
  const r = await authFetch(apiUrl(`/api/stocks-search?q=${encodeURIComponent(trimmed)}`))
  if (!r.ok) return []
  const data = await r.json()
  return parseStockSearchRows(data)
}

/**
 * @param {ProStockSearchRow[]} rows
 * @param {string} query
 */
export function pickStockSearchTarget(
  rows: ProStockSearchRow[],
  query: string,
): ProStockSearchRow | null {
  if (rows.length === 1) return rows[0]
  const trimmed = query.trim()
  const code6 = trimmed.replace(/\D/g, '').padStart(6, '0').slice(-6)
  if (/^\d{6}$/.test(trimmed.replace(/\s/g, ''))) {
    const hit = rows.find((r) => r.code === code6)
    if (hit) return hit
    if (rows.length === 0) {
      return { code: code6, name: code6 }
    }
  }
  return null
}
