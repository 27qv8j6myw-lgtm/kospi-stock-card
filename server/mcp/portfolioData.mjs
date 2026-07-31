/**
 * MCP 커넥터가 노출하는 읽기 전용 데이터 조회.
 *
 * service_role 키로 RLS 를 우회하므로 모든 쿼리는 호출자가 넘긴 userId 로만 필터한다.
 * userId 는 요청 본문이 아니라 `MCP_USER_ID` 환경변수에서만 온다 (api/mcp.mjs 참고).
 */
import { seoulSnapshotDateKey } from '../lib/snapshotProGroups.mjs'
import { isValidStockCode, normalizeKisIscd } from '../lib/stockCode.mjs'
import { getSupabaseService } from '../lib/supabaseService.mjs'
import { getKisDisplayQuote } from '../lib/toolExecutor.mjs'

/** 응답 토큰 상한 — 커스텀 커넥터 응답 크기 제한을 넘기지 않도록 */
const MAX_HOLDINGS = 50
const MAX_SNAPSHOT_ROWS = 180
const MAX_TRADES = 100

/** 현재가 동시 조회 수 — KIS 레이트 리밋 회피 */
const QUOTE_CONCURRENCY = 4

/** @param {number} n */
function won(n) {
  return Math.round(Number(n) || 0)
}

/** @param {number | null | undefined} n */
function pct(n) {
  if (n == null || !Number.isFinite(Number(n))) return null
  return Math.round(Number(n) * 100) / 100
}

/** null·빈 값 필드를 제거해 응답을 짧게 유지 */
function compact(obj) {
  /** @type {Record<string, unknown>} */
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v == null || v === '') continue
    out[k] = v
  }
  return out
}

function requireSupabase() {
  const supabase = getSupabaseService()
  if (!supabase) {
    throw new Error('Supabase 서비스 키가 설정되지 않았습니다')
  }
  return supabase
}

/**
 * 종목 코드별 현재가 — 중복 코드는 1회만 조회하고 소량씩 병렬 처리.
 * @param {string[]} codes
 * @returns {Promise<Map<string, number>>}
 */
async function fetchPrices(codes) {
  const unique = [...new Set(codes)]
  /** @type {Map<string, number>} */
  const prices = new Map()

  for (let i = 0; i < unique.length; i += QUOTE_CONCURRENCY) {
    const chunk = unique.slice(i, i + QUOTE_CONCURRENCY)
    const results = await Promise.all(
      chunk.map(async (code) => {
        try {
          const quote = await getKisDisplayQuote(code)
          return [code, Number(quote?.currentPrice) || 0]
        } catch {
          return [code, 0]
        }
      }),
    )
    for (const [code, price] of results) {
      prices.set(String(code), Number(price) || 0)
    }
  }

  return prices
}

/**
 * 보유 종목 + 그룹 현금까지 반영한 현재 포트폴리오.
 * 수익률은 종목별 단순평균이 아니라 (평가액 − 매입액) / 매입액 으로 계산한다
 * (server/lib/snapshotProGroups.mjs 의 자산현황 산식과 동일).
 *
 * @param {string} userId
 */
