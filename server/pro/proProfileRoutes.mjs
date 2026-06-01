import { requireProUser } from '../lib/proAccess.mjs'
import {
  fetchProUserProfile,
  parseProfilePatch,
  saveProUserProfile,
} from '../lib/proUserProfile.mjs'

/**
 * @param {import('express').Application} app
 * @param {{ getSupabaseService: () => import('@supabase/supabase-js').SupabaseClient | null, getUserIdFromRequest: (req: import('express').Request) => Promise<string | null> }} deps
 */
export function registerProProfileRoutes(app, { getSupabaseService, getUserIdFromRequest }) {
  async function handleGetProProfile(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }

    const userId = await requireProUser(req, res, supabaseService, getUserIdFromRequest)
    if (!userId) return

    try {
      const profile = await fetchProUserProfile(supabaseService, userId)
      res.json(profile)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      res.status(500).json({ error: message })
    }
  }

  async function handlePatchProProfile(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }

    const userId = await requireProUser(req, res, supabaseService, getUserIdFromRequest)
    if (!userId) return

    try {
      const patch = parseProfilePatch(req.body && typeof req.body === 'object' ? req.body : {})
      const profile = await saveProUserProfile(supabaseService, userId, patch)
      res.json(profile)
    } catch (e) {
      const status = e && typeof e === 'object' && 'status' in e ? Number(e.status) : 500
      const message = e instanceof Error ? e.message : String(e)
      res.status(status >= 400 && status < 600 ? status : 500).json({ error: message })
    }
  }

  app.get('/api/pro-profile', handleGetProProfile)
  app.patch('/api/pro-profile', handlePatchProProfile)
}
