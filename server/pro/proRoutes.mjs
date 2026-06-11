import { mapAnthropicErrorForClient } from '../lib/anthropicRetry.mjs'
import { runProChat } from '../ai/proChat.mjs'
import { logActivity } from '../lib/activityLogger.mjs'
import { generateConversationTitle } from '../ai/proChatPrompt.mjs'
import { runProChatStream } from '../ai/proChatStream.mjs'
import { requireProUser } from '../lib/proAccess.mjs'
import { fetchProTopFlow } from '../lib/proTopFlow.mjs'
import { registerAdminProRoutes } from './adminProRoutes.mjs'
import { registerProHoldingsRoutes } from './proHoldingsRoutes.mjs'
import { registerProTradesRoutes } from './proTradesRoutes.mjs'
import { registerProProfileRoutes } from './proProfileRoutes.mjs'
import { registerProStockRoutes } from './proStockRoutes.mjs'
import { registerProTrendsRoute } from './proTrends.mjs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * @param {import('express').Request} req
 * @returns {string}
 */
function conversationIdFromRequest(req) {
  const fromQuery = String(req.query?.conversationId ?? req.query?.id ?? '').trim()
  if (fromQuery) return fromQuery
  return String(req.params?.id ?? '').trim()
}

/**
 * @param {import('express').Application} app
 * @param {{ getSupabaseService: () => import('@supabase/supabase-js').SupabaseClient | null, getUserIdFromRequest: (req: import('express').Request) => Promise<string | null> }} deps
 */
