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

async function inquireDailyChart(appKey, appSecret, env, code6, tf) {
  const bars = await inquireDailyBars(appKey, appSecret, env, code6, Math.max(toTfCount(tf), 5))
  return bars.slice(-toTfCount(tf))
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
