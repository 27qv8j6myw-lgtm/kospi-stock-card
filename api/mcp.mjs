/**
 * Vercel Node Serverless Function — Claude 커스텀 커넥터용 MCP 엔드포인트.
 *
 * stateless Streamable HTTP: 요청마다 서버·트랜스포트를 새로 만든다.
 * 서버리스에서는 인스턴스가 요청 간에 살아있다고 가정할 수 없다.
 *
 * 인증은 두 가지를 받는다. 둘 다 `Authorization: Bearer` 헤더로만 받으며, MCP 인증
 * 스펙이 토큰을 URL 쿼리에 넣는 것을 금지하므로 쿼리 파라미터는 지원하지 않는다.
 *   1. OAuth 액세스 토큰 — claude.ai 웹·모바일이 쓰는 정식 경로
 *   2. 고정 `MCP_TOKEN` — 데스크톱 mcp-remote·Claude Code 용
 */
import { timingSafeEqual } from 'node:crypto'
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node'
import { createSignal15McpServer } from '../server/mcp/mcpServer.mjs'
import {
  SCOPE_READ,
  resolveResourceMetadataUrl,
  resolveResourceUrl,
} from '../server/mcp/oauthConfig.mjs'
import { verifyAccessToken } from '../server/mcp/oauthTokens.mjs'

/** @param {string | undefined} raw */
function cleanEnv(raw) {
  if (raw == null) return ''
  let s = String(raw).trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim()
  }
  return s
}

/**
 * 길이가 다르면 timingSafeEqual 이 던지므로 길이를 먼저 비교한다.
 * @param {string} got
 * @param {string} expected
 */
function safeEqual(got, expected) {
  const a = Buffer.from(got)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** @param {import('http').IncomingMessage} req */
function bearerToken(req) {
  const raw = req.headers?.authorization
  const header = Array.isArray(raw) ? raw[0] : raw
  return String(header ?? '')
    .replace(/^Bearer\s+/i, '')
    .trim()
}

/**
 * 정적 토큰이면 즉시 통과, 아니면 OAuth 액세스 토큰으로 검증한다.
 * 어느 쪽이든 조회 대상은 `MCP_USER_ID` 로만 결정된다.
 * @param {import('http').IncomingMessage} req
 * @returns {{ ok: true } | { ok: false, tokenGiven: boolean }}
 */
function authorize(req) {
  const token = bearerToken(req)
  if (!token) return { ok: false, tokenGiven: false }

  const staticToken = cleanEnv(process.env.MCP_TOKEN)
  if (staticToken && safeEqual(token, staticToken)) return { ok: true }

  const owner = cleanEnv(process.env.MCP_USER_ID)
  const claims = verifyAccessToken(token, { audience: resolveResourceUrl(req) })
  if (claims && owner && claims.sub === owner) return { ok: true }

  return { ok: false, tokenGiven: true }
}

/**
 * 401 에는 반드시 resource_metadata 포인터를 넣는다. 이게 없으면 Claude 가
 * 인증 서버를 못 찾고 "서버에 연결할 수 없습니다" 로 끝난다.
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {boolean} tokenGiven
 */
function sendUnauthorized(req, res, tokenGiven) {
  const parts = [`resource_metadata="${resolveResourceMetadataUrl(req)}"`, `scope="${SCOPE_READ}"`]
  if (tokenGiven) parts.unshift('error="invalid_token"')
  res.statusCode = 401
  res.setHeader('WWW-Authenticate', `Bearer ${parts.join(', ')}`)
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify({ error: tokenGiven ? 'invalid_token' : 'unauthorized' }))
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export default async function handler(req, res) {
  const auth = authorize(req)
  if (!auth.ok) {
    sendUnauthorized(req, res, auth.tokenGiven)
    return
  }

  // 서버가 먼저 말을 거는 일이 없으므로 SSE 스트림(GET)과 세션 종료(DELETE)는 열지
  // 않는다. 스펙이 허용하는 405 로 즉시 끊어야 한다. 열어두면 서버리스 함수가
  // 타임아웃까지 매달려 있고 클라이언트는 연결 실패로 판정한다.
  if (req.method === 'GET' || req.method === 'DELETE') {
    res.statusCode = 405
    res.setHeader('Allow', 'POST')
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.end(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Method not allowed: 이 엔드포인트는 POST 만 받습니다' },
        id: null,
      }),
    )
    return
  }

  // 조회 대상 사용자는 환경변수로만 결정한다 (요청 본문으로 바꿀 수 없음).
  const userId = cleanEnv(process.env.MCP_USER_ID)
  if (!userId) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: 'MCP_USER_ID 가 설정되지 않았습니다' }))
    return
  }

  const server = createSignal15McpServer(userId)
  const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined })

  res.on('close', () => {
    void transport.close()
    void server.close()
  })

  try {
    await server.connect(transport)
    await transport.handleRequest(req, res, req.body)
  } catch (e) {
    console.error('[MCP]', e instanceof Error ? e.message : String(e))
    if (!res.headersSent) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: 'internal_error' }))
    }
  }
}
