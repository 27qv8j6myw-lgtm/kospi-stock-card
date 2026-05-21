/**
 * 한국투자증권 Open API — 현재가/기간차트 조회
 * @see https://apiportal.koreainvestment.com/
 */

import fs from 'node:fs'
import path from 'node:path'
import { withCache } from './lib/kisCache.mjs'

/** 시세류 TTL (ms) */
const KIS_CACHE_TTL_QUOTE_MS = 30_000
/** 일봉·투자자 등 분석/스크리닝용 TTL (ms) */
const KIS_CACHE_TTL_ANALYSIS_MS = 5 * 60_000

const KIS_RATE_LIMIT_RETRY_MS = [1000, 2000, 4000]
const KIS_RATE_LIMIT_MAX_RETRIES = 3

const BASE_URL = {
  prod: 'https://openapi.koreainvestment.com:9443',
  vps: 'https://openapivts.koreainvestment.com:29443',
}

/** @type {{ token: string | null, expiresAt: number }} */
let cache = { token: null, expiresAt: 0 }
const TOKEN_CACHE_PATH = path.resolve(process.cwd(), '.tmp-kis-token.json')

function readTokenCache() {
  try {
    if (!fs.existsSync(TOKEN_CACHE_PATH)) return null
    const obj = JSON.parse(fs.readFileSync(TOKEN_CACHE_PATH, 'utf-8'))
    if (!obj?.token || !obj?.expiresAt) return null
    return { token: String(obj.token), expiresAt: Number(obj.expiresAt) }
  } catch {
    return null
  }
}

function writeTokenCache(token, expiresAt) {
  try {
    fs.writeFileSync(
      TOKEN_CACHE_PATH,
      JSON.stringify({ token, expiresAt, savedAt: Date.now() }),
      'utf-8',
    )
  } catch {
    // ignore cache write errors
  }
}

function baseUrl(env) {
  const key = env === 'prod' ? 'prod' : 'vps'
  return BASE_URL[key]
}

function parseKisExpiry(s) {
  if (!s || typeof s !== 'string') return Date.now() + 23 * 60 * 60 * 1000
  const normalized = s.includes('T') ? s : s.replace(' ', 'T')
  const t = Date.parse(normalized)
  return Number.isFinite(t) ? t : Date.now() + 23 * 60 * 60 * 1000
}

