/**
 * Vercel Cron — Pro 그룹 일별 스냅샷
 */
import { getSupabaseService } from '../lib/supabaseService.mjs'
import { runProGroupSnapshots, verifyCronSecret } from '../lib/snapshotProGroups.mjs'

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export async function handleCronSnapshot(req, res) {
  if (req.method && req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'GET or POST only' })
    return
  }

  if (!verifyCronSecret(req)) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }

  const supabaseService = getSupabaseService()
  if (!supabaseService) {
    res.status(503).json({ error: 'Supabase 미설정' })
    return
  }

  try {
    const payload = await runProGroupSnapshots(supabaseService)
    res.json(payload)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[cron-snapshot]', message)
    res.status(500).json({ error: message })
  }
}
