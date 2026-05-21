import { createUserSupabaseFromRequest, getUserIdFromRequest } from '../lib/auth.mjs'
import { loadStocksJsonFile } from '../lib/loadStocksJsonFile.mjs'
import { upsertStocksMasterChunk } from '../lib/syncStocksMasterFromDart.mjs'

/**
 * @param {import('http').IncomingMessage} req
 */
async function requireAdmin(req, res) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) {
    res.status(401).json({ error: '인증 필요' })
    return false
  }

  const userSupabase = createUserSupabaseFromRequest(req)
  if (!userSupabase) {
    res.status(401).json({ error: '토큰 없음' })
    return false
  }

  const { data: isAdmin, error } = await userSupabase.rpc('is_admin')
  if (error || !isAdmin) {
    res.status(403).json({ error: '관리자 권한 필요' })
    return false
  }

  return true
}

/**
 * @param {import('http').IncomingMessage} req
 */
function parseJsonBody(req) {
  const b = req.body
  if (b == null) return {}
  if (typeof b === 'object') return b
  if (typeof b === 'string' && b.trim()) {
    try {
      return JSON.parse(b)
    } catch {
      return {}
    }
  }
  return {}
}

/**
 * 사전 빌드 JSON(public/data/stocks.json) 로드 — DART 다운로드 없음
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export async function handleAdminSyncStocksFetch(req, res) {
  if (req.method && req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' })
    return
  }

  if (!(await requireAdmin(req, res))) return

  try {
    const data = await loadStocksJsonFile()
    console.log(
      `[Sync-Fetch] 정적 파일: ${data.total}개 (업데이트: ${data.updatedAt ?? '—'})`,
    )

    res.json({
      ok: true,
      total: data.total,
      stocks: data.stocks,
      updatedAt: data.updatedAt,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[Sync-Fetch] 실패:', message)
    res.status(500).json({
      error:
        message.includes('없음') || message.includes('ENOENT')
          ? '종목 파일 없음. 로컬에서 npm run fetch-stocks 실행 후 배포 필요'
          : message,
    })
  }
}

/**
 * stocks_master 청크 upsert (최대 500건)
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export async function handleAdminSyncStocksBatch(req, res) {
  if (req.method && req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' })
    return
  }

  if (!(await requireAdmin(req, res))) return

  const body = parseJsonBody(req)
  const stocks = body.stocks

  if (!Array.isArray(stocks) || stocks.length === 0) {
    res.status(400).json({ error: 'stocks 배열 필요' })
    return
  }
  if (stocks.length > 500) {
    res.status(400).json({ error: '한 번에 500개 이하' })
    return
  }

  try {
    const out = await upsertStocksMasterChunk(stocks)
    if (!out.ok) {
      res.status(500).json({ error: out.error })
      return
    }
    res.json({ ok: true, inserted: out.inserted })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[Sync-Batch 실패]', message)
    res.status(500).json({ error: message })
  }
}
