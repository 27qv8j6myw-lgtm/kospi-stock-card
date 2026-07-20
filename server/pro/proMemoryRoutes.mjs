import { requireProUser } from '../lib/proAccess.mjs'
import { addMemory, deleteMemory, fetchUserMemories } from '../lib/proUserMemory.mjs'

/**
 * Pro 채팅 메모리(매매 원칙) 관리 라우트.
 * @param {import('express').Application} app
 * @param {{ getSupabaseService: () => import('@supabase/supabase-js').SupabaseClient | null, getUserIdFromRequest: (req: import('express').Request) => Promise<string | null> }} deps
 */
export function registerProMemoryRoutes(app, { getSupabaseService, getUserIdFromRequest }) {
  async function handleGet(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }
    const userId = await requireProUser(req, res, supabaseService, getUserIdFromRequest)
    if (!userId) return

    const items = await fetchUserMemories(supabaseService, userId, 50)
    res.json({ items })
  }

  async function handlePost(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }
    const userId = await requireProUser(req, res, supabaseService, getUserIdFromRequest)
    if (!userId) return

    const content = String(req.body?.content ?? '').trim()
    if (!content) {
      res.status(400).json({ error: 'content 필요' })
      return
    }
    try {
      const item = await addMemory(supabaseService, userId, content)
      res.json({ ok: true, item })
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) })
    }
  }

  async function handleDelete(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }
    const userId = await requireProUser(req, res, supabaseService, getUserIdFromRequest)
    if (!userId) return

    const id = String(req.query?.id ?? req.body?.id ?? '').trim()
    if (!id) {
      res.status(400).json({ error: 'id 필요' })
      return
    }
    try {
      await deleteMemory(supabaseService, userId, id)
      res.json({ ok: true })
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) })
    }
  }

  app.get('/api/pro-memory', handleGet)
  app.post('/api/pro-memory', handlePost)
  app.delete('/api/pro-memory', handleDelete)
}