function num(v) {
  if (v === undefined || v === null || v === '') return null
  const n = Number(String(v).replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

/** KIS 일부 API는 output 이 배열이 아니라 단일 객체로 올 수 있음 */
function normalizeKisOutputRows(output) {
  if (output == null) return []
  if (Array.isArray(output)) return output
  if (typeof output === 'object') return [output]
  return []
}

/**
 * 주식현재가 시세 output 에서 한글 종목명 추출 (TR/계정마다 필드명이 다를 수 있음)
 * @param {Record<string, unknown>|null|undefined} o
 * @param {string} iscd6
 * @returns {string|null}
 */
function resolveKoreanNameFromPriceOutput(o, iscd6) {
  if (!o || typeof o !== 'object') return null
  const code = String(iscd6 || '').replace(/\D/g, '').padStart(6, '0')
  const candidates = [
    o.hts_kor_isnm,
    o.hts_kor_isnm1,
    o.prdt_name,
    o.prdt_abrv_name,
    o.prdt_korean_name,
    o.kor_isnm,
    o.stck_kor_isnm,
    o.iscd_name,
  ]
  for (const c of candidates) {
    const s = typeof c === 'string' ? c.trim() : ''
    if (s && s !== code) return s
  }
  for (const [k, v] of Object.entries(o)) {
    if (typeof v !== 'string') continue
    // bstp_kor_isnm 등 업종·시장 필드는 'isnm'에만 걸려 종목명으로 오인됨 → 제외
    if (/bstp|bsop|mrkt_kor_name|rprs_mrkt|fid_/i.test(k)) continue
    const t = v.trim()
    if (!t || t === code) continue
    if (!/[가-힣]/.test(t)) continue
    if (/(isnm|kornm|kor_nm|prdt.*nm|abrv|name)/i.test(k)) return t
  }
  return null
}

function ymd(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

function hmColon(hms) {
  const s = String(hms || '').padStart(6, '0')
  return `${s.slice(0, 2)}:${s.slice(2, 4)}`
}

/** KIS 분봉 체결시각 → HHMMSS (6자리). 4자리 HHMM이면 초를 00으로 붙임 */
function normalizeCntgHhmmss(raw) {
  const d = String(raw ?? '').replace(/\D/g, '')
  if (!d) return ''
  if (d.length <= 4) return `${d.padStart(4, '0')}00`
  return d.padStart(6, '0').slice(-6)
}

function hhmmssToNum(h) {
  const n = Number(normalizeCntgHhmmss(h))
  return Number.isFinite(n) ? n : -1
}

function prevMinuteHhmmss(hhmmss) {
  const s = normalizeCntgHhmmss(hhmmss)
  const hh = Number(s.slice(0, 2))
  const mm = Number(s.slice(2, 4))
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return s
  const total = hh * 60 + mm - 1
  if (total <= 0) return '000000'
  const nh = String(Math.floor(total / 60)).padStart(2, '0')
  const nm = String(total % 60).padStart(2, '0')
  return `${nh}${nm}00`
}

/** 당일분봉 조회·endTs는 장(KST) 기준이어야 함 — 서버가 UTC면 로컬 시각을 쓰면 체결이 전부 걸러져 첫 가격만 반복됨 */
function seoulNowHhmm00(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const hour = (parts.find((p) => p.type === 'hour')?.value ?? '0').padStart(2, '0')
  const minute = (parts.find((p) => p.type === 'minute')?.value ?? '0').padStart(2, '0')
  return `${hour}${minute}00`
}

function mdLabel(yyyymmdd) {
  const s = String(yyyymmdd || '')
  if (s.length !== 8) return s
  return `${s.slice(4, 6)}.${s.slice(6, 8)}`
}

function toTfCount(tf) {
  return tf === '5D'
    ? 5
    : tf === '1M'
      ? 22
      : tf === '3M'
        ? 66
        : tf === '1Y'
          ? 252
          : 252
}

function parseJsonOrThrow(res, text, kind) {
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(
      !res.ok
        ? `${kind} HTTP ${res.status}: ${text.slice(0, 200)}`
        : `${kind} 응답이 JSON이 아닙니다.`,
    )
  }
}

function normalizeKisError(data, fallbackPrefix) {
  const cd = data?.msg_cd || String(data?.rt_cd ?? '')
  const msg = data?.msg1 || data?.message || cd || '알 수 없는 오류'
  return `${fallbackPrefix} (${cd}): ${msg}`
}

/**
 * KIS 한도(EGW00201) 또는 동일 의미의 예외인지.
 * @param {unknown} e
 * @returns {boolean}
 */
export function isKisRateLimitError(e) {
  if (e && typeof e === 'object' && 'code' in e && /** @type {{ code?: string }} */ (e).code === 'RATE_LIMIT') {
    return true
  }
  const msg = e instanceof Error ? e.message : String(e ?? '')
  return msg === '호출 한도 초과' || msg.includes('EGW00201')
}

export async function getAccessToken(appKey, appSecret, env) {
  const now = Date.now()
  if (cache.token && cache.expiresAt > now + 60_000) return cache.token

  const persisted = readTokenCache()
  if (persisted && persisted.expiresAt > now + 60_000) {
    cache = persisted
    return persisted.token
  }

  const res = await fetch(`${baseUrl(env)}/oauth2/tokenP`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/plain',
    },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      appkey: appKey,
      appsecret: appSecret,
    }),
  })

  const text = await res.text()
  if (!res.ok) {
    let err = null
    try {
      err = JSON.parse(text)
    } catch {
      err = null
    }
    if (err?.error_code === 'EGW00133') {
      if (persisted?.token) {
        return persisted.token
      }
      throw new Error('KIS 토큰 발급 제한(EGW00133): 1분 후 다시 시도하세요.')
    }
    throw new Error(`KIS 토큰 발급 실패 (${res.status}): ${text.slice(0, 200)}`)
  }

  const data = parseJsonOrThrow(res, text, 'KIS 토큰')
  const token = data.access_token
  if (!token) throw new Error('KIS 토큰 필드가 없습니다.')

  cache = {
    token,
    expiresAt: parseKisExpiry(data.access_token_token_expired),
  }
  writeTokenCache(cache.token, cache.expiresAt)
  return token
}

