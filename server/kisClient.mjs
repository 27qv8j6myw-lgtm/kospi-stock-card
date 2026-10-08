/**
 * 한국투자증권 Open API — 현재가/기간차트 조회
 * @see https://apiportal.koreainvestment.com/
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { withCache } from './lib/kisCache.mjs'
import { normalizeKisIscd } from './lib/stockCode.mjs'
import { readSharedToken, writeSharedToken, invalidateSharedToken } from './lib/kisTokenStore.mjs'

/** 시세류 TTL (ms) */
const KIS_CACHE_TTL_QUOTE_MS = 30_000
/** 일봉·투자자 등 분석/스크리닝용 TTL (ms) */
const KIS_CACHE_TTL_ANALYSIS_MS = 5 * 60_000

/** 국내 시장분류코드 — KRX 단독 / NXT 단독 / KRX·NXT 통합 */
const DOMESTIC_MARKET_DIVS = new Set(['J', 'NX', 'UN'])

/**
 * 화면 표시용 현재가는 KRX·NXT 통합가를 쓴다 (NXT 프리·애프터마켓 시간대 포함).
 * 일별 스냅샷 등 기준을 고정해야 하는 경로는 `MARKET_DIV_REGULAR` 를 쓴다.
 */
export const MARKET_DIV_DISPLAY = 'UN'
/** 정규장(KRX) 단독 — 날짜 간 비교 기준을 흔들지 않아야 하는 기록용 */
export const MARKET_DIV_REGULAR = 'J'

/** NXT 계열 조회가 막힌 환경을 잠시 기억해 두는 시간 (ms) */
const MARKET_DIV_DISABLE_MS = 10 * 60_000
/** @type {Map<string, number>} `${env}:${div}` → 다시 시도해 볼 시각 */
const marketDivDisabledUntil = new Map()

/**
 * @param {string} env
 * @param {string} div
 */
function isMarketDivDisabled(env, div) {
  if (div === 'J') return false
  const until = marketDivDisabledUntil.get(`${env}:${div}`)
  if (!until) return false
  if (until > Date.now()) return true
  marketDivDisabledUntil.delete(`${env}:${div}`)
  return false
}

/** 종목 단위 미상장이 아니라 환경 자체가 막힌 신호 */
const MARKET_DIV_UNSUPPORTED_RE = /모의|미지원|지원하지|유효하지 않은|not support|invalid/i

/**
 * @param {string} env
 * @param {string} div
 * @param {string} message
 */
function noteMarketDivFailure(env, div, message) {
  if (!MARKET_DIV_UNSUPPORTED_RE.test(message)) return
  marketDivDisabledUntil.set(`${env}:${div}`, Date.now() + MARKET_DIV_DISABLE_MS)
  console.warn(`[KIS] ${env} 환경에서 ${div} 시세 미지원 판단 — 10분간 KRX 단독으로 조회`)
}

/**
 * @param {string} env
 * @param {string} div
 */
function clearMarketDivFailure(env, div) {
  marketDivDisabledUntil.delete(`${env}:${div}`)
}

const KIS_RATE_LIMIT_RETRY_MS = [1000, 2000, 4000]
const KIS_RATE_LIMIT_MAX_RETRIES = 3

const BASE_URL = {
  prod: 'https://openapi.koreainvestment.com:9443',
  vps: 'https://openapivts.koreainvestment.com:29443',
}

/** @type {{ token: string | null, expiresAt: number }} */
let cache = { token: null, expiresAt: 0 }
/** Vercel/Lambda는 cwd 쓰기 불가 — /tmp 사용 */
const TOKEN_CACHE_PATH = path.join(os.tmpdir(), 'kis-token-cache.json')

/**
 * @param {'prod'|'vps'} [env] 지정 시 Supabase 공유 토큰도 무효화
 * @param {string} [badToken] 만료 판정된 토큰 (다른 인스턴스가 갱신한 새 토큰 보호)
 */
function invalidateTokenCache(env, badToken) {
  cache = { token: null, expiresAt: 0 }
  try {
    if (fs.existsSync(TOKEN_CACHE_PATH)) fs.unlinkSync(TOKEN_CACHE_PATH)
  } catch {
    // ignore
  }
  if (env) {
    void invalidateSharedToken(env, badToken)
  }
}

/**
 * @param {Record<string, unknown> | null | undefined} data
 */
function isExpiredTokenError(data) {
  const cd = String(data?.msg_cd ?? '')
  const msg = String(data?.msg1 ?? '')
  return cd === 'EGW00123' || msg.includes('만료된 token')
}

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
  const code = normalizeKisIscd(iscd6)
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

/**
 * 주식현재가 시세 output 에서 외국인 보유/소진율 추출
 * @param {Record<string, unknown>|null|undefined} o
 * @returns {{ rate: number | null, qty: number | null }}
 */
function resolveForeignHoldingFromPriceOutput(o) {
  if (!o || typeof o !== 'object') return { rate: null, qty: null }

  const rateCandidates = [o.hts_frgn_ehrt, o.frgn_hldn_rate, o.frgn_ehrt]
  let rate = null
  for (const c of rateCandidates) {
    const n = num(c)
    if (n != null) {
      rate = n
      break
    }
  }

  if (rate == null) {
    for (const [k, v] of Object.entries(o)) {
      if (!/frgn/i.test(k)) continue
      if (!/(ehrt|hldn_rate|holding|소진)/i.test(k)) continue
      if (/ntby/i.test(k)) continue
      const n = num(v)
      if (n != null && n >= 0 && n <= 100) {
        rate = n
        break
      }
    }
  }

  const qty = num(o.frgn_hldn_qty) ?? num(o.frgn_hldn_vol) ?? null
  return { rate, qty }
}