export async function getPortfolio(userId) {
  const supabase = requireSupabase()

  const [holdingsRes, groupsRes] = await Promise.all([
    supabase
      .from('pro_holdings')
      .select('code, name, quantity, avg_price, group_id, created_at')
      .eq('user_id', userId),
    supabase
      .from('pro_groups')
      .select('id, name, cash_balance, initial_capital, realized_profit')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true }),
  ])

  if (holdingsRes.error) throw new Error(holdingsRes.error.message)
  if (groupsRes.error) throw new Error(groupsRes.error.message)

  const groups = groupsRes.data ?? []
  /** @type {Map<string, { name: string, cash: number, initialCapital: number, realizedProfit: number }>} */
  const groupById = new Map()
  for (const g of groups) {
    groupById.set(String(g.id), {
      name: String(g.name ?? '').trim() || '미지정',
      cash: Number(g.cash_balance) || 0,
      initialCapital: Number(g.initial_capital) || 0,
      realizedProfit: Number(g.realized_profit) || 0,
    })
  }

  const rows = (holdingsRes.data ?? [])
    .map((h) => {
      const code = normalizeKisIscd(h.code)
      return {
        code,
        name: String(h.name ?? '').trim() || code,
        quantity: Number(h.quantity) || 0,
        avgPrice: Number(h.avg_price) || 0,
        groupId: h.group_id ? String(h.group_id) : '',
      }
    })
    .filter((h) => isValidStockCode(h.code) && h.quantity > 0)

  const prices = await fetchPrices(rows.map((h) => h.code))

  /** @type {Map<string, { stockValue: number, cost: number }>} */
  const groupTotals = new Map()
  let stockValue = 0
  let totalCost = 0

  const holdings = rows.map((h) => {
    const currentPrice = prices.get(h.code) || 0
    const value = currentPrice > 0 ? currentPrice * h.quantity : h.avgPrice * h.quantity
    const cost = h.avgPrice * h.quantity
    stockValue += value
    totalCost += cost

    const acc = groupTotals.get(h.groupId) ?? { stockValue: 0, cost: 0 }
    acc.stockValue += value
    acc.cost += cost
    groupTotals.set(h.groupId, acc)

    return {
      ...h,
      currentPrice,
      value,
      profit: value - cost,
      profitPct: cost > 0 ? ((value - cost) / cost) * 100 : null,
    }
  })

  const cash = groups.reduce((s, g) => s + (Number(g.cash_balance) || 0), 0)
  const realizedProfit = groups.reduce((s, g) => s + (Number(g.realized_profit) || 0), 0)
  const totalValue = stockValue + cash

  holdings.sort((a, b) => b.value - a.value)
  const truncated = holdings.length > MAX_HOLDINGS

  return {
    asOf: seoulSnapshotDateKey(),
    currency: 'KRW',
    priceBasis: 'KRX+NXT 통합 현재가 (NXT 시간외 체결 포함). 일별 스냅샷은 KRX 정규장 종가 기준',
    totals: compact({
      stockValue: won(stockValue),
      cash: won(cash),
      totalValue: won(totalValue),
      totalCost: won(totalCost),
      unrealizedProfit: won(stockValue - totalCost),
      returnPct: totalCost > 0 ? pct(((stockValue - totalCost) / totalCost) * 100) : null,
      realizedProfit: won(realizedProfit),
      holdingCount: holdings.length,
    }),
    groups: groups.map((g) => {
      const acc = groupTotals.get(String(g.id)) ?? { stockValue: 0, cost: 0 }
      return compact({
        name: groupById.get(String(g.id))?.name,
        stockValue: won(acc.stockValue),
        cash: won(Number(g.cash_balance) || 0),
        initialCapital: won(Number(g.initial_capital) || 0),
        realizedProfit: won(Number(g.realized_profit) || 0),
        returnPct: acc.cost > 0 ? pct(((acc.stockValue - acc.cost) / acc.cost) * 100) : null,
      })
    }),
    holdings: holdings.slice(0, MAX_HOLDINGS).map((h) =>
      compact({
        code: h.code,
        name: h.name,
        group: groupById.get(h.groupId)?.name,
        quantity: h.quantity,
        avgPrice: won(h.avgPrice),
        currentPrice: h.currentPrice > 0 ? won(h.currentPrice) : null,
        value: won(h.value),
        weightPct: totalValue > 0 ? pct((h.value / totalValue) * 100) : null,
        profit: won(h.profit),
        profitPct: pct(h.profitPct),
      }),
    ),
    ...(truncated
      ? { note: `평가액 상위 ${MAX_HOLDINGS}종목만 표시 (전체 ${holdings.length}종목)` }
      : {}),
  }
}

/**
 * 일별 평가 스냅샷 (그룹 합산). Cron 이 채우는 pro_group_snapshots 를 읽는다.
 * @param {string} userId
 * @param {{ days?: number }} [opts]
 */