async function kisGet({ appKey, appSecret, env, path, params, trId, kind }) {
  let attempt = 0
  while (true) {
    const token = await getAccessToken(appKey, appSecret, env)
    const url = new URL(`${baseUrl(env)}${path}`)
    for (const [k, v] of Object.entries(params || {})) {
      url.searchParams.set(k, String(v))
    }

    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Accept: 'text/plain',
        authorization: `Bearer ${token}`,
        appkey: appKey,
        appsecret: appSecret,
        tr_id: trId,
        custtype: 'P',
        tr_cont: '',
      },
    })

    const text = await res.text()
    const data = parseJsonOrThrow(res, text, kind)
    if (!res.ok || data.rt_cd !== '0') {
      const cd = data?.msg_cd || String(data?.rt_cd ?? '')
      if (cd === 'EGW00201' && attempt < KIS_RATE_LIMIT_MAX_RETRIES) {
        const ms = KIS_RATE_LIMIT_RETRY_MS[attempt] ?? 4000
        console.log(`[KIS] 한도 초과, ${ms}ms 후 재시도 (${attempt + 1}/${KIS_RATE_LIMIT_MAX_RETRIES})`)
        await new Promise((r) => setTimeout(r, ms))
        attempt += 1
        continue
      }
      if (cd === 'EGW00201') {
        const err = new Error('호출 한도 초과')
        err.code = 'RATE_LIMIT'
        throw err
      }
      throw new Error(normalizeKisError(data, `${kind} 오류`))
    }
    return data
  }
}

/** 국내 주식 현재가 시세 [v1_국내주식-008] */
export async function inquireDomesticPrice(appKey, appSecret, env, code6) {
  const iscd = String(code6).replace(/\D/g, '').padStart(6, '0')
  const cacheKey = `kis:quote:${env}:${iscd}`
  return await withCache(cacheKey, KIS_CACHE_TTL_QUOTE_MS, async () => {
      const data = await kisGet({
        appKey,
        appSecret,
        env,
        path: '/uapi/domestic-stock/v1/quotations/inquire-price',
        params: {
          FID_COND_MRKT_DIV_CODE: 'J',
          FID_INPUT_ISCD: iscd,
        },
        trId: 'FHKST01010100',
        kind: 'KIS 시세',
      })

      const rows = normalizeKisOutputRows(data.output)
      const o = rows[0]
      if (!o || typeof o !== 'object') throw new Error('KIS 시세 output 없음')

      const price = num(o?.stck_prpr)
      if (price === null) throw new Error('현재가(stck_prpr) 파싱 실패')

      const epsN = num(o?.eps)
      const bpsN = num(o?.bps)
      const roeTtmApprox =
        epsN != null && bpsN != null && Number.isFinite(epsN) && Number.isFinite(bpsN) && bpsN !== 0
          ? (epsN / bpsN) * 100
          : null

      /** 응답 필드명이 종목·TR마다 다를 수 있어 키워드 스캔(있을 때만) */
      const skipKey = /prdy|stck|prpr|vrss|ctrt|vol|hour|date|time|iscd|cntg|acml|frgn|orgn|prsn|fid|nmix|kospi/i
      function firstRatioByKeyHint(obj, hintRe) {
        if (!obj || typeof obj !== 'object') return null
        for (const [k, v] of Object.entries(obj)) {
          if (skipKey.test(k)) continue
          if (!hintRe.test(k)) continue
          const n = num(v)
          if (n == null || !Number.isFinite(n)) continue
          return n
        }
        return null
      }

      const operatingMarginTtm = firstRatioByKeyHint(o, /(oprt|oper|bsop|prfi).*mrgn|margin|margn|이익률/i)
      const debtRatio = firstRatioByKeyHint(o, /debt|lblt|liab|부채|tot_lblt|borr|gearing/i)

      const listedShares = num(o?.lstn_stcn)
      const htsAvls = num(o?.hts_avls)
      let marketCap = null
      if (price != null && listedShares != null && listedShares > 0) {
        marketCap = Math.round(price * listedShares)
      } else if (htsAvls != null && htsAvls > 0) {
        marketCap = Math.round(htsAvls * 1_000_000)
      }

      return {
        code: iscd,
        nameKr: resolveKoreanNameFromPriceOutput(o, iscd),
        market: o?.rprs_mrkt_kor_name || null,
        sector: o?.bstp_kor_isnm || null,
        price,
        change: num(o?.prdy_vrss) ?? 0,
        changePercent: num(o?.prdy_ctrt) ?? 0,
        changeSign: o?.prdy_vrss_sign ?? null,
        volume: num(o?.acml_vol),
        tradeValue: num(o?.acml_tr_pbmn),
        open: num(o?.stck_oprc),
        high: num(o?.stck_hgpr),
        low: num(o?.stck_lwpr),
        per: num(o?.per),
        pbr: num(o?.pbr),
        eps: epsN,
        bps: bpsN,
        roeTtmApprox,
        operatingMarginTtm,
        debtRatio,
        marketCap,
        listedShares,
        raw: o,
      }
    })
}

