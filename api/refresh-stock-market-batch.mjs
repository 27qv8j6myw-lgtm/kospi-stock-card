import { ensureJsonResponse } from '../server/lib/ensureJsonResponse.mjs'
import { handleRefreshStockMarketBatch } from '../server/pro/refreshStockMarketBatchHandler.mjs'

export default async function handler(req, res) {
  ensureJsonResponse(res)
  return handleRefreshStockMarketBatch(req, res)
}
