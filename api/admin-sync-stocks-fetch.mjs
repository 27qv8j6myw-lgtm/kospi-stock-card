import { ensureJsonResponse } from '../server/lib/ensureJsonResponse.mjs'
import { handleAdminSyncStocksFetch } from '../server/pro/adminSyncStocksHandlers.mjs'

export default async function handler(req, res) {
  ensureJsonResponse(res)
  return handleAdminSyncStocksFetch(req, res)
}