// inquire-investor 의 *_tr_pbmn 은 원화가 아닌 축약 단위로 내려오므로 KRW로 보정
const INVESTOR_AMOUNT_UNIT_KRW = 1_000_000

/** rows[0]이 가장 최근 거래일이라고 가정하고 직전 n거래일 누적 합산 */
function sumInvestorRows(rows, maxDays) {
  const slice = Array.isArray(rows) ? rows.slice(0, Math.min(maxDays, rows.length)) : []
  let foreignNetShares = 0
  let foreignNetAmount = 0
  let institutionNetShares = 0
  let institutionNetAmount = 0
  let personalNetShares = 0
  let personalNetAmount = 0
  for (const r of slice) {
    foreignNetShares += num(r.frgn_ntby_qty) ?? 0
    foreignNetAmount += (num(r.frgn_ntby_tr_pbmn) ?? 0) * INVESTOR_AMOUNT_UNIT_KRW
    institutionNetShares += num(r.orgn_ntby_qty) ?? 0
    institutionNetAmount += (num(r.orgn_ntby_tr_pbmn) ?? 0) * INVESTOR_AMOUNT_UNIT_KRW
    personalNetShares += num(r.prsn_ntby_qty) ?? 0
    personalNetAmount += (num(r.prsn_ntby_tr_pbmn) ?? 0) * INVESTOR_AMOUNT_UNIT_KRW
  }
  return {
    foreignNetShares,
    foreignNetAmount,
    institutionNetShares,
    institutionNetAmount,
    personalNetShares,
    personalNetAmount,
    daysUsed: slice.length,
  }
}

/** 국내 주식 현재가 투자자 [주식현재가 투자자] */
export async function inquireInvestorByStock(appKey, appSecret, env, code6) {
  const iscd = String(code6).replace(/\D/g, '').padStart(6, '0')
  const cacheKey = `kis:investor:${env}:${iscd}`
  return await withCache(cacheKey, KIS_CACHE_TTL_ANALYSIS_MS, async () => {
      const data = await kisGet({
        appKey,
        appSecret,
        env,
        path: '/uapi/domestic-stock/v1/quotations/inquire-investor',
        params: {
          FID_COND_MRKT_DIV_CODE: 'J',
          FID_INPUT_ISCD: iscd,
        },
        trId: 'FHKST01010900',
        kind: 'KIS 투자자동향',
      })

      const rows = normalizeKisOutputRows(data.output)
      const latest = rows[0] || null
      const emptyCumulative = () => ({
        foreignNetShares: 0,
        foreignNetAmount: 0,
        institutionNetShares: 0,
        institutionNetAmount: 0,
        personalNetShares: 0,
        personalNetAmount: 0,
        daysUsed: 0,
      })

      if (!latest) {
        return {
          code: iscd,
          latest: null,
          rows: [],
          cumulative3d: emptyCumulative(),
          cumulative5d: emptyCumulative(),
          cumulative20d: emptyCumulative(),
        }
      }

      return {
        code: iscd,
        latest: {
          date: latest.stck_bsop_date || null,
          personalNetShares: num(latest.prsn_ntby_qty) ?? 0,
          personalNetAmount: (num(latest.prsn_ntby_tr_pbmn) ?? 0) * INVESTOR_AMOUNT_UNIT_KRW,
          foreignNetShares: num(latest.frgn_ntby_qty) ?? 0,
          foreignNetAmount: (num(latest.frgn_ntby_tr_pbmn) ?? 0) * INVESTOR_AMOUNT_UNIT_KRW,
          institutionNetShares: num(latest.orgn_ntby_qty) ?? 0,
          institutionNetAmount: (num(latest.orgn_ntby_tr_pbmn) ?? 0) * INVESTOR_AMOUNT_UNIT_KRW,
        },
        rows,
        cumulative3d: sumInvestorRows(rows, 3),
        cumulative5d: sumInvestorRows(rows, 5),
        cumulative20d: sumInvestorRows(rows, 20),
      }
    })
}

