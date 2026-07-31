/**
 * OAuth 디스커버리 문서 — 보호리소스 메타데이터(RFC 9728)와 인증서버 메타데이터(RFC 8414).
 *
 * `/.well-known/*` 경로는 vercel.json 리라이트로 이 함수에 연결된다. 어느 문서를
 * 줄지는 `doc` 쿼리로 받고, 직접 호출된 경우 경로에서 유추한다.
 */
import {
  MCP_PATH,
  SUPPORTED_SCOPES,
  resolveIssuer,
  resolveResourceUrl,
} from '../../server/mcp/oauthConfig.mjs'
import { applyDiscoveryCors, queryOf, sendJson } from '../../server/mcp/oauthHttp.mjs'

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export default function handler(req, res) {
  applyDiscoveryCors(res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { error: 'method_not_allowed' })
    return
  }

  const issuer = resolveIssuer(req)
  const path = String(req.url ?? '')
  const doc = queryOf(req).get('doc') || (path.includes('authorization-server') ? 'as' : 'prm')

  if (doc === 'as') {
    // code_challenge_methods_supported 가 없으면 스펙 준수 클라이언트는 연결을 포기한다.
    sendJson(
      res,
      200,
      {
        issuer,
        authorization_endpoint: `${issuer}/api/oauth/authorize`,
        token_endpoint: `${issuer}/api/oauth/token`,
        registration_endpoint: `${issuer}/api/oauth/register`,
        scopes_supported: SUPPORTED_SCOPES,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['none'],
        service_documentation: `${issuer}/`,
      },
      { 'Cache-Control': 'public, max-age=300' },
    )
    return
  }

  sendJson(
    res,
    200,
    {
      resource: resolveResourceUrl(req),
      authorization_servers: [issuer],
      scopes_supported: SUPPORTED_SCOPES,
      bearer_methods_supported: ['header'],
      resource_documentation: `${issuer}${MCP_PATH}`,
    },
    { 'Cache-Control': 'public, max-age=300' },
  )
}