export function registerProRoutes(app, { getSupabaseService, getUserIdFromRequest }) {
  async function handleListConversations(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }

    const userId = await requireProUser(req, res, supabaseService, getUserIdFromRequest)
    if (!userId) return

    const { data, error } = await supabaseService
      .from('pro_conversations')
      .select('id, title, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(50)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.json({ conversations: data || [] })
  }

  async function handleCreateConversation(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }

    const userId = await requireProUser(req, res, supabaseService, getUserIdFromRequest)
    if (!userId) return

    const { data, error } = await supabaseService
      .from('pro_conversations')
      .insert({ user_id: userId, title: '새 대화' })
      .select()
      .single()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.json({ conversation: data })
  }

  async function handleListMessages(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }

    const userId = await requireProUser(req, res, supabaseService, getUserIdFromRequest)
    if (!userId) return

    const id = conversationIdFromRequest(req)
    if (!UUID_RE.test(id)) {
      res.status(400).json({ error: 'conversationId 필요' })
      return
    }

    const { data: conv, error: convErr } = await supabaseService
      .from('pro_conversations')
      .select('user_id')
      .eq('id', id)
      .single()

    if (convErr || !conv) {
      res.status(404).json({ error: '대화를 찾을 수 없습니다' })
      return
    }
    if (conv.user_id !== userId) {
      res.status(403).json({ error: '권한 없음' })
      return
    }

    const { data, error } = await supabaseService
      .from('pro_messages')
      .select('id, role, content, tool_calls, created_at')
      .eq('conversation_id', id)
      .order('created_at')

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.json({ messages: data || [] })
  }

  async function handleDeleteConversation(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }

    const userId = await requireProUser(req, res, supabaseService, getUserIdFromRequest)
    if (!userId) return

    const id = conversationIdFromRequest(req)
    if (!UUID_RE.test(id)) {
      res.status(400).json({ error: 'id 필요' })
      return
    }

    const { error } = await supabaseService
      .from('pro_conversations')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.json({ ok: true })
  }

  async function handleProChat(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }

    const userId = await requireProUser(req, res, supabaseService, getUserIdFromRequest)
    if (!userId) return

    const conversationId = String(req.body?.conversationId ?? '').trim()
    const message = String(req.body?.message ?? '').trim()

    if (!conversationId || !UUID_RE.test(conversationId)) {
      res.status(400).json({ error: 'conversationId 필요' })
      return
    }
    if (!message) {
      res.status(400).json({ error: 'message 필요' })
      return
    }
    if (message.length > 12_000) {
      res.status(400).json({ error: '메시지가 너무 깁니다' })
      return
    }

    try {
      const { data: conv, error: convErr } = await supabaseService
        .from('pro_conversations')
        .select('id, title, user_id')
        .eq('id', conversationId)
        .single()

      if (convErr || !conv) {
        res.status(404).json({ error: '대화를 찾을 수 없습니다' })
        return
      }
      if (conv.user_id !== userId) {
        res.status(403).json({ error: '권한 없음' })
        return
      }

      const { error: insertUserErr } = await supabaseService.from('pro_messages').insert({
        conversation_id: conversationId,
        role: 'user',
        content: message,
      })

      if (insertUserErr) {
        res.status(500).json({ error: insertUserErr.message })
        return
      }

      const { data: history, error: histErr } = await supabaseService
        .from('pro_messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at')

      if (histErr) {
        res.status(500).json({ error: histErr.message })
        return
      }

      const conversationMessages = (history || []).map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content ?? ''),
      }))

      const { text: finalText, toolCalls: allToolCalls } = await runProChat(
        conversationMessages,
        userId,
        supabaseService,
      )

      const { error: insertAiErr } = await supabaseService.from('pro_messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: finalText,
        tool_calls: allToolCalls.length > 0 ? allToolCalls : null,
      })

      if (insertAiErr) {
        res.status(500).json({ error: insertAiErr.message })
        return
      }

      let newTitle = conv.title
      if (conv.title === '새 대화') {
        newTitle = await generateConversationTitle(message)
      }

      const now = new Date().toISOString()
      const updatePayload = { updated_at: now }
      if (newTitle !== conv.title) {
        updatePayload.title = newTitle
      }

      await supabaseService.from('pro_conversations').update(updatePayload).eq('id', conversationId)

      void logActivity(userId, 'chat', { conversationId }, true)

      res.json({
        text: finalText,
        toolCalls: allToolCalls,
        title: newTitle,
      })
    } catch (e) {
      const errMsg = mapAnthropicErrorForClient(e)
      console.error('[Pro Chat]', e)
      if (/ANTHROPIC_API_KEY|API_KEY/i.test(errMsg)) {
        res.status(503).json({ error: errMsg })
        return
      }
      if (/시간 초과|timeout/i.test(errMsg)) {
        res.status(504).json({ error: errMsg })
        return
      }
      if (/혼잡/.test(errMsg)) {
        res.status(503).json({ error: errMsg })
        return
      }
      res.status(500).json({ error: errMsg })
    }
  }

  async function handleProChatStream(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }

    const userId = await requireProUser(req, res, supabaseService, getUserIdFromRequest)
    if (!userId) return

    const conversationId = String(req.body?.conversationId ?? '').trim()
    const message = String(req.body?.message ?? '').trim()
    const isRetry = req.body?.isRetry === true

    if (!conversationId || !UUID_RE.test(conversationId)) {
      res.status(400).json({ error: 'conversationId 필요' })
      return
    }
    if (!message) {
      res.status(400).json({ error: 'message 필요' })
      return
    }
    if (message.length > 12_000) {
      res.status(400).json({ error: '메시지가 너무 깁니다' })
      return
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders()
    }

    /** @type {import('../ai/proChatStream.mjs').ProStreamSend} */
    const send = (event, data) => {
      res.write(`event: ${event}\n`)
      res.write(`data: ${JSON.stringify(data)}\n\n`)
      if (typeof res.flush === 'function') {
        res.flush()
      }
    }

    try {
      await runProChatStream({
        supabaseService,
        conversationId,
        message,
        userId,
        send,
        isRetry,
      })
      res.end()
    } catch (e) {
      const errMsg = mapAnthropicErrorForClient(e)
      console.error('[Pro Stream]', e)
      send('error', { message: errMsg })
      res.end()
    }
  }

  /** Vercel 단일 세그먼트 API (hyphen) — 프로덕션 기본 */
  app.get('/api/pro-conversations', handleListConversations)
  app.post('/api/pro-conversations', handleCreateConversation)
  app.get('/api/pro-messages', handleListMessages)
  app.delete('/api/pro-conversation', handleDeleteConversation)
  app.post('/api/pro-chat', handleProChat)
  app.post('/api/pro-chat-stream', handleProChatStream)

  /** 로컬·레거시 slash 별칭 */
  app.get('/api/pro/conversations', handleListConversations)
  app.post('/api/pro/conversations', handleCreateConversation)
  app.get('/api/pro/conversations/:id/messages', handleListMessages)
  app.delete('/api/pro/conversations/:id', handleDeleteConversation)
  app.post('/api/pro/chat', handleProChat)
  app.post('/api/pro/chat-stream', handleProChatStream)

  async function handleProTopFlow(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }

    const userId = await requireProUser(req, res, supabaseService, getUserIdFromRequest)
    if (!userId) return

    try {
      const payload = await fetchProTopFlow(supabaseService, {
        investor: req.query?.investor,
        type: req.query?.type,
      })
      res.json(payload)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Top Flow]', message)
      res.status(500).json({ error: message })
    }
  }

  app.get('/api/pro-top-flow', handleProTopFlow)

  registerProTrendsRoute(app, { getSupabaseService, getUserIdFromRequest, requireProUser })

  registerProHoldingsRoutes(app, { getSupabaseService, getUserIdFromRequest })
  registerProTradesRoutes(app, { getSupabaseService, getUserIdFromRequest })
  registerProProfileRoutes(app, { getSupabaseService, getUserIdFromRequest })
  registerProStockRoutes(app, { getSupabaseService, getUserIdFromRequest })
  registerAdminProRoutes(app, { getSupabaseService, getUserIdFromRequest })
}