async function inquireDailyChart(appKey, appSecret, env, code6, tf) {
  const bars = await inquireDailyBars(appKey, appSecret, env, code6, Math.max(toTfCount(tf), 5))
  return bars.slice(-toTfCount(tf))
}

/**
 * 일봉 종가 시계열 (최근 maxBars개, 오름차순 ts).
 * [국내주식] 기간별시세(일) — FHKST03010100
 */
export async function inquireDailyBars(appKey, appSecret, env, code6, maxBars = 60) {
  const iscd = String(code6).replace(/\D/g, '').padStart(6, '0')
  const nReq = Math.max(5, Math.min(Number(maxBars) || 60, 430))
  const cacheKey = `kis:daily:${env}:${iscd}:${nReq}`
  return await withCache(cacheKey, KIS_CACHE_TTL_ANALYSIS_MS, async () => {
      const today = new Date()
      const start = new Date(today)
      start.setDate(start.getDate() - 430)

      const data = await kisGet({
        appKey,
        appSecret,
        env,
        path: '/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice',
        params: {
          FID_COND_MRKT_DIV_CODE: 'J',
          FID_INPUT_ISCD: iscd,
          FID_INPUT_DATE_1: ymd(start),
          FID_INPUT_DATE_2: ymd(today),
          FID_PERIOD_DIV_CODE: 'D',
          FID_ORG_ADJ_PRC: '1',
        },
        trId: 'FHKST03010100',
        kind: 'KIS 기간차트',
      })

      const rows = Array.isArray(data.output2) ? data.output2 : []
      const parsed = rows
        .map((r) => {
          const date = r.stck_bsop_date || r.biz_day || r.bstp_nmix_prpr || ''
          const close = num(r.stck_clpr) ?? num(r.stck_prpr) ?? num(r.clpr)
          if (!date || close === null) return null
          const open = num(r.stck_oprc) ?? close
          const high = num(r.stck_hgpr) ?? close
          const low = num(r.stck_lwpr) ?? close
          const volume = num(r.acml_vol) ?? num(r.ft_vol) ?? 0
          return {
            label: mdLabel(date),
            price: Math.round(close),
            open: Math.round(open),
            high: Math.round(high),
            low: Math.round(low),
            volume: Math.max(0, Math.round(volume)),
            ts: date,
          }
        })
        .filter(Boolean)

      parsed.sort((a, b) => String(a.ts).localeCompare(String(b.ts)))

      const n = Math.max(5, Math.min(Number(maxBars) || 60, parsed.length))
      return parsed.slice(-n).map(({ label, price, ts, open, high, low, volume }) => ({
        label,
        price,
        ts,
        open,
        high,
        low,
        volume,
      }))
    })
}