export async function getSnapshots(userId, opts = {}) {
  const supabase = requireSupabase()
  const days = Math.min(365, Math.max(1, Number(opts.days) || 30))

  const from = new Date(Date.now() - days * 86_400_000)
  const fromKey = seoulSnapshotDateKey(from)

  const { data, error } = await supabase
    .from('pro_group_snapshots')
    .select('snapshot_date, total_value, stock_value, cash_balance, initial_capital')
    .eq('user_id', userId)
    .gte('snapshot_date', fromKey)
    .order('snapshot_date', { ascending: true })

  if (error) throw new Error(error.message)

  /** 같은 날짜의 여러 그룹을 하나로 합산 */
  const byDate = new Map()
  for (const row of data ?? []) {
    const date = String(row.snapshot_date)
    const acc = byDate.get(date) ?? { stockValue: 0, cash: 0, initialCapital: 0 }
    acc.stockValue += Number(row.stock_value) || 0
    acc.cash += Number(row.cash_balance) || 0
    acc.initialCapital += Number(row.initial_capital) || 0
    byDate.set(date, acc)
  }

  const rows = [...byDate.entries()]
    .map(([date, acc]) => {
      const totalValue = acc.stockValue + acc.cash
      return compact({
        date,
        totalValue: won(totalValue),
        stockValue: won(acc.stockValue),
        cash: won(acc.cash),
        // 초기 자본 대비 총자산 수익률 (평가손익률과 다른 지표)
        returnPct:
          acc.initialCapital > 0
            ? pct(((totalValue - acc.initialCapital) / acc.initialCapital) * 100)
            : null,
      })
    })
    .slice(-MAX_SNAPSHOT_ROWS)

  const first = rows[0]
  const last = rows[rows.length - 1]

  return {
    currency: 'KRW',
    days,
    priceBasis: 'KRX 정규장 종가 (날짜 간 비교 기준을 고정하려고 NXT 시간외는 제외)',
    rows,
    ...(first && last && first !== last
      ? {
          change: compact({
            from: first.date,
            to: last.date,
            totalValueDiff: won(last.totalValue - first.totalValue),
            totalValuePct:
              first.totalValue > 0
                ? pct(((last.totalValue - first.totalValue) / first.totalValue) * 100)
                : null,
          }),
        }
      : {}),
  }
}

/**
 * 최근 매매 내역.
 * @param {string} userId
 * @param {{ limit?: number, code?: string, days?: number }} [opts]
 */
export async function getTrades(userId, opts = {}) {
  const supabase = requireSupabase()
  const limit = Math.min(MAX_TRADES, Math.max(1, Number(opts.limit) || 20))

  let query = supabase
    .from('pro_trades')
    .select('code, name, side, quantity, price, traded_at, memo, realized_profit')
    .eq('user_id', userId)
    .order('traded_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  const code = opts.code ? normalizeKisIscd(opts.code) : ''
  if (code && isValidStockCode(code)) {
    query = query.eq('code', code)
  }

  if (Number(opts.days) > 0) {
    const from = new Date(Date.now() - Number(opts.days) * 86_400_000)
    query = query.gte('traded_at', seoulSnapshotDateKey(from))
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  let buyCount = 0
  let sellCount = 0
  let realizedTotal = 0

  const rows = (data ?? []).map((t) => {
    const side = String(t.side) === 'sell' ? 'sell' : 'buy'
    const quantity = Number(t.quantity) || 0
    const price = Number(t.price) || 0
    const realized = t.realized_profit == null ? null : Number(t.realized_profit)

    if (side === 'sell') sellCount += 1
    else buyCount += 1
    if (realized != null && Number.isFinite(realized)) realizedTotal += realized

    return compact({
      date: String(t.traded_at ?? ''),
      code: normalizeKisIscd(t.code),
      name: String(t.name ?? '').trim() || null,
      side,
      quantity,
      price: won(price),
      amount: won(price * quantity),
      realizedProfit: realized == null ? null : won(realized),
      memo: t.memo ? String(t.memo).trim() : null,
    })
  })

  return {
    currency: 'KRW',
    rows,
    summary: compact({
      count: rows.length,
      buyCount,
      sellCount,
      realizedProfitSum: won(realizedTotal),
    }),
  }
}
