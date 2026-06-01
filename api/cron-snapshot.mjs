import { ensureJsonResponse } from '../server/lib/ensureJsonResponse.mjs'
import { handleCronSnapshot } from '../server/cron/snapshotGroups.mjs'

export default async function handler(req, res) {
  ensureJsonResponse(res)
  return handleCronSnapshot(req, res)
}