async function inquireIntradayChart(appKey, appSecret, env, code6) {
  const iscd = String(code6).replace(/\D/g, '').padStart(6, '0')
  const now = new Date()
  const seoulHhmm00 = seoulNowHhmm00(now)
  const seoulNum = hhmmssToNum(seoulHhmm00)
  // 장중 데이터 기준 시각으로 조회 (장전/장후에는 15:30 기준으로 요청)
  const requestHour =
    seoulNum < 90_000 || seoulNum >= 153_000 ? '153000' : seoulHhmm00

  const fetchChunk = async (hourCursor) => {
    const data = await kisGet({
      appKey,
      appSecret,
      env,
      path: '/uapi/domestic-stock/v1/quotations/inquire-time-itemchartprice',
      params: {
        FID_COND_MRKT_DIV_CODE: 'J',
        FID_INPUT_ISCD: iscd,
        FID_INPUT_HOUR_1: hourCursor,
        FID_PW_DATA_INCU_YN: 'Y',
        FID_ETC_CLS_CODE: '',
      },
      trId: 'FHKST03010200',
      kind: 'KIS 당일분봉',
    })
    const rows = Array.isArray(data.output2) ? data.output2 : []
    return rows
      .map((r) => {
        const rawHour = r.stck_cntg_hour || r.cntg_hour || r.bstp_nmix_cntg_hour || ''
        const hour = normalizeCntgHhmmss(rawHour)
        // 당일분봉: stck_clpr가 전일 종가로 고정되는 케이스가 있어 stck_prpr(현재가/체결가) 우선
        const price =
          num(r.stck_prpr) ?? num(r.stck_clpr) ?? num(r.stck_oprc) ?? num(r.prpr)
        if (!hour || price === null) return null
        return {
          ts: hour,
          price: Math.round(price),
        }
      })
      .filter(Boolean)
  }

  const SESSION_START = 90_000
  // VPS 호출 한도 보호: 당일분봉은 1회 호출만 사용
  const MAX_CHUNKS = 1
  const seen = new Set()
  const parsed = []
  let cursor = requestHour
  let chunkCount = 0
  while (chunkCount < MAX_CHUNKS) {
    const chunk = await fetchChunk(cursor)
    if (!chunk.length) break
    let minTs = null
    for (const p of chunk) {
      const key = p.ts
      if (!seen.has(key)) {
        seen.add(key)
        parsed.push(p)
      }
      if (!minTs || hhmmssToNum(p.ts) < hhmmssToNum(minTs)) minTs = p.ts
    }
    if (!minTs) break
    if (hhmmssToNum(minTs) <= SESSION_START) break
    const next = prevMinuteHhmmss(minTs)
    if (next === cursor) break
    cursor = next
    chunkCount += 1
  }

  parsed.sort((a, b) => hhmmssToNum(a.ts) - hhmmssToNum(b.ts))

  const SESSION_END = 153_000
  const sessionTicks = parsed.filter((p) => {
    const n = hhmmssToNum(p.ts)
    return n >= SESSION_START && n <= SESSION_END
  })

  // 장 전: 서버 시각만 쓰면 end가 08xxxx가 되어 09:00 이후 체결이 전부 제외됨 → 장중 끝(15:30)까지 허용
  const endNum =
    seoulNum < 90_000
      ? 153_000
      : seoulNum >= 153_000
        ? 153_000
        : seoulNum

  const slots = []
  for (let hh = 9; hh <= 15; hh += 1) {
    slots.push(`${String(hh).padStart(2, '0')}0000`)
    if (hh !== 15) slots.push(`${String(hh).padStart(2, '0')}3000`)
  }
  slots.push('153000')

  const series = []
  let cursorIdx = 0
  let carry = null
  for (const slot of slots) {
    const slotNum = hhmmssToNum(slot)
    if (slotNum > endNum) break
    while (cursorIdx < sessionTicks.length && hhmmssToNum(sessionTicks[cursorIdx].ts) <= slotNum) {
      carry = sessionTicks[cursorIdx].price
      cursorIdx += 1
    }
    series.push({
      label: hmColon(slot),
      price: carry,
      ts: slot,
    })
  }

  if (series.length) return series
  return [
    {
      label: hmColon(normalizeCntgHhmmss(String(endNum))),
      price: null,
      ts: normalizeCntgHhmmss(String(endNum)),
    },
  ]
}

export async function inquireChartByTimeframe(appKey, appSecret, env, code6, tf) {
  return inquireDailyChart(appKey, appSecret, env, code6, tf)
}

/** 5거래일 차트 포인트 기준 누적 수익률(%) — 첫 종가 대비 마지막 종가 */
export function chartPointsToReturnPct(points) {
  if (!Array.isArray(points) || points.length < 2) return 0
  const first = points[0]?.price
  const last = points[points.length - 1]?.price
  if (first == null || last == null || !Number.isFinite(first) || first === 0) return 0
  return ((last - first) / first) * 100
}

