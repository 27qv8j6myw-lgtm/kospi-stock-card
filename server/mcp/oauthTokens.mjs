/**
 * MCP 커넥터 토큰 발급·검증.
 *
 * 액세스 토큰은 HS256 JWT 라 DB 를 거치지 않는다. 서명 키는 `MCP_OAUTH_SECRET`,
 * 없으면 기존 `MCP_TOKEN` 을 쓴다 (환경변수를 새로 요구하지 않기 위해).
 * 리프레시 토큰은 불투명 난수이며 해시만 DB 에 남는다.
 */
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { ACCESS_TOKEN_TTL_SEC, cleanEnv } from './oauthConfig.mjs'

function signingKey() {
  const secret = cleanEnv(process.env.MCP_OAUTH_SECRET) || cleanEnv(process.env.MCP_TOKEN)
  if (!secret) throw new Error('MCP_OAUTH_SECRET 또는 MCP_TOKEN 이 필요합니다')
  return secret
}

/** @param {string | Buffer} input */
function b64url(input) {
  return Buffer.from(input).toString('base64url')
}

/** @param {string} data */
function hmac(data) {
  return createHmac('sha256', signingKey()).update(data).digest('base64url')
}

/** @param {string} value */
export function sha256Hex(value) {
  return createHash('sha256').update(value).digest('hex')
}

/** PKCE S256 검증용 — code_verifier 를 챌린지 형식으로 변환 */
export function s256Challenge(verifier) {
  return createHash('sha256').update(verifier).digest('base64url')
}

/** @param {string} a @param {string} b */
export function constantTimeEqual(a, b) {
  const x = Buffer.from(String(a))
  const y = Buffer.from(String(b))
  return x.length === y.length && timingSafeEqual(x, y)
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url')
}

/**
 * @param {object} args
 * @param {string} args.issuer
 * @param {string} args.subject 조회 대상 Supabase user id
 * @param {string} args.audience 정규 MCP 엔드포인트 URL (RFC 8707)
 * @param {string} args.scope
 * @param {string} args.clientId
 * @param {number} [args.ttlSec]
 * @returns {{ token: string, expiresIn: number }}
 */
export function signAccessToken({
  issuer,
  subject,
  audience,
  scope,
  clientId,
  ttlSec = ACCESS_TOKEN_TTL_SEC,
}) {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = b64url(
    JSON.stringify({
      iss: issuer,
      sub: subject,
      aud: audience,
      scope,
      client_id: clientId,
      iat: now,
      exp: now + ttlSec,
      jti: randomUUID(),
    }),
  )
  const body = `${header}.${payload}`
  return { token: `${body}.${hmac(body)}`, expiresIn: ttlSec }
}

/**
 * 서명·만료·audience 를 확인한다. audience 를 강제해 다른 리소스용 토큰 재사용을 막는다.
 * @param {string} token
 * @param {{ audience: string }} opts
 * @returns {{ sub: string, scope: string, client_id?: string } | null}
 */
export function verifyAccessToken(token, { audience }) {
  const parts = String(token ?? '').split('.')
  if (parts.length !== 3) return null
  const [header, payload, signature] = parts
  let expected
  try {
    expected = hmac(`${header}.${payload}`)
  } catch {
    return null
  }
  if (!constantTimeEqual(signature, expected)) return null

  /** @type {any} */
  let claims
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  const alg = (() => {
    try {
      return JSON.parse(Buffer.from(header, 'base64url').toString('utf8'))?.alg
    } catch {
      return null
    }
  })()
  if (alg !== 'HS256') return null

  const now = Math.floor(Date.now() / 1000)
  if (typeof claims?.exp !== 'number' || claims.exp <= now) return null
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
  if (!aud.includes(audience)) return null
  if (typeof claims.sub !== 'string' || !claims.sub) return null
  return { sub: claims.sub, scope: String(claims.scope ?? ''), client_id: claims.client_id }
}
