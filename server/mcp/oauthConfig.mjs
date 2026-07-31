/**
 * MCP 커넥터 OAuth 공통 설정 — issuer/리소스 URL 산출과 리다이렉트 URI 검증.
 *
 * 보호리소스 메타데이터의 `resource` 는 사용자가 Claude 에 입력한 URL 과 정확히
 * 같아야 하므로, 호스트를 환경변수에 박지 않고 요청 헤더에서 뽑는다.
 */

/** @param {string | undefined} raw */
export function cleanEnv(raw) {
  if (raw == null) return ''
  let s = String(raw).trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim()
  }
  return s
}

/** MCP 엔드포인트 경로 — 보호리소스의 정체 */
export const MCP_PATH = '/api/mcp'

/** 커넥터가 요구하는 스코프. offline_access 를 노출해야 Claude 가 리프레시 토큰을 받아간다 */
export const SCOPE_READ = 'mcp:read'
export const SCOPE_OFFLINE = 'offline_access'
export const SUPPORTED_SCOPES = [SCOPE_READ, SCOPE_OFFLINE]

/** claude.ai 웹·데스크톱·모바일·Cowork 공통 콜백 */
export const CLAUDE_REDIRECT_URI = 'https://claude.ai/api/mcp/auth_callback'

/** 인가코드 수명 — 짧게 유지 */
export const AUTH_CODE_TTL_SEC = 600
/** 액세스 토큰 수명 */
export const ACCESS_TOKEN_TTL_SEC = 3600
/** 리프레시 토큰 수명 */
export const REFRESH_TOKEN_TTL_SEC = 60 * 60 * 24 * 30

/**
 * 프록시 뒤에서 실제 외부 origin 을 복원한다.
 * @param {import('http').IncomingMessage} req
 */
export function resolveOrigin(req) {
  const override = cleanEnv(process.env.MCP_PUBLIC_ORIGIN)
  if (override) return override.replace(/\/$/, '')
  const head = (/** @type {string} */ name) => {
    const raw = req.headers?.[name]
    const v = Array.isArray(raw) ? raw[0] : raw
    return String(v ?? '')
      .split(',')[0]
      .trim()
  }
  const host = head('x-forwarded-host') || head('host')
  const proto = head('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

/**
 * 우리는 인증 서버와 리소스 서버를 같은 origin 에 올린다.
 * @param {import('http').IncomingMessage} req
 */
export function resolveIssuer(req) {
  return resolveOrigin(req)
}

/** @param {import('http').IncomingMessage} req */
export function resolveResourceUrl(req) {
  return `${resolveOrigin(req)}${MCP_PATH}`
}

/** @param {import('http').IncomingMessage} req */
export function resolveResourceMetadataUrl(req) {
  return `${resolveOrigin(req)}/.well-known/oauth-protected-resource`
}

/** @param {string} uri */
function parseUri(uri) {
  try {
    return new URL(uri)
  } catch {
    return null
  }
}

/**
 * Claude Code 는 RFC 8252 루프백 리다이렉트를 쓰고 포트가 세션마다 바뀐다.
 * 등록된 URI 와 포트만 다른 루프백은 같은 것으로 본다.
 * @param {string} uri
 */
export function isLoopbackRedirect(uri) {
  const u = parseUri(uri)
  if (!u) return false
  return u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')
}

/**
 * 등록 시점에 받아들일 수 있는 리다이렉트인지. https 또는 루프백만 허용한다.
 * @param {string} uri
 */
export function isRegistrableRedirect(uri) {
  const u = parseUri(uri)
  if (!u) return false
  if (u.protocol === 'https:') return true
  return isLoopbackRedirect(uri)
}

/**
 * 인가 요청의 redirect_uri 가 등록된 목록에 있는지. 루프백은 포트를 무시한다.
 * @param {string} uri
 * @param {string[]} registered
 */
export function isRedirectAllowed(uri, registered) {
  if (!uri || !Array.isArray(registered) || registered.length === 0) return false
  if (registered.includes(uri)) return true
  const got = parseUri(uri)
  if (!got || !isLoopbackRedirect(uri)) return false
  return registered.some((candidate) => {
    const want = parseUri(candidate)
    if (!want || !isLoopbackRedirect(candidate)) return false
    return want.hostname === got.hostname && want.pathname === got.pathname
  })
}

/**
 * 스코프 문자열을 지원 목록으로 걸러낸다. 빈 요청은 읽기 스코프로 본다.
 * @param {string | undefined | null} requested
 */
export function normalizeScope(requested) {
  const parts = String(requested ?? '')
    .split(/[\s+]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const kept = parts.filter((s) => SUPPORTED_SCOPES.includes(s))
  if (!kept.includes(SCOPE_READ)) kept.unshift(SCOPE_READ)
  return [...new Set(kept)].join(' ')
}