/** KOSPI 지수(069500) 5영업일 누적 수익률(%) */
export async function inquireKospiReturn5D(appKey, appSecret, env) {
  const pts = await inquireChartByTimeframe(appKey, appSecret, env, '069500', '5D')
  return chartPointsToReturnPct(pts)
}

/**
 * 국내주식 거래금액(누적) 순위 상위 — [국내주식-047] `volume-rank`, `FID_BLNG_CLS_CODE=3` 거래금액순.
 * @param {string} appKey
 * @param {string} appSecret
 * @param {'prod'|'vps'} env
 * @param {{ marketIscd?: string, limit?: number }} [opts] — `FID_INPUT_ISCD` (예: 0001 KOSPI, 0000 전체)
 * @returns {Promise<Array<{ code: string, name: string, currentPrice: number | null, changePct: number | null, tradingValue: number | null }>>}
 */
export async function inquireTradeValueRankTop(appKey, appSecret, env, opts = {}) {
  const marketIscd = opts.marketIscd != null ? String(opts.marketIscd) : '0001'
  const limit = Math.min(50, Math.max(1, Number(opts.limit) || 5))
  const cacheKey = `kis:trade-value-rank:${env}:${marketIscd}:${limit}`
  return await withCache(cacheKey, 5 * 60_000, async () => {
    const data = await kisGet({
      appKey,
      appSecret,
      env,
      path: '/uapi/domestic-stock/v1/quotations/volume-rank',
      params: {
        FID_COND_MRKT_DIV_CODE: 'J',
        FID_COND_SCR_DIV_CODE: '20171',
        FID_INPUT_ISCD: marketIscd,
        FID_DIV_CLS_CODE: '0',
        FID_BLNG_CLS_CODE: '3',
        FID_TRGT_CLS_CODE: '111111111',
        FID_TRGT_EXLS_CLS_CODE: '0000000000',
        FID_INPUT_PRICE_1: '0',
        FID_INPUT_PRICE_2: '10000000000',
        FID_VOL_CNT: '0',
        FID_INPUT_DATE_1: '',
      },
      trId: 'FHPST01710000',
      kind: 'KIS 거래금액순위',
    })
    const rows = normalizeKisOutputRows(data.output)
    return rows.slice(0, limit).map((r) => {
      const code = String(r.mksc_shrn_iscd ?? '')
        .replace(/\D/g, '')
        .padStart(6, '0')
      return {
        code,
        name: typeof r.hts_kor_isnm === 'string' ? r.hts_kor_isnm.trim() : '',
        currentPrice: num(r.stck_prpr),
        changePct: num(r.prdy_ctrt),
        tradingValue: num(r.acml_tr_pbmn),
      }
    })
  })
}

/**
 * 국내업종 현재지수 [v1_국내주식-063] — KOSPI `0001`, KOSDAQ `1001`
 * @param {string} appKey
 * @param {string} appSecret
 * @param {'prod'|'vps'} env
 * @param {string} iscd
 * @returns {Promise<{ value: number, changePct: number } | null>}
 */
export async function inquireDomesticIndexPrice(appKey, appSecret, env, iscd) {
  const code = String(iscd || '').trim()
  const cacheKey = `kis:dom-index:${env}:${code}`
  return await withCache(cacheKey, 60_000, async () => {
    const data = await kisGet({
      appKey,
      appSecret,
      env,
      path: '/uapi/domestic-stock/v1/quotations/inquire-index-price',
      params: {
        FID_COND_MRKT_DIV_CODE: 'U',
        FID_INPUT_ISCD: code,
      },
      trId: 'FHPUP02100000',
      kind: 'KIS 국내지수',
    })
    const rows = normalizeKisOutputRows(data.output)
    const o = rows[0]
    if (!o || typeof o !== 'object') return null
    const value = num(o.bstp_nmix_prpr)
    const changePct = num(o.bstp_nmix_prdy_ctrt)
    if (value == null || !Number.isFinite(value)) return null
    return { value, changePct: changePct ?? 0 }
  })
}

