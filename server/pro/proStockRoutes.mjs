import { runHoldingOpusDiagnosis } from '../ai/proHoldingOpus.mjs'
import { mapAnthropicErrorForClient } from '../lib/anthropicRetry.mjs'
import { logActivity } from '../lib/activityLogger.mjs'
import { summarizeProNewsHeadlines } from '../ai/proNewsSummary.mjs'
import { runProStockAnalysisStream } from '../ai/proStockAnalysis.mjs'
import { requireProUser } from '../lib/proAccess.mjs'
import { fetchProChartBars } from '../lib/proStockChart.mjs'
import { resolveStockName } from '../lib/resolveStockName.mjs'
import {
  isValidStockDisplayName,
  pickStockDisplayName,
  registerStockMaster,
} from '../lib/stockMasterKisLookup.mjs'
import { calculateBollinger, calculateMACD, calculateRSI } from '../lib/technicalIndicators.mjs'
import { executeTool, getKisQuote } from '../lib/toolExecutor.mjs'
import { getProStockSummaryExtras } from '../lib/proStockSummaryExtras.mjs'
import { isValidStockCode, normalizeKisIscd } from '../lib/stockCode.mjs'

/**
 * @param {unknown} raw
 */
function parseRouteStockCode(raw) {
  const code = normalizeKisIscd(raw)
  if (!isValidStockCode(code) || code === '000000') return null
  return code
}

/**
 * @param {string} code6
 */
async function calcAvgVolume20d(code6) {
  try {
    const bars = await fetchProChartBars(code6, 20)
    const volumes = bars.map((b) => Number(b.volume) || 0).filter((v) => v > 0)
    if (!volumes.length) return null
    return Math.floor(volumes.reduce((s, v) => s + v, 0) / volumes.length)
  } catch {
    return null
  }
}

/**
 * @param {unknown} result
 */
function toolData(result) {
  if (result == null || typeof result !== 'object') return null
  if ('error' in result && result.error) return null
  return result
}

/**
 * @param {import('express').Application} app
 * @param {{ getSupabaseService: () => import('@supabase/supabase-js').SupabaseClient | null, getUserIdFromRequest: (req: import('express').Request) => Promise<string | null> }} deps
 */
