import { ensureJsonResponse } from '../server/lib/ensureJsonResponse.mjs'
import { handleAdminSyncStocksBatch } from '../server/pro/adminSyncStocksHandlers.mjs'

export default async function handler(req, res) {
  ensureJsonResponse(res)
  return handleAdminSyncStocksBatch(req, res)
}
