import { ensureJsonResponse } from '../server/lib/ensureJsonResponse.mjs'
import { handleCronDailyBrief } from '../server/cron/dailyBrief.mjs'

export default async function handler(req, res) {
  ensureJsonResponse(res)
  return handleCronDailyBrief(req, res)
}