/** @param {string} code6 @param {Record<string, unknown>|null|undefined} raw */
export function logKisFrgnFields(code6, raw) {
  if (!raw || typeof raw !== 'object') return
  const code = normalizeKisIscd(code6)
  const frgnFields = Object.keys(raw).filter((k) => k.toLowerCase().includes('frgn'))
  console.log(`[KIS ${code}] 외국인 필드:`, frgnFields)
  for (const k of frgnFields) {
    console.log(`  ${k}: ${raw[k]}`)
  }
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

  // 서버리스 인스턴스 간 공유 토큰 (Supabase) — 발급 폭주(EGW00133) 방지
  const shared = await readSharedToken(env === 'prod' ? 'prod' : 'vps')
  if (shared && shared.expiresAt > now + 60_000) {
    cache = shared
    writeTokenCache(shared.token, shared.expiresAt)
    return shared.token
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
      // 다른 인스턴스가 방금 발급한 공유 토큰이 있을 수 있음
      const retryShared = await readSharedToken(env === 'prod' ? 'prod' : 'vps')
      if (retryShared?.token) {
        cache = retryShared
        writeTokenCache(retryShared.token, retryShared.expiresAt)
        return retryShared.token
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
  void writeSharedToken(env === 'prod' ? 'prod' : 'vps', cache.token, cache.expiresAt)
  return token
}

async function kisGet({ appKey, appSecret, env, path, params, trId, kind }) {
  let rateLimitAttempt = 0
  let tokenRefreshAttempt = 0
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
      if (isExpiredTokenError(data) && tokenRefreshAttempt < 2) {
        console.warn(`[KIS] ${kind} token expired (${cd}), refreshing (${tokenRefreshAttempt + 1}/2)`)
        invalidateTokenCache(env === 'prod' ? 'prod' : 'vps', token)
        tokenRefreshAttempt += 1
        continue
      }
      if (cd === 'EGW00201' && rateLimitAttempt < KIS_RATE_LIMIT_MAX_RETRIES) {
        const ms = KIS_RATE_LIMIT_RETRY_MS[rateLimitAttempt] ?? 4000
        console.log(`[KIS] 한도 초과, ${ms}ms 후 재시도 (${rateLimitAttempt + 1}/${KIS_RATE_LIMIT_MAX_RETRIES})`)
        await new Promise((r) => setTimeout(r, ms))
        rateLimitAttempt += 1
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

/**
 * 국내 주식 현재가 시세 [v1_국내주식-008]
 *
 * `marketDiv` 는 KIS 의 시장분류코드다. KRX 단독 `'J'`, 넥스트레이드 단독 `'NX'`,
 * KRX·NXT 통합 `'UN'`. 통합은 양 시장 최우선 체결가 기준이라 표시용 대표가에
 * 가깝고, NXT 프리마켓(08:00~08:50)·애프터마켓(15:30~20:00) 시간대도 값이 잡힌다.
 * 일별 스냅샷처럼 날짜 간 비교 기준을 고정해야 하는 경로는 `'J'` 를 유지해야 한다.
 *
 * @param {string} appKey
 * @param {string} appSecret
 * @param {string} env
 * @param {string} code6
 * @param {{ skipCache?: boolean, marketDiv?: 'J' | 'NX' | 'UN' }} [opts]
 */
export async function inquireDomesticPrice(appKey, appSecret, env, code6, opts = {}) {
  const iscd = normalizeKisIscd(code6)
  const wantedDiv = DOMESTIC_MARKET_DIVS.has(opts.marketDiv) ? opts.marketDiv : 'J'
  // 모의투자처럼 NXT 자체가 막힌 환경에서는 종목마다 2회씩 호출하게 되므로,
  // 실패한 시장분류는 잠시 건너뛰고 KRX 단독으로 바로 간다.
  const requestedDiv = isMarketDivDisabled(env, wantedDiv) ? 'J' : wantedDiv
  const cacheKey = `kis:quote:${env}:${requestedDiv}:${iscd}`

  /** @param {'J' | 'NX' | 'UN'} marketDiv */
  const fetchQuote = async (marketDiv) => {
      const data = await kisGet({
        appKey,
        appSecret,
        env,
        path: '/uapi/domestic-stock/v1/quotations/inquire-price',
        params: {
          FID_COND_MRKT_DIV_CODE: marketDiv,
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
      const { rate: foreignHoldingRate, qty: foreignHoldingQty } = resolveForeignHoldingFromPriceOutput(o)
      if (process.env.KIS_DEBUG_QUOTE === '1') {
        logKisFrgnFields(iscd, o)
      }
      const htsAvls = num(o?.hts_avls)
      let marketCap = null
      if (price != null && listedShares != null && listedShares > 0) {
        marketCap = Math.round(price * listedShares)
      } else if (htsAvls != null && htsAvls > 0) {
        marketCap = Math.round(htsAvls * 1_000_000)
      }

      return {
        code: iscd,
        marketDiv,
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
        foreignHoldingRate,
        foreignHoldingQty,
        foreignNetBuy: num(o?.frgn_ntby_qty),
        raw: o,
      }
  }

  /**
   * NXT 는 상장 종목이 KRX 전 종목이 아니고 모의투자 환경에서도 지원되지 않는다.
   * 통합·NXT 조회가 실패하거나 값이 비면 KRX 단독으로 한 번 더 조회한다.
   */
  const fetchWithFallback = async () => {
    if (requestedDiv === 'J') return await fetchQuote('J')
    try {
      const quote = await fetchQuote(requestedDiv)
      clearMarketDivFailure(env, requestedDiv)
      // NXT 미상장 종목은 오류 대신 0원·거래량 0 을 돌려준다.
      if (!(Number(quote.price) > 0)) return await fetchQuote('J')
      return quote
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.warn(`[KIS] ${iscd} ${requestedDiv} 시세 실패 — KRX 단독으로 폴백: ${msg}`)
      noteMarketDivFailure(env, requestedDiv, msg)
      return await fetchQuote('J')
    }
  }

  if (opts.skipCache) return await fetchWithFallback()
  return await withCache(cacheKey, KIS_CACHE_TTL_QUOTE_MS, fetchWithFallback)
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
  const iscd = normalizeKisIscd(code6)
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

/** 종목별 투자자매매동향(일별) 기간 조회 한 번에 돌려줄 최대 거래일 수 (약 4년) */
const KIS_INVESTOR_RANGE_MAX_DAYS = 1000
/** 한 페이지 크기를 가정하지 않으므로 페이지 수에도 상한을 둔다 (30건씩 와도 1000일을 채운다) */
const KIS_INVESTOR_RANGE_MAX_PAGES = 40

/**
 * [국내주식] 종목별 투자자매매동향(일별) — FHPTJ04160001 기간 조회
 *
 * 현재가 투자자(FHKST01010900)는 최근 30거래일만 주고 날짜 지정이 없다. 이 TR 은 기준일
 * (FID_INPUT_DATE_1)부터 과거 방향으로 여러 거래일을 돌려주므로, 받은 행 중 가장 오래된
 * 날짜의 전날을 새 기준일로 놓고 `start` 에 닿거나 `maxDays` 를 채울 때까지 반복한다.
 * 행의 필드명(frgn/orgn/prsn `_ntby_qty`, `_ntby_tr_pbmn`)과 대금 단위(백만원)는
 * FHKST01010900 과 같아 같은 정규화 함수를 쓸 수 있다.
 *
 * 실전 전용 TR(모의투자 미지원)이라 vps 환경에서는 호출하지 않고 `supported: false` 를 돌려준다.
 * 첫 페이지가 실패하면 예외를 던지고, 중간 페이지가 실패하면 그때까지 받은 행과 `error` 를 돌려준다.
 *
 * @param {string} appKey
 * @param {string} appSecret
 * @param {string} env
 * @param {string} code6
 * @param {{ start: string, end?: string, maxDays?: number }} opts  start/end 는 YYYYMMDD (end 기본 오늘)
 * @returns {Promise<{ rows: Array<Record<string, unknown>>, pages: number, supported: boolean, error: string | null }>}
 *   rows 는 KIS 원본 행, 최신순
 */
export async function inquireInvestorTradeDailyRange(appKey, appSecret, env, code6, opts = {}) {
  const iscd = normalizeKisIscd(code6)
  const start = String(opts.start ?? '')
  const end = /^\d{8}$/.test(String(opts.end ?? '')) ? String(opts.end) : seoulYmd()
  if (!/^\d{8}$/.test(start)) throw new Error('start 는 YYYYMMDD 형식이어야 합니다')
  const maxDays = Math.max(1, Math.min(Number(opts.maxDays) || KIS_INVESTOR_RANGE_MAX_DAYS, KIS_INVESTOR_RANGE_MAX_DAYS))
  if (env !== 'prod') return { rows: [], pages: 0, supported: false, error: null }
  if (start > end) return { rows: [], pages: 0, supported: true, error: null }
  const cacheKey = `kis:investorRange:${env}:${iscd}:${start}:${end}:${maxDays}`
  return await withCache(cacheKey, KIS_CACHE_TTL_ANALYSIS_MS, async () => {
    /** @type {Map<string, Record<string, unknown>>} */
    const byDate = new Map()
    let pageEnd = end
    let pages = 0
    let error = null
    let reached = false
    while (pages < KIS_INVESTOR_RANGE_MAX_PAGES) {
      if (pages > 0) await new Promise((r) => setTimeout(r, dailyPageDelayMs(env)))
      let data
      try {
        data = await kisGet({
          appKey,
          appSecret,
          env,
          path: '/uapi/domestic-stock/v1/quotations/investor-trade-by-stock-daily',
          params: {
            FID_COND_MRKT_DIV_CODE: 'J',
            FID_INPUT_ISCD: iscd,
            FID_INPUT_DATE_1: pageEnd,
            FID_ORG_ADJ_PRC: '',
            FID_ETC_CLS_CODE: '',
          },
          trId: 'FHPTJ04160001',
          kind: 'KIS 투자자 일별동향',
        })
      } catch (e) {
        if (pages === 0) throw e
        error = e instanceof Error ? e.message : String(e)
        break
      }
      pages += 1
      const rows = normalizeKisOutputRows(data.output2).filter((r) => /^\d{8}$/.test(String(r?.stck_bsop_date ?? '')))
      if (!rows.length) { reached = true; break }
      let added = 0
      let oldest = String(rows[0].stck_bsop_date)
      for (const r of rows) {
        const d = String(r.stck_bsop_date)
        if (d < oldest) oldest = d
        if (d < start || d > end) continue
        if (!byDate.has(d)) added += 1
        byDate.set(d, r)
      }
      // 새로 얻은 날이 없거나(기준일을 무시하는 응답 포함) 시작일·상한에 닿으면 멈춘다
      if (added === 0 || oldest <= start || byDate.size >= maxDays) { reached = true; break }
      const prev = ymdToDate(oldest)
      prev.setDate(prev.getDate() - 1)
      pageEnd = ymd(prev)
      if (pageEnd < start) { reached = true; break }
    }
    // 페이지 상한에서 끊겼으면 조용히 잘린 결과로 보이지 않게 알린다
    if (!reached && !error) error = `페이지 상한(${KIS_INVESTOR_RANGE_MAX_PAGES}번)에 닿아 ${pageEnd} 이전은 받지 못했습니다`
    const rows = [...byDate.values()]
      .sort((a, b) => String(b.stck_bsop_date).localeCompare(String(a.stck_bsop_date)))
      .slice(0, maxDays)
    return { rows, pages, supported: true, error }
  })
}

/**
 * 모의투자 미지원 TR 을 vps 환경에서 부르면 KIS 가 뜻 모를 오류를 주므로 호출 전에 막는다.
 * @param {string} env
 * @param {string} label 사용자에게 보일 API 이름
 */
function assertProdOnly(env, label) {
  if (env === 'prod') return
  const err = new Error(`${label}: KIS 실전 계정 전용 API입니다 (서버의 KIS_ENV 가 prod 가 아니라 모의투자 서버로 연결돼 있습니다)`)
  err.code = 'PROD_ONLY'
  throw err
}

/** 서울 기준 오늘 YYYYMMDD — 서버가 UTC 면 00:00~08:59 KST 에 `ymd(new Date())` 가 하루 늦다 */
function seoulYmd(d = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(d).replace(/-/g, '')
}

/** 전일 대비 부호 코드 — 4(하한)·5(하락)인데 값이 양수로 오면 음수로 바꾼다 */
function signedBySignCode(value, signCode) {
  if (value == null) return null
  const sign = String(signCode ?? '').trim()
  return (sign === '4' || sign === '5') && value > 0 ? -value : value
}

/** 종목별 외인기관 추정가집계의 입력구분(bsop_hour_gb) → 입력 시각 */
const INVESTOR_ESTIMATE_SLOT_HHMM = { 1: '0930', 2: '1000', 3: '1120', 4: '1320', 5: '1430' }

/**
 * [국내주식] 종목별 외인기관 추정가집계 — HHPTJ04160200 (실전 전용)
 *
 * 증권사 직원이 장중에 집계·입력한 외국인·기관 순매수 추정치의 누계(주). 입력 시각은
 * 외국인 09:30·11:20·13:20·14:30, 기관 10:00·11:20·13:20·14:30 이고 응답에 날짜는 없다.
 * 확정치는 장 마감 후 `inquireInvestorByStock` / `inquireInvestorTradeDailyRange` 로 본다.
 *
 * @returns {Promise<Array<{ slot: string, hhmm: string | null, foreignNetShares: number | null, institutionNetShares: number | null, sumNetShares: number | null }>>} 입력 시각 오름차순
 */
export async function inquireInvestorTrendEstimate(appKey, appSecret, env, code6) {
  assertProdOnly(env, '종목별 외인기관 추정가집계')
  const iscd = normalizeKisIscd(code6)
  return await withCache(`kis:investorEstimate:${env}:${iscd}`, KIS_CACHE_TTL_QUOTE_MS, async () => {
    const data = await kisGet({
      appKey,
      appSecret,
      env,
      path: '/uapi/domestic-stock/v1/quotations/investor-trend-estimate',
      params: { MKSC_SHRN_ISCD: iscd },
      trId: 'HHPTJ04160200',
      kind: 'KIS 외인기관 추정가집계',
    })
    return normalizeKisOutputRows(data.output2)
      .map((r) => {
        const slot = String(r?.bsop_hour_gb ?? '').trim()
        return {
          slot,
          hhmm: INVESTOR_ESTIMATE_SLOT_HHMM[slot] ?? null,
          foreignNetShares: num(r?.frgn_fake_ntby_qty),
          institutionNetShares: num(r?.orgn_fake_ntby_qty),
          sumNetShares: num(r?.sum_fake_ntby_qty),
        }
      })
      .filter((r) => r.slot)
      .sort((a, b) => Number(a.slot) - Number(b.slot))
  })
}

/** 호가는 빨리 변하므로 현재가보다 짧게 캐시한다 (ms) */
const KIS_CACHE_TTL_ORDERBOOK_MS = 5_000

/**
 * [국내주식] 주식현재가 호가/예상체결 — FHKST01010200
 *
 * 10단계 호가·잔량과 예상체결가를 돌려준다. 예상체결가는 동시호가(08:30~09:00, 15:20~15:30)와
 * 장 종료 후에 의미가 있다 — 15:20 이후에는 그날 종가의 예상값으로 쓸 수 있다.
 *
 * @param {{ marketDiv?: 'J' | 'NX' | 'UN' }} [opts]
 */
export async function inquireAskingPriceExpCcn(appKey, appSecret, env, code6, opts = {}) {
  const iscd = normalizeKisIscd(code6)
  const marketDiv = DOMESTIC_MARKET_DIVS.has(opts.marketDiv) ? opts.marketDiv : 'J'
  return await withCache(`kis:orderbook:${env}:${marketDiv}:${iscd}`, KIS_CACHE_TTL_ORDERBOOK_MS, async () => {
    const data = await kisGet({
      appKey,
      appSecret,
      env,
      path: '/uapi/domestic-stock/v1/quotations/inquire-asking-price-exp-ccn',
      params: { FID_COND_MRKT_DIV_CODE: marketDiv, FID_INPUT_ISCD: iscd },
      trId: 'FHKST01010200',
      kind: 'KIS 호가/예상체결',
    })
    const book = normalizeKisOutputRows(data.output1)[0] ?? {}
    const exp = normalizeKisOutputRows(data.output2)[0] ?? {}
    const levels = (side) =>
      Array.from({ length: 10 }, (_, i) => ({ price: num(book[`${side}${i + 1}`]), qty: num(book[`${side}_rsqn${i + 1}`]) }))
        .filter((l) => l.price != null && l.price > 0)
    const expectedPrice = num(exp.antc_cnpr)
    return {
      marketDiv,
      acceptedAt: normalizeCntgHhmmss(book.aspr_acpt_hour) || null,
      sessionCode: String(book.new_mkop_cls_code ?? '').trim() || null,
      expectedSessionCode: String(exp.antc_mkop_cls_code ?? '').trim() || null,
      asks: levels('askp'),
      bids: levels('bidp'),
      totalAskQty: num(book.total_askp_rsqn),
      totalBidQty: num(book.total_bidp_rsqn),
      price: num(exp.stck_prpr),
      open: num(exp.stck_oprc),
      high: num(exp.stck_hgpr),
      low: num(exp.stck_lwpr),
      basePrice: num(exp.stck_sdpr),
      expected: {
        price: expectedPrice != null && expectedPrice > 0 ? expectedPrice : null,
        change: signedBySignCode(num(exp.antc_cntg_vrss), exp.antc_cntg_vrss_sign),
        changePct: signedBySignCode(num(exp.antc_cntg_prdy_ctrt), exp.antc_cntg_vrss_sign),
        volume: num(exp.antc_vol),
      },
      viCode: String(exp.vi_cls_code ?? '').trim() || null,
    }
  })
}

/** 주식일별분봉조회로 한 번에 돌려줄 최대 봉 수 — 통합(UN) 08:00~20:00 하루치(720분)를 덮는다 */
const KIS_DAILY_MINUTE_MAX_BARS = 800

/**
 * [국내주식] 주식일별분봉조회 — FHKST03010230 (실전 전용, 최대 1년 보관)
 *
 * 지정한 날짜의 1분봉을 `endHhmmss` 부터 과거 방향으로 받는다. 한 번에 최대 120건이라
 * 받은 봉 중 가장 이른 시각의 1분 전을 새 기준 시각으로 놓고 그날 첫 봉에 닿거나
 * `maxBars` 를 채울 때까지 반복한다. 다른 날짜의 봉이 섞여 오면 버리고 멈춘다.
 *
 * @param {{ date: string, endHhmmss?: string, marketDiv?: 'J' | 'NX' | 'UN', maxBars?: number }} opts  date 는 YYYYMMDD
 * @returns {Promise<{ bars: Array<{ date: string, hhmmss: string, price: number, open: number | null, high: number | null, low: number | null, volume: number }>, pages: number }>}
 *   bars 는 시각 오름차순, endHhmmss 이전의 최근 maxBars 개
 */
export async function inquireDailyMinuteBars(appKey, appSecret, env, code6, opts = {}) {
  assertProdOnly(env, '주식일별분봉조회')
  const iscd = normalizeKisIscd(code6)
  const date = String(opts.date ?? '')
  if (!/^\d{8}$/.test(date)) throw new Error('date 는 YYYYMMDD 형식이어야 합니다')
  const marketDiv = DOMESTIC_MARKET_DIVS.has(opts.marketDiv) ? opts.marketDiv : 'J'
  let end = /^\d{6}$/.test(String(opts.endHhmmss ?? '')) ? String(opts.endHhmmss) : marketDiv === 'J' ? '153000' : '200000'
  const maxBars = Math.max(1, Math.min(Number(opts.maxBars) || 400, KIS_DAILY_MINUTE_MAX_BARS))
  const maxPages = Math.ceil(maxBars / 100) + 2
  // 당일은 아직 오지 않은 시각을 물으면 현재가로 채운 가짜 봉이 올 수 있고 봉이 계속 늘어난다 —
  // 현재 시각까지만 묻고 시세처럼 짧게 캐시한다. 미래 날짜는 부르지 않는다.
  const today = seoulYmd()
  if (date > today) return { bars: [], pages: 0 }
  const live = date === today
  if (live) {
    const now = seoulNowHhmm00()
    if (hhmmssToNum(end) > hhmmssToNum(now)) end = now
  }
  const cacheKey = `kis:dailyMinute:${env}:${marketDiv}:${iscd}:${date}:${end}:${maxBars}`
  return await withCache(cacheKey, live ? KIS_CACHE_TTL_QUOTE_MS : KIS_CACHE_TTL_ANALYSIS_MS, async () => {
    /** @type {Map<string, any>} */
    const byTime = new Map()
    let pageEnd = end
    let pages = 0
    while (pages < maxPages) {
      if (pages > 0) await new Promise((r) => setTimeout(r, dailyPageDelayMs(env)))
      const data = await kisGet({
        appKey,
        appSecret,
        env,
        path: '/uapi/domestic-stock/v1/quotations/inquire-time-dailychartprice',
        params: {
          FID_COND_MRKT_DIV_CODE: marketDiv,
          FID_INPUT_ISCD: iscd,
          FID_INPUT_HOUR_1: pageEnd,
          FID_INPUT_DATE_1: date,
          FID_PW_DATA_INCU_YN: 'Y',
          FID_FAKE_TICK_INCU_YN: '',
        },
        trId: 'FHKST03010230',
        kind: 'KIS 일별분봉',
      })
      pages += 1
      const rows = normalizeKisOutputRows(data.output2)
      if (!rows.length) break
      let added = 0
      let otherDate = false
      let oldest = null
      for (const r of rows) {
        const hhmmss = normalizeCntgHhmmss(r?.stck_cntg_hour || '')
        const price = num(r?.stck_prpr)
        if (!hhmmss || price == null) continue
        if (String(r.stck_bsop_date ?? '') !== date) {
          otherDate = true
          continue
        }
        if (hhmmssToNum(hhmmss) > hhmmssToNum(end)) continue
        if (oldest == null || hhmmssToNum(hhmmss) < hhmmssToNum(oldest)) oldest = hhmmss
        if (!byTime.has(hhmmss)) added += 1
        byTime.set(hhmmss, {
          date,
          hhmmss,
          price: Math.round(price),
          open: num(r.stck_oprc),
          high: num(r.stck_hgpr),
          low: num(r.stck_lwpr),
          volume: Math.max(0, num(r.cntg_vol) ?? 0),
        })
      }
      // 그날 봉을 새로 못 얻었거나 전날 봉이 섞여 왔으면(그날 첫 봉을 지났다) 멈춘다
      if (added === 0 || otherDate || oldest == null || byTime.size >= maxBars) break
      const prev = prevMinuteHhmmss(oldest)
      if (prev === oldest || prev === '000000') break
      pageEnd = prev
    }
    const bars = [...byTime.values()].sort((a, b) => hhmmssToNum(a.hhmmss) - hhmmssToNum(b.hhmmss)).slice(-maxBars)
    return { bars, pages }
  })
}

/**
 * [국내주식] 국내휴장일조회 — CTCA0903R (실전 전용)
 *
 * 기준일부터 앞으로 약 3~4주의 개장일·영업일·결제일 여부를 돌려준다. KIS 원장과 연결된
 * 서비스라 "가급적 1일 1회" 호출이 권고된다 — 이 함수는 캐시하지 않으므로 호출하는 쪽에서
 * 반드시 하루 단위로 캐시한다.
 *
 * @param {string} baseDate YYYYMMDD
 * @returns {Promise<Array<{ date: string, weekdayCode: string, businessDay: boolean, tradingDay: boolean, marketOpen: boolean, settlementDay: boolean }>>} 날짜 오름차순
 */
export async function inquireMarketHolidays(appKey, appSecret, env, baseDate) {
  assertProdOnly(env, '국내휴장일조회')
  const base = String(baseDate ?? '')
  if (!/^\d{8}$/.test(base)) throw new Error('baseDate 는 YYYYMMDD 형식이어야 합니다')
  const data = await kisGet({
    appKey,
    appSecret,
    env,
    path: '/uapi/domestic-stock/v1/quotations/chk-holiday',
    params: { BASS_DT: base, CTX_AREA_NK: '', CTX_AREA_FK: '' },
    trId: 'CTCA0903R',
    kind: 'KIS 휴장일',
  })
  return normalizeKisOutputRows(data.output)
    .map((r) => ({
      date: String(r?.bass_dt ?? '').trim(),
      weekdayCode: String(r?.wday_dvsn_cd ?? '').trim(),
      businessDay: r?.bzdy_yn === 'Y',
      tradingDay: r?.tr_day_yn === 'Y',
      marketOpen: r?.opnd_yn === 'Y',
      settlementDay: r?.sttl_day_yn === 'Y',
    }))
    .filter((r) => /^\d{8}$/.test(r.date))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** 업종 지수 기간 조회로 돌려줄 최대 일봉 수 (약 6년) */
const KIS_INDEX_RANGE_MAX_BARS = 1500

/**
 * [국내주식] 국내주식업종기간별시세(일) — FHKUP03500100 기간 조회
 *
 * 한 번에 최대 50건이라 받은 봉 중 가장 오래된 날짜의 전날을 새 종료일로 놓고 `start` 에
 * 닿거나 `maxBars` 를 채울 때까지 반복한다. 지수 거래량은 천주, 거래대금은 백만원 단위로
 * 오므로 주·원으로 환산해 돌려준다.
 *
 * @param {string} indexCode 업종코드 4자리 (0001 코스피, 1001 코스닥, 2001 코스피200)
 * @param {{ start: string, end?: string, maxBars?: number }} opts  start/end 는 YYYYMMDD
 * @returns {Promise<{ name: string | null, bars: Array<{ date: string, open: number | null, high: number | null, low: number | null, close: number, volume: number | null, tradingValueKrw: number | null }>, pages: number }>} bars 는 날짜 오름차순
 */
export async function inquireIndexDailyBarsRange(appKey, appSecret, env, indexCode, opts = {}) {
  const code = String(indexCode ?? '').trim()
  if (!/^\d{4}$/.test(code)) throw new Error('업종코드는 4자리 숫자여야 합니다')
  const start = String(opts.start ?? '')
  const end = /^\d{8}$/.test(String(opts.end ?? '')) ? String(opts.end) : seoulYmd()
  if (!/^\d{8}$/.test(start)) throw new Error('start 는 YYYYMMDD 형식이어야 합니다')
  if (start > end) throw new Error('start 가 end 보다 늦습니다')
  const maxBars = Math.max(1, Math.min(Number(opts.maxBars) || KIS_INDEX_RANGE_MAX_BARS, KIS_INDEX_RANGE_MAX_BARS))
  const maxPages = Math.ceil(maxBars / 50) + 2
  const cacheKey = `kis:indexRange:${env}:${code}:${start}:${end}:${maxBars}`
  return await withCache(cacheKey, KIS_CACHE_TTL_ANALYSIS_MS, async () => {
    /** @type {Map<string, any>} */
    const byDate = new Map()
    let name = null
    let pageEnd = end
    let pages = 0
    while (pages < maxPages) {
      if (pages > 0) await new Promise((r) => setTimeout(r, dailyPageDelayMs(env)))
      const data = await kisGet({
        appKey,
        appSecret,
        env,
        path: '/uapi/domestic-stock/v1/quotations/inquire-daily-indexchartprice',
        params: {
          FID_COND_MRKT_DIV_CODE: 'U',
          FID_INPUT_ISCD: code,
          FID_INPUT_DATE_1: start,
          FID_INPUT_DATE_2: pageEnd,
          FID_PERIOD_DIV_CODE: 'D',
        },
        trId: 'FHKUP03500100',
        kind: 'KIS 업종 기간차트',
      })
      pages += 1
      name = name ?? (String(normalizeKisOutputRows(data.output1)[0]?.hts_kor_isnm ?? '').trim() || null)
      let added = 0
      let oldest = null
      for (const r of normalizeKisOutputRows(data.output2)) {
        const d = String(r?.stck_bsop_date ?? '')
        const close = num(r?.bstp_nmix_prpr)
        if (!/^\d{8}$/.test(d) || close == null) continue
        if (oldest == null || d < oldest) oldest = d
        if (d < start || d > end) continue
        if (!byDate.has(d)) added += 1
        const vol = num(r.acml_vol)
        const amt = num(r.acml_tr_pbmn)
        byDate.set(d, {
          date: d,
          open: num(r.bstp_nmix_oprc),
          high: num(r.bstp_nmix_hgpr),
          low: num(r.bstp_nmix_lwpr),
          close,
          volume: vol == null ? null : vol * 1000,
          tradingValueKrw: amt == null ? null : amt * 1_000_000,
        })
      }
      if (added === 0 || oldest == null || oldest <= start || byDate.size >= maxBars) break
      const prev = ymdToDate(oldest)
      prev.setDate(prev.getDate() - 1)
      pageEnd = ymd(prev)
      if (pageEnd < start) break
    }
    const bars = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-maxBars)
    return { name, bars, pages }
  })
}

/** 종목투자의견 기간 조회로 돌려줄 최대 건수 */
const KIS_INVEST_OPINION_MAX_ROWS = 300

/**
 * [국내주식] 국내주식 종목투자의견 — FHKST663300C0 (실전 전용)
 *
 * 증권사별 투자의견·목표가 이력. 한 번에 최대 100건(최신순)이라 받은 행 중 가장 오래된
 * 날짜의 전날을 새 종료일로 놓고 반복한다.
 *
 * @param {{ start: string, end?: string, maxRows?: number }} opts  start/end 는 YYYYMMDD
 * @returns {Promise<{ rows: Array<{ date: string, broker: string, opinion: string | null, prevOpinion: string | null, targetPrice: number | null, prevClose: number | null }>, pages: number }>} rows 는 최신순
 */
export async function inquireInvestOpinions(appKey, appSecret, env, code6, opts = {}) {
  assertProdOnly(env, '종목투자의견')
  const iscd = normalizeKisIscd(code6)
  const start = String(opts.start ?? '')
  const end = /^\d{8}$/.test(String(opts.end ?? '')) ? String(opts.end) : seoulYmd()
  if (!/^\d{8}$/.test(start)) throw new Error('start 는 YYYYMMDD 형식이어야 합니다')
  if (start > end) throw new Error('start 가 end 보다 늦습니다')
  const maxRows = Math.max(1, Math.min(Number(opts.maxRows) || 100, KIS_INVEST_OPINION_MAX_ROWS))
  const maxPages = Math.ceil(maxRows / 100) + 2
  const cacheKey = `kis:investOpinion:${env}:${iscd}:${start}:${end}:${maxRows}`
  return await withCache(cacheKey, KIS_CACHE_TTL_ANALYSIS_MS, async () => {
    /** @type {Map<string, any>} */
    const seen = new Map()
    let pageEnd = end
    let pages = 0
    while (pages < maxPages) {
      if (pages > 0) await new Promise((r) => setTimeout(r, dailyPageDelayMs(env)))
      const data = await kisGet({
        appKey,
        appSecret,
        env,
        path: '/uapi/domestic-stock/v1/quotations/invest-opinion',
        params: {
          FID_COND_MRKT_DIV_CODE: 'J',
          FID_COND_SCR_DIV_CODE: '16633',
          FID_INPUT_ISCD: iscd,
          FID_INPUT_DATE_1: start,
          FID_INPUT_DATE_2: pageEnd,
        },
        trId: 'FHKST663300C0',
        kind: 'KIS 종목투자의견',
      })
      pages += 1
      const rows = normalizeKisOutputRows(data.output)
      let added = 0
      let oldest = null
      let newest = null
      for (const r of rows) {
        const d = String(r?.stck_bsop_date ?? '')
        if (!/^\d{8}$/.test(d)) continue
        if (oldest == null || d < oldest) oldest = d
        if (newest == null || d > newest) newest = d
        if (d < start || d > end) continue
        const broker = String(r.mbcr_name ?? '').trim()
        const target = num(r.hts_goal_prc)
        const key = `${d}|${broker}|${target ?? ''}|${String(r.invt_opnn ?? '').trim()}`
        if (seen.has(key)) continue
        added += 1
        seen.set(key, {
          date: d,
          broker,
          opinion: String(r.invt_opnn ?? '').trim() || null,
          prevOpinion: String(r.rgbf_invt_opnn ?? '').trim() || null,
          targetPrice: target != null && target > 0 ? target : null,
          prevClose: num(r.stck_prdy_clpr),
        })
      }
      if (added === 0 || rows.length < 100 || oldest == null || oldest <= start || seen.size >= maxRows) break
      // 같은 날 여러 증권사 보고서가 페이지 경계에 걸리면 잘린다 — 가장 오래된 날짜를 다시 받고 중복은 버린다.
      // 한 페이지가 통째로 같은 날이면 그 날짜를 다시 물어도 같은 100건이라 하루 물러난다.
      if (oldest === newest) {
        const prev = ymdToDate(oldest)
        prev.setDate(prev.getDate() - 1)
        pageEnd = ymd(prev)
      } else {
        pageEnd = oldest
      }
      if (pageEnd < start) break
    }
    const rows = [...seen.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, maxRows)
    return { rows, pages }
  })
}

/**
 * [국내주식] 국내주식 종목추정실적 — HHKST668300C0 (실전 전용)
 *
 * 한국투자증권 리서치가 매월 내는 약 160개 기업의 추정 손익·투자지표 (시장 컨센서스가 아니다).
 * 응답은 표 모양 그대로다: output4 가 결산연월(열), output2 가 손익 6행, output3 가 지표 8행.
 * 해석은 호출하는 쪽에서 한다.
 */
export async function inquireEstimatePerform(appKey, appSecret, env, code6) {
  assertProdOnly(env, '종목추정실적')
  const iscd = normalizeKisIscd(code6)
  return await withCache(`kis:estimatePerform:${env}:${iscd}`, KIS_CACHE_TTL_ANALYSIS_MS, async () => {
    const data = await kisGet({
      appKey,
      appSecret,
      env,
      path: '/uapi/domestic-stock/v1/quotations/estimate-perform',
      params: { SHT_CD: iscd },
      trId: 'HHKST668300C0',
      kind: 'KIS 종목추정실적',
    })
    return {
      header: normalizeKisOutputRows(data.output1)[0] ?? null,
      income: normalizeKisOutputRows(data.output2),
      indicators: normalizeKisOutputRows(data.output3),
      periods: normalizeKisOutputRows(data.output4).map((r) => String(r?.dt ?? '').trim()),
    }
  })
}

const MARKET_CAP_RANK_ISCD = { ALL: '0000', KOSPI: '0001', KOSDAQ: '1001', KOSPI200: '2001' }
const MARKET_CAP_RANK_SHARE_CLASS = { all: '0', common: '1', preferred: '2' }
/** 시가총액 상위 `stck_avls` 단위(억원) → 원 */
const MARKET_CAP_RANK_UNIT_KRW = 100_000_000

/**
 * [국내주식] 순위분석 > 국내주식 시가총액 상위 — FHPST01740000 (실전 전용), HTS [0174]
 *
 * 한 번에 최대 30건이고 다음 조회가 없다. 더 넓게 보려면 시장(KOSPI·KOSDAQ)이나 주식 종류를
 * 나눠 부른다. 요청 파라미터 이름은 공식 예제대로 소문자다.
 *
 * @param {string} appKey
 * @param {string} appSecret
 * @param {'prod'|'vps'} env
 * @param {{ market?: 'ALL'|'KOSPI'|'KOSDAQ'|'KOSPI200', shareClass?: 'all'|'common'|'preferred' }} [opts]
 * @returns {Promise<Array<{ rank: number, code: string, name: string, price: number | null, change: number | null, changePct: number | null, volume: number | null, listedShares: number | null, marketCapKrw: number | null, marketWeightPct: number | null }>>}
 */
export async function inquireMarketCapRank(appKey, appSecret, env, opts = {}) {
  assertProdOnly(env, '시가총액 상위')
  const market = String(opts.market ?? 'ALL').toUpperCase()
  const iscd = MARKET_CAP_RANK_ISCD[market]
  if (!iscd) throw new Error('market 은 ALL · KOSPI · KOSDAQ · KOSPI200 중 하나여야 합니다')
  const div = MARKET_CAP_RANK_SHARE_CLASS[String(opts.shareClass ?? 'all')]
  if (div == null) throw new Error('shareClass 는 all · common · preferred 중 하나여야 합니다')
  return await withCache(`kis:marketCapRank:${env}:${iscd}:${div}`, KIS_CACHE_TTL_QUOTE_MS, async () => {
    const data = await kisGet({
      appKey,
      appSecret,
      env,
      path: '/uapi/domestic-stock/v1/ranking/market-cap',
      params: {
        fid_input_price_2: '',
        fid_cond_mrkt_div_code: 'J',
        fid_cond_scr_div_code: '20174',
        fid_div_cls_code: div,
        fid_input_iscd: iscd,
        fid_trgt_cls_code: '0',
        fid_trgt_exls_cls_code: '0',
        fid_input_price_1: '',
        fid_vol_cnt: '',
      },
      trId: 'FHPST01740000',
      kind: 'KIS 시가총액 상위',
    })
    return normalizeKisOutputRows(data.output)
      .map((r, i) => {
        const cap = num(r?.stck_avls)
        return {
          rank: num(r?.data_rank) ?? i + 1,
          code: normalizeKisIscd(r?.mksc_shrn_iscd ?? ''),
          name: typeof r?.hts_kor_isnm === 'string' ? r.hts_kor_isnm.trim() : '',
          price: num(r?.stck_prpr),
          change: signedBySignCode(num(r?.prdy_vrss), r?.prdy_vrss_sign),
          changePct: signedBySignCode(num(r?.prdy_ctrt), r?.prdy_vrss_sign),
          volume: num(r?.acml_vol),
          listedShares: num(r?.lstn_stcn),
          marketCapKrw: cap == null ? null : cap * MARKET_CAP_RANK_UNIT_KRW,
          marketWeightPct: num(r?.mrkt_whol_avls_rlim),
        }
      })
      .filter((r) => r.code)
  })
}

const FLOW_RANK_ISCD = { ALL: '0000', KOSPI: '0001', KOSDAQ: '1001' }
const FLOW_RANK_INVESTOR = { all: '0', foreign: '1', institution: '2' }
/** 가집계 응답의 기관 세부 주체·기타법인 — [수량 필드, 금액 필드] */
const FLOW_RANK_PARTS = {
  investmentTrust: ['ivtr_ntby_qty', 'ivtr_ntby_tr_pbmn'],
  bank: ['bank_ntby_qty', 'bank_ntby_tr_pbmn'],
  insurance: ['insu_ntby_qty', 'insu_ntby_tr_pbmn'],
  merchantBank: ['mrbn_ntby_qty', 'mrbn_ntby_tr_pbmn'],
  pensionFund: ['fund_ntby_qty', 'fund_ntby_tr_pbmn'],
  otherInstitution: ['etc_orgt_ntby_vol', 'etc_orgt_ntby_tr_pbmn'],
  otherCorporation: ['etc_corp_ntby_vol', 'etc_corp_ntby_tr_pbmn'],
}

/**
 * [국내주식] 시세분석 > 국내기관_외국인 매매종목가집계 — FHPTJ04400000 (실전 전용), HTS [0440]
 *
 * 증권사 직원이 장중에 집계·입력한 값의 누계(가집계)라 확정 수급이 아니고 당일치만 있다.
 * 입력 시각은 외국인 09:30·11:20·13:20·14:30, 기관 10:00·11:20·13:20·14:30 (±10분).
 * 금액 필드는 백만원(수량×현재가)이라 원으로 바꿔 돌려준다. 응답 필드를 그대로 옮기며 기관계는
 * KIS 가 주는 `orgn_*` 값을 쓴다(세부 주체 합산은 하지 않는다). 순서는 KIS 가 준 그대로다.
 *
 * @param {string} appKey
 * @param {string} appSecret
 * @param {'prod'|'vps'} env
 * @param {{ market?: 'ALL'|'KOSPI'|'KOSDAQ', investor?: 'all'|'foreign'|'institution', side?: 'buy'|'sell', sortBy?: 'amount'|'shares' }} [opts]
 */
export async function inquireForeignInstitutionRank(appKey, appSecret, env, opts = {}) {
  assertProdOnly(env, '기관·외국인 매매종목 가집계')
  const market = String(opts.market ?? 'ALL').toUpperCase()
  const iscd = FLOW_RANK_ISCD[market]
  if (!iscd) throw new Error('market 은 ALL · KOSPI · KOSDAQ 중 하나여야 합니다')
  const investor = FLOW_RANK_INVESTOR[String(opts.investor ?? 'all')]
  if (investor == null) throw new Error('investor 는 all · foreign · institution 중 하나여야 합니다')
  const side = String(opts.side ?? 'buy')
  if (side !== 'buy' && side !== 'sell') throw new Error('side 는 buy · sell 중 하나여야 합니다')
  const sortBy = String(opts.sortBy ?? 'amount')
  if (sortBy !== 'amount' && sortBy !== 'shares') throw new Error('sortBy 는 amount · shares 중 하나여야 합니다')
  const amount = (v) => {
    const n = num(v)
    return n == null ? null : n * INVESTOR_AMOUNT_UNIT_KRW
  }
  return await withCache(`kis:flowRank:${env}:${iscd}:${investor}:${side}:${sortBy}`, KIS_CACHE_TTL_QUOTE_MS, async () => {
    const data = await kisGet({
      appKey,
      appSecret,
      env,
      path: '/uapi/domestic-stock/v1/quotations/foreign-institution-total',
      params: {
        FID_COND_MRKT_DIV_CODE: 'V',
        FID_COND_SCR_DIV_CODE: '16449',
        FID_INPUT_ISCD: iscd,
        FID_DIV_CLS_CODE: sortBy === 'shares' ? '0' : '1',
        FID_RANK_SORT_CLS_CODE: side === 'sell' ? '1' : '0',
        FID_ETC_CLS_CODE: investor,
      },
      trId: 'FHPTJ04400000',
      kind: 'KIS 기관·외국인 가집계',
    })
    return normalizeKisOutputRows(data.output ?? data.Output)
      .map((r) => ({
        code: normalizeKisIscd(r?.mksc_shrn_iscd ?? ''),
        name: typeof r?.hts_kor_isnm === 'string' ? r.hts_kor_isnm.trim() : '',
        price: num(r?.stck_prpr),
        change: signedBySignCode(num(r?.prdy_vrss), r?.prdy_vrss_sign),
        changePct: signedBySignCode(num(r?.prdy_ctrt), r?.prdy_vrss_sign),
        volume: num(r?.acml_vol),
        netShares: num(r?.ntby_qty),
        foreignNetShares: num(r?.frgn_ntby_qty),
        foreignNetAmountKrw: amount(r?.frgn_ntby_tr_pbmn),
        institutionNetShares: num(r?.orgn_ntby_qty),
        institutionNetAmountKrw: amount(r?.orgn_ntby_tr_pbmn),
        parts: Object.fromEntries(
          Object.entries(FLOW_RANK_PARTS).map(([name, [qty, amt]]) => [name, { netShares: num(r?.[qty]), netAmountKrw: amount(r?.[amt]) }]),
        ),
      }))
      .filter((r) => r.code)
  })
}

async function inquireDailyChart(appKey, appSecret, env, code6, tf) {
  const bars = await inquireDailyBars(appKey, appSecret, env, code6, Math.max(toTfCount(tf), 5))
  return bars.slice(-toTfCount(tf))
}

/**
 * 기간별시세 페이지 사이 대기 (ms) — KIS 유량 한도(EGW00201) 회피용.
 * 실전은 초당 20건, 모의(vps)는 초당 2건이라 모의는 더 길게 쉰다.
 * @param {string} env
 */
function dailyPageDelayMs(env) {
  return env === 'prod' ? 350 : 600
}
/** 기간 조회 한 번에 돌려줄 최대 일봉 수 (약 6년) */
const KIS_DAILY_RANGE_MAX_BARS = 1500

/**
 * FHKST03010100 output2 → 일봉 배열 (오름차순 ts).
 * @param {unknown} output2
 */
function parseDailyChartRows(output2) {
  const rows = Array.isArray(output2) ? output2 : []
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
  return parsed
}

/** @param {string} yyyymmdd */
function ymdToDate(yyyymmdd) {
  const s = String(yyyymmdd)
  return new Date(Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, Number(s.slice(6, 8)))
}

/**
 * 일봉 기간 조회 — 페이지를 거슬러 올라가며 이어 붙인다.
 *
 * KIS 기간별시세(FHKST03010100)는 한 번에 최대 100건만 돌려준다. 받은 봉 중 가장
 * 오래된 날짜의 전날을 새 종료일로 놓고 `start` 에 닿거나 `maxBars` 를 채울 때까지
 * 반복한다. 페이지 사이에 잠시 쉬어 유량 한도를 피한다.
 *
 * @param {string} appKey
 * @param {string} appSecret
 * @param {string} env
 * @param {string} code6
 * @param {{ start: string, end?: string, adjusted?: boolean, maxBars?: number }} opts
 *   start/end 는 YYYYMMDD. adjusted=true 면 수정주가(FID_ORG_ADJ_PRC '0'), 기본은 원주가('1').
 * @returns {Promise<{ bars: Array<{label:string, price:number, ts:string, open:number, high:number, low:number, volume:number}>, pages: number }>}
 */
export async function inquireDailyBarsRange(appKey, appSecret, env, code6, opts = {}) {
  const iscd = normalizeKisIscd(code6)
  const start = String(opts.start ?? '')
  const end = /^\d{8}$/.test(String(opts.end ?? '')) ? String(opts.end) : ymd(new Date())
  if (!/^\d{8}$/.test(start)) throw new Error('start 는 YYYYMMDD 형식이어야 합니다')
  if (start > end) throw new Error('start 가 end 보다 늦습니다')
  const adjusted = opts.adjusted === true
  const maxBars = Math.max(1, Math.min(Number(opts.maxBars) || KIS_DAILY_RANGE_MAX_BARS, KIS_DAILY_RANGE_MAX_BARS))
  const maxPages = Math.ceil(maxBars / 100) + 1
  const cacheKey = `kis:dailyRange:${env}:${iscd}:${start}:${end}:${adjusted ? 'adj' : 'raw'}:${maxBars}`
  return await withCache(cacheKey, KIS_CACHE_TTL_ANALYSIS_MS, async () => {
    /** @type {Map<string, any>} */
    const byDate = new Map()
    let pageEnd = end
    let pages = 0
    while (pages < maxPages) {
      if (pages > 0) await new Promise((r) => setTimeout(r, dailyPageDelayMs(env)))
      const data = await kisGet({
        appKey,
        appSecret,
        env,
        path: '/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice',
        params: {
          FID_COND_MRKT_DIV_CODE: 'J',
          FID_INPUT_ISCD: iscd,
          FID_INPUT_DATE_1: start,
          FID_INPUT_DATE_2: pageEnd,
          FID_PERIOD_DIV_CODE: 'D',
          FID_ORG_ADJ_PRC: adjusted ? '0' : '1',
        },
        trId: 'FHKST03010100',
        kind: 'KIS 기간차트',
      })
      pages += 1
      const rows = parseDailyChartRows(data.output2)
      if (!rows.length) break
      let added = 0
      for (const r of rows) {
        if (!byDate.has(r.ts)) added += 1
        byDate.set(r.ts, r)
      }
      const oldest = rows[0].ts
      // 100건 미만이면 그 구간에 더 이상 봉이 없다 (KIS 는 구간 내 최근 100건까지 돌려준다)
      if (added === 0 || rows.length < 100 || oldest <= start || byDate.size >= maxBars) break
      const prev = ymdToDate(oldest)
      prev.setDate(prev.getDate() - 1)
      pageEnd = ymd(prev)
      if (pageEnd < start) break
    }
    const bars = [...byDate.values()]
      .filter((r) => r.ts >= start && r.ts <= end)
      .sort((a, b) => String(a.ts).localeCompare(String(b.ts)))
      .slice(-maxBars)
    return { bars, pages }
  })
}

/**
 * 일봉 종가 시계열 (최근 maxBars개, 오름차순 ts).
 * [국내주식] 기간별시세(일) — FHKST03010100
 */
export async function inquireDailyBars(appKey, appSecret, env, code6, maxBars = 60) {
  const iscd = normalizeKisIscd(code6)
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

      const parsed = parseDailyChartRows(data.output2)

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
  const iscd = normalizeKisIscd(code6)
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

/** 이미 지나간 분봉 묶음은 값이 바뀌지 않으므로 길게 캐시한다 (ms) */
const KIS_CACHE_TTL_SETTLED_BARS_MS = 6 * 60 * 60_000

/**
 * 당일 1분봉 30개 — `endHhmmss` 직전 30분 구간. 요청 시각이 미래면 현재까지만 온다.
 * `marketDiv: 'UN'` 으로 부르면 NXT 프리마켓·애프터마켓 체결도 잡힌다.
 * @param {string} appKey
 * @param {string} appSecret
 * @param {string} env
 * @param {string} code6
 * @param {{ endHhmmss?: string, marketDiv?: 'J' | 'NX' | 'UN', settled?: boolean }} [opts]
 * @returns {Promise<Array<{ hhmmss: string, price: number, volume: number }>>}
 */
export async function inquireMinuteBars(appKey, appSecret, env, code6, opts = {}) {
  const iscd = normalizeKisIscd(code6)
  const marketDiv = DOMESTIC_MARKET_DIVS.has(opts.marketDiv) ? opts.marketDiv : 'J'
  const end = /^\d{6}$/.test(String(opts.endHhmmss ?? ''))
    ? String(opts.endHhmmss)
    : seoulNowHhmm00()
  const cacheKey = `kis:minbars:${env}:${marketDiv}:${iscd}:${end}`
  const ttl = opts.settled ? KIS_CACHE_TTL_SETTLED_BARS_MS : KIS_CACHE_TTL_QUOTE_MS

  return await withCache(cacheKey, ttl, async () => {
    const data = await kisGet({
      appKey,
      appSecret,
      env,
      path: '/uapi/domestic-stock/v1/quotations/inquire-time-itemchartprice',
      params: {
        FID_COND_MRKT_DIV_CODE: marketDiv,
        FID_INPUT_ISCD: iscd,
        FID_INPUT_HOUR_1: end,
        FID_PW_DATA_INCU_YN: 'Y',
        FID_ETC_CLS_CODE: '',
      },
      trId: 'FHKST03010200',
      kind: 'KIS 당일분봉',
    })

    const rows = Array.isArray(data.output2) ? data.output2 : []
    return rows
      .map((r) => {
        const hhmmss = normalizeCntgHhmmss(r.stck_cntg_hour || r.cntg_hour || '')
        const price = num(r.stck_prpr)
        if (!hhmmss || price == null) return null
        return {
          date: r.stck_bsop_date || null,
          hhmmss, price: Math.round(price),
          open: num(r.stck_oprc), high: num(r.stck_hgpr), low: num(r.stck_lwpr),
          volume: Math.max(0, num(r.cntg_vol) ?? 0),
        }
      })
      .filter(Boolean)
      .sort((a, b) => hhmmssToNum(a.hhmmss) - hhmmssToNum(b.hhmmss))
  })
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
      const code = normalizeKisIscd(r.mksc_shrn_iscd ?? '')
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
  const iscd = normalizeKisIscd(code6)
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
  const iscd = normalizeKisIscd(code6)
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

/** KIS [0440] 기관계 하위 필드 합산 (FID_ETC_CLS 2/3 단독 호출은 output 0건) */
const INSTITUTION_QTY_KEYS = [
  'orgn_ntby_qty',
  'bank_ntby_qty',
  'insu_ntby_qty',
  'mrbn_ntby_qty',
  'fund_ntby_qty',
  'etc_orgt_ntby_vol',
]
const INSTITUTION_AMT_KEYS = [
  'orgn_ntby_tr_pbmn',
  'bank_ntby_tr_pbmn',
  'insu_ntby_tr_pbmn',
  'mrbn_ntby_tr_pbmn',
  'fund_ntby_tr_pbmn',
  'etc_orgt_ntby_tr_pbmn',
]

/**
 * @param {Record<string, unknown>} row
 * @param {string[]} keys
 */
function sumRowFields(row, keys) {
  let total = 0
  for (const k of keys) {
    total += num(row[k]) ?? 0
  }
  return total
}

/**
 * @param {Record<string, unknown>} row
 * @param {'foreign'|'institution'|'individual'} investorType
 */
function topFlowNetQty(row, investorType) {
  if (investorType === 'foreign') return num(row.frgn_ntby_qty) ?? 0
  if (investorType === 'institution') return sumRowFields(row, INSTITUTION_QTY_KEYS)
  const ivtr = num(row.ivtr_ntby_qty)
  if (ivtr != null && ivtr !== 0) return ivtr
  const total = num(row.ntby_qty) ?? 0
  const frgn = num(row.frgn_ntby_qty) ?? 0
  const inst = sumRowFields(row, INSTITUTION_QTY_KEYS)
  const etcCorp = num(row.etc_corp_ntby_vol) ?? 0
  if (etcCorp !== 0) return etcCorp
  return total - frgn - inst
}

/**
 * @param {Record<string, unknown>} row
 * @param {'foreign'|'institution'|'individual'} investorType
 */
function topFlowNetAmtKrw(row, investorType) {
  if (investorType === 'foreign') {
    return (num(row.frgn_ntby_tr_pbmn) ?? 0) * INVESTOR_AMOUNT_UNIT_KRW
  }
  if (investorType === 'institution') {
    return sumRowFields(row, INSTITUTION_AMT_KEYS) * INVESTOR_AMOUNT_UNIT_KRW
  }
  const ivtrAmt = (num(row.ivtr_ntby_tr_pbmn) ?? 0) * INVESTOR_AMOUNT_UNIT_KRW
  if (ivtrAmt !== 0) return ivtrAmt
  const etcCorpAmt = (num(row.etc_corp_ntby_tr_pbmn) ?? 0) * INVESTOR_AMOUNT_UNIT_KRW
  if (etcCorpAmt !== 0) return etcCorpAmt
  const totalAmt =
    (num(row.frgn_ntby_tr_pbmn) ?? 0) * INVESTOR_AMOUNT_UNIT_KRW +
    sumRowFields(row, INSTITUTION_AMT_KEYS) * INVESTOR_AMOUNT_UNIT_KRW
  const price = num(row.stck_prpr) ?? 0
  const residualQty = topFlowNetQty(row, 'individual')
  if (totalAmt > 0 && residualQty !== 0) {
    return Math.max(0, (num(row.ntby_qty) ?? 0) * price - totalAmt)
  }
  return residualQty * price
}

/**
 * @param {Record<string, unknown>} row
 * @param {number} idx
 * @param {'foreign'|'institution'|'individual'} investorType
 */
function mapTopFlowRow(row, idx, investorType) {
  const code = normalizeKisIscd(row.mksc_shrn_iscd ?? row.stck_shrn_iscd ?? '')
  const name = typeof row.hts_kor_isnm === 'string' ? row.hts_kor_isnm.trim() : ''
  return {
    rank: idx + 1,
    code,
    name,
    currentPrice: num(row.stck_prpr),
    changePct: num(row.prdy_ctrt),
    amount: topFlowNetQty(row, investorType),
    amountKrw: topFlowNetAmtKrw(row, investorType),
  }
}

/**
 * @param {Array<Record<string, unknown>>} rows
 * @param {'foreign'|'institution'|'individual'} investorType
 * @param {'buy'|'sell'} tradeType
 * @param {number} limit
 */
function rankTopFlowRows(rows, investorType, tradeType, limit) {
  const take = Math.min(30, Math.max(1, Number(limit) || 10))
  const scored = rows
    .map((row) => ({
      row,
      score: topFlowNetAmtKrw(row, investorType),
    }))
    .filter(({ score }) => score !== 0)

  scored.sort((a, b) => (tradeType === 'sell' ? a.score - b.score : b.score - a.score))
  return scored.slice(0, take).map(({ row }, idx) => mapTopFlowRow(row, idx, investorType))
}

/**
 * FID_ETC_CLS_CODE=0(전체) 1회 조회 후 투자자별 정렬 — 2/3 단독 호출은 KIS가 빈 output 반환
 * @param {string} appKey
 * @param {string} appSecret
 * @param {'prod'|'vps'} env
 * @param {'buy'|'sell'} tradeType
 * @param {number} [limit]
 */
async function fetchTopFlowRawRows(appKey, appSecret, env, tradeType) {
  const rankSort = tradeType === 'sell' ? '1' : '0'
  const data = await kisGet({
    appKey,
    appSecret,
    env,
    path: '/uapi/domestic-stock/v1/quotations/foreign-institution-total',
    params: {
      FID_COND_MRKT_DIV_CODE: 'V',
      FID_COND_SCR_DIV_CODE: '16449',
      FID_INPUT_ISCD: '0000',
      FID_DIV_CLS_CODE: '1',
      FID_RANK_SORT_CLS_CODE: rankSort,
      FID_ETC_CLS_CODE: '0',
    },
    trId: 'FHPTJ04400000',
    kind: 'KIS 수급상위',
  })
  return normalizeKisOutputRows(data.output)
}

/**
 * @param {string} appKey
 * @param {string} appSecret
 * @param {'prod'|'vps'} env
 * @param {'buy'|'sell'} tradeType
 * @param {number} [limit]
 * @returns {Promise<Record<'foreign'|'institution'|'individual', Array<{ rank: number, code: string, name: string, currentPrice: number | null, changePct: number | null, amount: number, amountKrw: number }>>>}
 */
export async function getTopFlowStocksByInvestor(appKey, appSecret, env, tradeType = 'buy', limit = 10) {
  const take = Math.min(30, Math.max(1, Number(limit) || 10))
  const cacheKey = `kis:top-flow-all:${env}:${tradeType}:${take}`

  return await withCache(cacheKey, 5 * 60_000, async () => {
    const rows = await fetchTopFlowRawRows(appKey, appSecret, env, tradeType)
    if (rows.length && process.env.KIS_DEBUG_TOP_FLOW === '1') {
      console.log('[TopFlow] raw rows:', rows.length, 'keys:', Object.keys(rows[0] || {}))
    }
    return {
      foreign: rankTopFlowRows(rows, 'foreign', tradeType, take),
      institution: rankTopFlowRows(rows, 'institution', tradeType, take),
      individual: rankTopFlowRows(rows, 'individual', tradeType, take),
    }
  })
}

/**
 * 국내기관·외국인 매매종목가집계 상위 [국내주식-037] FHPTJ04400000
 * @param {string} appKey
 * @param {string} appSecret
 * @param {'prod'|'vps'} env
 * @param {'foreign'|'institution'|'individual'} [investorType]
 * @param {'buy'|'sell'} [tradeType]
 * @param {number} [limit]
 */
export async function getTopFlowStocks(
  appKey,
  appSecret,
  env,
  investorType = 'foreign',
  tradeType = 'buy',
  limit = 10,
) {
  const all = await getTopFlowStocksByInvestor(appKey, appSecret, env, tradeType, limit)
  return all[investorType] ?? all.foreign
}

export { firstNumByKeyHint }
