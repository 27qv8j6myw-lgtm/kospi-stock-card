/**
 * Vercel Node Serverless Function — Claude 커스텀 커넥터용 MCP 엔드포인트.
 *
 * stateless Streamable HTTP: 요청마다 서버·트랜스포트를 새로 만든다.
 * 서버리스에서는 인스턴스가 요청 간에 살아있다고 가정할 수 없다.
 *
 * 인증은 `Authorization: Bearer <MCP_TOKEN>` 헤더만 허용한다. MCP 인증 스펙이
 * 토큰을 URL 쿼리에 넣는 것을 금지하므로 쿼리 파라미터는 받지 않는다.
 */
import { timingSafeEqual } from 'node:crypto'
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node'
import { createSignal15McpServer } from '../server/mcp/mcpServer.mjs'

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
function isAuthorized(req) {
  const expected = cleanEnv(process.env.MCP_TOKEN)
  if (!expected) return false
  const raw = req.headers?.authorization
  const header = Array.isArray(raw) ? raw[0] : raw
  const token = String(header ?? '')
    .replace(/^Bearer\s+/i, '')
    .trim()
  if (!token) return false
  return safeEqual(token, expected)
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export default async function handler(req, res) {
  if (!isAuthorized(req)) {
    res.statusCode = 401
    res.setHeader('WWW-Authenticate', 'Bearer realm="signal15-mcp"')
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: 'unauthorized' }))
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
