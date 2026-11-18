/**
 * MCP 커넥터 장중 수급 추이 — 종목별 프로그램 매매와 외국계 창구 순매수를 시각별로 본다.
 *
 * 외국인·기관 가집계(get_flow_estimate)는 하루 4번만 갱신된다. 그 사이의 방향을 보려고
 * 체결 단위로 갱신되는 두 대용 지표를 쓴다. 둘 다 "외국인 전체"와 같지 않다:
 * 프로그램 = 차익·비차익 바스켓 주문(외국인·기관 비중이 큼), 외국계 창구 = 외국계 증권사를 거친 주문.
 */
import { inquireProgramTradeByStock, inquireForeignMemberNetTrend } from '../kisClient.mjs'

/** @returns {[string, string, 'prod' | 'vps']} */
function kisCredentials() {
  const clean = (v) => String(v ?? '').trim().replace(/^(["'])(.*)\1$/, '$2').trim()
  const key = clean(process.env.KIS_APP_KEY)
  const secret = clean(process.env.KIS_APP_SECRET)
  if (!key || !secret) throw new Error('KIS 인증정보가 설정되지 않았습니다')
  return [key, secret, process.env.KIS_ENV === 'prod' ? 'prod' : 'vps']
}

function requireCode(code) {
  if (!/^\d{6}$/.test(String(code ?? ''))) throw new Error('6자리 종목코드가 필요합니다')
  return String(code)
}

const hms = (t) => `${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}`
const round = (n, d = 2) => (n == null || !Number.isFinite(n) ? null : Math.round(n * 10 ** d) / 10 ** d)
const limitOf = (v, dflt, max) => Math.min(Math.max(Number.isInteger(v) ? v : dflt, 1), max)

/**
 * KIS 금액 필드의 단위(원·천원·백만원)를 수량×현재가와 비교해 고른다. 판단할 행이 없으면 null.
 * @param {Array<{price: number | null, shares: number | null, amountRaw: number | null}>} samples
 * @returns {1 | 1000 | 1000000 | null}
 */
export function inferAmountUnit(samples) {
  const logs = []
  for (const s of samples) {
    if (!s.price || !s.shares || !s.amountRaw) continue
    const ratio = Math.abs(s.shares * s.price) / Math.abs(s.amountRaw)
    if (Number.isFinite(ratio) && ratio > 0) logs.push(Math.log10(ratio))
  }
  if (!logs.length) return null
  logs.sort((a, b) => a - b)
  const median = logs[Math.floor(logs.length / 2)]
  return /** @type {1 | 1000 | 1000000} */ ([1, 1000, 1000000].reduce((best, u) => (Math.abs(Math.log10(u) - median) < Math.abs(Math.log10(best) - median) ? u : best)))
}

/** 누계 순매수의 최근 흐름: 마지막 N개 구간의 변화 방향을 요약한다 */
function trendOf(rows, key) {
  const vals = rows.map((r) => r[key]).filter((v) => v != null)
  if (vals.length < 2) return null
  const first = vals[0], last = vals.at(-1)
  const change = last - first
  return { fromNetShares: first, toNetShares: last, change, direction: change > 0 ? 'buying' : change < 0 ? 'selling' : 'flat' }
}

const MARKET_DIVS = { krx: 'J', unified: 'UN', nxt: 'NX' }

/**
 * 종목별 프로그램 매매 추이 (당일, 누계)
 * @param {{ code: string, limit?: number, market?: 'krx' | 'unified' | 'nxt' }} input
 */
export async function getProgramTrade({ code, limit, market = 'krx' }) {
  if (!Object.hasOwn(MARKET_DIVS, market)) throw new Error('지원하지 않는 시장입니다')
  const raw = await inquireProgramTradeByStock(...kisCredentials(), requireCode(code), { marketDiv: MARKET_DIVS[market] })
  // 매도·매수 금액은 수량이 크므로 단위 판단에 가장 안정적이다
  const unit = inferAmountUnit(raw.flatMap((r) => [
    { price: r.price, shares: r.sellShares, amountRaw: r.sellAmountRaw },
    { price: r.price, shares: r.buyShares, amountRaw: r.buyAmountRaw },
  ]))
  const krw = (v) => (v == null || unit == null ? null : v * unit)
  const all = raw.map((r) => ({
    time: hms(r.time), price: r.price, changePct: r.changePct, volume: r.volume,
    sellShares: r.sellShares, buyShares: r.buyShares, netShares: r.netShares,
    netAmountKrw: krw(r.netAmountRaw), netSharesDelta: r.netSharesDelta,
    netPctOfVolume: r.netShares != null && r.volume ? round((r.netShares / r.volume) * 100) : null,
  }))
  const rows = all.slice(-limitOf(limit, 20, 100))
  return {
    code, retrievedAt: new Date().toISOString(), timezone: 'Asia/Seoul', source: 'KIS 종목별 프로그램매매추이(체결)',
    basis: market === 'krx' ? 'KRX' : market === 'nxt' ? 'NXT' : 'KRX+NXT', realtime: true, cumulative: true,
    units: { shares: '주', netAmountKrw: unit == null ? null : '원', amountUnitInferred: unit },
    count: rows.length, totalRows: all.length,
    latest: all.at(-1) ?? null, trend: trendOf(rows, 'netShares'), rows,
    note: '당일 프로그램 매도·매수·순매수의 누계이며 시각 오름차순입니다. KIS 가 최근 구간만 주므로 장 시작부터의 전체 추이는 아닐 수 있습니다. netSharesDelta 는 직전 체결 대비 순매수 증감, netPctOfVolume 은 누적 거래량 대비 프로그램 순매수 비중(%), trend 는 반환한 구간 안에서의 방향입니다. 금액 단위는 응답에 없어 수량×현재가와 비교해 추정했습니다(amountUnitInferred, 판단 불가면 null). 프로그램 매매는 외국인 전체와 같지 않은 대용 지표입니다. 확정 외국인 수급은 15:40 이후 get_investor_flow 로 확인하세요. KIS 실전 계정 전용입니다.',
  }
}

/**
 * 종목별 외국계 창구 순매수 추이 (당일, 누계)
 * @param {{ code: string, limit?: number }} input
 */
export async function getForeignBrokerFlow({ code, limit }) {
  const raw = await inquireForeignMemberNetTrend(...kisCredentials(), requireCode(code))
  const all = raw.map((r) => ({
    time: hms(r.time), price: r.price, changePct: r.changePct, volume: r.volume,
    sellShares: r.sellShares, buyShares: r.buyShares, netShares: r.netShares, netSharesDelta: r.netSharesDelta,
    netAmountEstKrw: r.netShares != null && r.price != null ? r.netShares * r.price : null,
    netPctOfVolume: r.netShares != null && r.volume ? round((r.netShares / r.volume) * 100) : null,
  }))
  const rows = all.slice(-limitOf(limit, 20, 100))
  return {
    code, retrievedAt: new Date().toISOString(), timezone: 'Asia/Seoul', source: 'KIS 종목별 외국계 순매수추이',
    basis: 'KRX', realtime: true, cumulative: true,
    units: { shares: '주', netAmountEstKrw: '원 (순매수 수량 × 그 시각 현재가, 추정)' },
    count: rows.length, totalRows: all.length,
    latest: all.at(-1) ?? null, trend: trendOf(rows, 'netShares'), rows,
    note: '외국계 증권사 창구로 체결된 매도·매수·순매수의 당일 누계이며 시각 오름차순입니다. KIS 가 최근 구간만 주므로 전체 추이는 아닐 수 있습니다. 외국계 창구는 외국인 전체와 같지 않습니다(국내 창구로 주문하는 외국인, 외국계 창구를 쓰는 내국인이 있음). trend 는 반환한 구간 안에서의 방향입니다. 하루 4번 갱신되는 외국인 가집계(get_flow_estimate) 사이의 방향을 볼 때 쓰고, 확정치는 15:40 이후 get_investor_flow 로 확인하세요. KIS 실전 계정 전용입니다.',
  }
}
