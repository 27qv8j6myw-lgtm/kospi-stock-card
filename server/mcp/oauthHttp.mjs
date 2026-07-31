/**
 * OAuth 엔드포인트용 요청·응답 헬퍼.
 *
 * 토큰 엔드포인트는 form-urlencoded, 등록 엔드포인트는 JSON 을 받아야 한다.
 * Vercel 이 본문을 미리 파싱해줄 때와 그렇지 않을 때를 모두 처리한다.
 */

/**
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<Record<string, string>>}
 */
export async function readBody(req) {
  const existing = /** @type {any} */ (req).body
  if (existing && typeof existing === 'object' && !Buffer.isBuffer(existing)) {
    return flatten(existing)
  }

  const raw = Buffer.isBuffer(existing)
    ? existing.toString('utf8')
    : typeof existing === 'string'
      ? existing
      : await readStream(req)
  if (!raw) return {}

  const type = String(req.headers?.['content-type'] ?? '')
  if (type.includes('application/json')) {
    try {
      return flatten(JSON.parse(raw))
    } catch {
      return {}
    }
  }
  return flatten(Object.fromEntries(new URLSearchParams(raw)))
}

/** @param {import('http').IncomingMessage} req */
function readStream(req) {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
    })
    req.on('end', () => resolve(data))
    req.on('error', () => resolve(''))
  })
}

/** 값은 문자열로 정규화하되 배열(redirect_uris 등)은 살려둔다 */
function flatten(obj) {
  /** @type {Record<string, any>} */
  const out = {}
  for (const [k, v] of Object.entries(obj ?? {})) {
    if (Array.isArray(v)) out[k] = v
    else if (v == null) continue
    else if (typeof v === 'object') out[k] = v
    else out[k] = String(v)
  }
  return out
}

/**
 * @param {import('http').IncomingMessage} req
 * @returns {URLSearchParams}
 */
export function queryOf(req) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  return url.searchParams
}

/**
 * @param {import('http').ServerResponse} res
 * @param {number} status
 * @param {unknown} body
 * @param {Record<string, string>} [headers]
 */
export function sendJson(res, status, body, headers = {}) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v)
  res.end(JSON.stringify(body))
}

/**
 * @param {import('http').ServerResponse} res
 * @param {number} status
 * @param {string} html
 */
export function sendHtml(res, status, html) {
  res.statusCode = status
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(html)
}

/**
 * OAuth 오류 응답 (RFC 6749 5.2). Claude 는 표준 코드만 이해한다.
 * @param {import('http').ServerResponse} res
 * @param {number} status
 * @param {string} code
 * @param {string} [description]
 */
export function sendOAuthError(res, status, code, description) {
  sendJson(res, status, {
    error: code,
    ...(description ? { error_description: description } : {}),
  })
}

/** 디스커버리 문서는 브라우저 기반 클라이언트도 읽으므로 CORS 를 열어둔다 */
export function applyDiscoveryCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, MCP-Protocol-Version')
}

/** @param {string} value */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
