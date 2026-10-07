import { ensureJsonResponse } from '../server/lib/ensureJsonResponse.mjs'
import { handleCronInvestorFlow } from '../server/cron/investorFlow.mjs'

export default async function handler(req, res) {
  ensureJsonResponse(res)
  return handleCronInvestorFlow(req, res)
}