/**
 * 해외지수·환율 현재가 스냅샷 [v1_해외주식-031] output1
 * @param {string} appKey
 * @param {string} appSecret
 * @param {'prod'|'vps'} env
 * @param {'N'|'X'} mrktDiv — N 해외지수, X 환율
 * @param {string} iscd — 예: COMP, SPX, FX@KRW
 * @returns {Promise<{ value: number, changePct: number } | null>}
 */
export async function inquireOverseasIndexOrFxSnapshot(appKey, appSecret, env, mrktDiv, iscd) {
  const sym = String(iscd || '').trim()
  const cacheKey = `kis:ovrs-snap:${env}:${mrktDiv}:${sym}`
  return await withCache(cacheKey, 60_000, async () => {
    const data = await kisGet({
      appKey,
      appSecret,
      env,
      path: '/uapi/overseas-price/v1/quotations/inquire-time-indexchartprice',
      params: {
        FID_COND_MRKT_DIV_CODE: mrktDiv,
        FID_INPUT_ISCD: sym,
        FID_HOUR_CLS_CODE: '0',
        FID_PW_DATA_INCU_YN: 'Y',
      },
      trId: 'FHKST03030200',
      kind: 'KIS 해외지수',
    })
    const raw = data.output1
    const o = Array.isArray(raw) ? raw[0] : raw
    if (!o || typeof o !== 'object') return null
    const value = num(o.ovrs_nmix_prpr)
    const changePct = num(o.prdy_ctrt)
    if (value == null || !Number.isFinite(value)) return null
    return { value, changePct: changePct ?? 0 }
  })
}

function firstNumByKeyHint(obj, hintRe) {
  if (!obj || typeof obj !== 'object') return null
  for (const [k, v] of Object.entries(obj)) {
    if (!hintRe.test(k)) continue
    const n = num(v)
    if (n != null && Number.isFinite(n)) return n
  }
  return null
}

/**
 * 국내주식 공매도 일별추이 [국내주식-134] FHPST04830000
 * @returns {Promise<{ rows: Array<Record<string, unknown>>, summary: Record<string, unknown> | null }>}
 */
export async function inquireDailyShortSale(appKey, appSecret, env, code6, opts = {}) {
  const iscd = String(code6).replace(/\D/g, '').padStart(6, '0')
  const days = Math.max(3, Math.min(Number(opts.days) || 10, 30))
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days * 2)
  const cacheKey = `kis:short-sale:${env}:${iscd}:${ymd(end)}`
  return await withCache(cacheKey, KIS_CACHE_TTL_ANALYSIS_MS, async () => {
    const data = await kisGet({
      appKey,
      appSecret,
      env,
      path: '/uapi/domestic-stock/v1/quotations/daily-short-sale',
      params: {
        FID_COND_MRKT_DIV_CODE: 'J',
        FID_INPUT_ISCD: iscd,
        FID_INPUT_DATE_1: ymd(start),
        FID_INPUT_DATE_2: ymd(end),
      },
      trId: 'FHPST04830000',
      kind: 'KIS 공매도',
    })
    const summary = data.output1 && typeof data.output1 === 'object' ? data.output1 : null
    const rows = normalizeKisOutputRows(data.output2)
    return { rows, summary }
  })
}

/**
 * 국내주식 신용잔고 일별추이 [국내주식-110] FHPST04760000
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function inquireDailyCreditBalance(appKey, appSecret, env, code6) {
  const iscd = String(code6).replace(/\D/g, '').padStart(6, '0')
  const cacheKey = `kis:credit-bal:${env}:${iscd}:${ymd(new Date())}`
  return await withCache(cacheKey, KIS_CACHE_TTL_ANALYSIS_MS, async () => {
    const data = await kisGet({
      appKey,
      appSecret,
      env,
      path: '/uapi/domestic-stock/v1/quotations/daily-credit-balance',
      params: {
        FID_COND_MRKT_DIV_CODE: 'J',
        FID_COND_SCR_DIV_CODE: '20476',
        FID_INPUT_ISCD: iscd,
        FID_INPUT_DATE_1: ymd(new Date()),
      },
      trId: 'FHPST04760000',
      kind: 'KIS 신용잔고',
    })
    return normalizeKisOutputRows(data.output)
  })
}

export { firstNumByKeyHint }