export function registerProStockRoutes(app, { getSupabaseService, getUserIdFromRequest }) {
  async function handleProStockSummary(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }

    const userId = await requireProUser(req, res, supabaseService, getUserIdFromRequest)
    if (!userId) return

    const code = parseRouteStockCode(req.query?.code)
    if (!code) {
      res.status(400).json({ error: 'code 필요' })
      return
    }

    try {
      const { data: master } = await supabaseService
        .from('stocks_master')
        .select('code, name, market, sector')
        .eq('code', code)
        .maybeSingle()

      const [quoteRaw, week52Raw, investorRaw, valuationRaw, disclosuresRaw, analystRaw] =
        await Promise.all([
          executeTool('getStockQuote', { code }, userId).catch(() => null),
          executeTool('get52Week', { code }, userId).catch(() => null),
          executeTool('getInvestorTrend', { code, days: 5 }, userId).catch(() => null),
          executeTool('getValuation', { code }, userId).catch(() => null),
          executeTool('getDisclosures', { code, days: 30 }, userId).catch(() => ({ disclosures: [] })),
          executeTool('getAnalystReports', { code }, userId).catch(() => ({ available: false })),
        ])

      const quote = toolData(quoteRaw)

      let stockName = pickStockDisplayName(code, master?.name, quote?.name)
      if (
        !isValidStockDisplayName(master?.name, code) &&
        isValidStockDisplayName(quote?.name, code)
      ) {
        void registerStockMaster(
          {
            code,
            name: String(quote.name).trim(),
            market: quote.market || master?.market || 'KOSPI',
            sector: master?.sector || quote.sector || '—',
          },
          'Auto-register',
        )
      }
      if (!isValidStockDisplayName(stockName, code) || stockName === code) {
        stockName = await resolveStockName(code)
      }
      stockName = pickStockDisplayName(code, stockName, master?.name, quote?.name)
      const week52 = toolData(week52Raw)
      const investor = toolData(investorRaw)
      const valuation = toolData(valuationRaw)
      const disclosures = toolData(disclosuresRaw)
      const analyst = toolData(analystRaw)

      const newsRaw = await executeTool(
        'searchNews',
        { query: stockName, limit: 10 },
        userId,
      ).catch(() => ({ news: [] }))
      const newsResult = toolData(newsRaw)
      const newsList = newsResult?.news ?? []

      let newsSummary = null
      if (newsList.length >= 3) {
        newsSummary = await summarizeProNewsHeadlines(stockName, newsList, {
          userId,
          code,
        })
      }

      const avgVolume20d = await calcAvgVolume20d(code)

      const enrichedQuote = quote
        ? {
            ...quote,
            name: stockName,
            openPrice: quote.openPrice ?? null,
            dayHigh: quote.dayHigh ?? null,
            dayLow: quote.dayLow ?? null,
            tradingAmount: quote.tradingAmount ?? quote.tradingValue ?? null,
            avgVolume20d,
          }
        : {
            code,
            name: stockName,
            currentPrice: null,
            changePct: null,
            avgVolume20d,
          }

      const extras = await getProStockSummaryExtras(code, enrichedQuote)

      void logActivity(userId, 'view_stock', { code, name: stockName, source: 'card' }, true)

      res.json({
        code,
        name: stockName,
        quote: enrichedQuote,
        week52,
        investor,
        valuation,
        news: newsList,
        newsSummary,
        disclosures: disclosures?.disclosures ?? [],
        analyst,
        earnings: extras.earnings,
        timestamp: new Date().toISOString(),
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Pro Stock Summary]', e)
      res.status(500).json({ error: message })
    }
  }

  async function handleProStockAnalysis(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }

    const userId = await requireProUser(req, res, supabaseService, getUserIdFromRequest)
    if (!userId) return

    const code = parseRouteStockCode(req.body?.code)
    const summary = req.body?.summary
    if (!code) {
      res.status(400).json({ error: 'code 필요' })
      return
    }
    if (!summary || typeof summary !== 'object') {
      res.status(400).json({ error: 'summary 필요' })
      return
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    /** @type {(event: string, data: unknown) => void} */
    const send = (event, data) => {
      res.write(`event: ${event}\n`)
      res.write(`data: ${JSON.stringify(data)}\n\n`)
    }

    try {
      await runProStockAnalysisStream({ summary, code, userId, send })
      res.end()
    } catch (e) {
      const message = mapAnthropicErrorForClient(e)
      console.error('[Pro Stock Analysis]', e)
      send('error', { message })
      res.end()
    }
  }

  async function handleProStockChart(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }

    const userId = await requireProUser(req, res, supabaseService, getUserIdFromRequest)
    if (!userId) return

    const code = parseRouteStockCode(req.query?.code)
    const period = String(req.query?.period ?? '1M').toUpperCase()
    const daysMap = { '1W': 7, '1M': 30, '3M': 90, '1Y': 252 }
    const days = daysMap[period] || 30

    if (!code) {
      res.status(400).json({ error: 'code 필요' })
      return
    }

    try {
      const data = await fetchProChartBars(code, days)
      res.json({ code, period, data })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Pro Stock Chart]', e)
      res.status(500).json({ error: message })
    }
  }

  async function handleProStockTechnical(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }

    const userId = await requireProUser(req, res, supabaseService, getUserIdFromRequest)
    if (!userId) return

    const code = parseRouteStockCode(req.query?.code)
    if (!code) {
      res.status(400).json({ error: 'code 필요' })
      return
    }

    try {
      const bars = await fetchProChartBars(code, 60)
      const prices = bars.map((c) => c.close).filter((p) => p > 0)
      res.json({
        rsi: calculateRSI(prices),
        macd: calculateMACD(prices),
        bollinger: calculateBollinger(prices),
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Pro Stock Technical]', e)
      res.status(500).json({ error: message })
    }
  }

  async function handleGetWatchlist(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }

    const userId = await requireProUser(req, res, supabaseService, getUserIdFromRequest)
    if (!userId) return

    const { data, error } = await supabaseService
      .from('pro_watchlist')
      .select('code, added_at, note')
      .eq('user_id', userId)
      .order('added_at', { ascending: false })

    if (error) {
      res.status(500).json({ error: error.message, watchlist: [] })
      return
    }

    res.json({ watchlist: data || [] })
  }

  async function handlePostWatchlist(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }

    const userId = await requireProUser(req, res, supabaseService, getUserIdFromRequest)
    if (!userId) return

    const code = parseRouteStockCode(req.body?.code)
    if (!code) {
      res.status(400).json({ error: 'code 필요' })
      return
    }

    const { data, error } = await supabaseService
      .from('pro_watchlist')
      .upsert({ user_id: userId, code, note: req.body?.note ?? null }, { onConflict: 'user_id,code' })
      .select()
      .single()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.json({ item: data })
  }

  async function handleDeleteWatchlist(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }

    const userId = await requireProUser(req, res, supabaseService, getUserIdFromRequest)
    if (!userId) return

    const code = parseRouteStockCode(req.query?.code)
    if (!code) {
      res.status(400).json({ error: 'code 필요' })
      return
    }

    const { error } = await supabaseService
      .from('pro_watchlist')
      .delete()
      .eq('user_id', userId)
      .eq('code', code)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.json({ ok: true })
  }

  async function handleProWatchlistEnriched(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }

    const userId = await requireProUser(req, res, supabaseService, getUserIdFromRequest)
    if (!userId) return

    const { data: items, error } = await supabaseService
      .from('pro_watchlist')
      .select('code, added_at, note')
      .eq('user_id', userId)
      .order('added_at', { ascending: false })

    if (error) {
      res.status(500).json({ error: error.message, watchlist: [] })
      return
    }

    if (!items?.length) {
      res.json({ watchlist: [] })
      return
    }

    try {
      const enriched = await Promise.all(
        items.map(async (item) => {
          const code = parseRouteStockCode(item.code) || String(item.code)
          const [quoteRaw, name] = await Promise.all([
            executeTool('getStockQuote', { code }, userId).catch(() => null),
            resolveStockName(code).catch(() => code),
          ])
          const quote = quoteRaw && typeof quoteRaw === 'object' && !('error' in quoteRaw) ? quoteRaw : null
          return {
            code,
            name: name || code,
            currentPrice: quote?.currentPrice ?? null,
            changePct: quote?.changePct ?? null,
            added_at: item.added_at,
            note: item.note,
          }
        }),
      )

      res.json({ watchlist: enriched })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Pro Watchlist Enriched]', e)
      res.status(500).json({ error: message, watchlist: [] })
    }
  }

  async function handleProHoldingOpus(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }

    const userId = await requireProUser(req, res, supabaseService, getUserIdFromRequest)
    if (!userId) return

    const holdingId = String(req.body?.holdingId ?? '').trim()
    if (!holdingId) {
      res.status(400).json({ error: 'holdingId 필요' })
      return
    }

    try {
      const payload = await runHoldingOpusDiagnosis(req, userId, holdingId)
      void logActivity(
        userId,
        'diagnosis',
        { type: 'holding', holdingId, code: payload.code },
        true,
      )
      res.json(payload)
    } catch (e) {
      const status = e && typeof e === 'object' && 'status' in e ? Number(e.status) : 500
      const message = mapAnthropicErrorForClient(e)
      console.error('[Holding OPUS]', e)
      if (/혼잡/.test(message)) {
        res.status(503).json({ error: message })
        return
      }
      res.status(status >= 400 && status < 600 ? status : 500).json({ error: message })
    }
  }

  app.post('/api/pro-holding-opus', handleProHoldingOpus)

  async function handleProStockQuote(req, res) {
    const supabaseService = getSupabaseService()
    if (!supabaseService) {
      res.status(503).json({ error: 'Supabase 미설정' })
      return
    }

    const userId = await requireProUser(req, res, supabaseService, getUserIdFromRequest)
    if (!userId) return

    const code = parseRouteStockCode(req.query?.code)
    if (!code) {
      res.status(400).json({ error: 'code 필요' })
      return
    }

    try {
      const q = await getKisQuote(code)
      res.json({
        quote: {
          currentPrice: q.currentPrice,
          change: q.change,
          changePct: q.changePct,
          openPrice: q.openPrice,
          dayHigh: q.dayHigh,
          dayLow: q.dayLow,
          volume: q.volume,
          tradingAmount: q.tradingAmount,
        },
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Pro Stock Quote]', message)
      res.status(500).json({ error: message })
    }
  }

  app.get('/api/pro-stock-quote', handleProStockQuote)
  app.get('/api/pro-stock-summary', handleProStockSummary)
  app.post('/api/pro-stock-analysis', handleProStockAnalysis)
  app.get('/api/pro-stock-chart', handleProStockChart)
  app.get('/api/pro-stock-technical', handleProStockTechnical)
  app.get('/api/pro-watchlist', handleGetWatchlist)
  app.post('/api/pro-watchlist', handlePostWatchlist)
  app.delete('/api/pro-watchlist', handleDeleteWatchlist)
  app.get('/api/pro-watchlist-enriched', handleProWatchlistEnriched)

  app.get('/api/pro/stock-quote', handleProStockQuote)
  app.get('/api/pro/stock-summary', handleProStockSummary)
  app.post('/api/pro/stock-analysis', handleProStockAnalysis)
  app.get('/api/pro/stock-chart', handleProStockChart)
  app.get('/api/pro/stock-technical', handleProStockTechnical)
}
