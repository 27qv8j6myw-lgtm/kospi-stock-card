/**
 * RFC 7591 동적 클라이언트 등록.
 *
 * Claude 는 커넥터를 새로 연결할 때마다 여기에 스스로 등록해 client_id 를 받는다.
 * 공개 클라이언트(PKCE)만 지원하므로 client_secret 은 발급하지 않는다.
 */
import {
  SUPPORTED_SCOPES,
  isRegistrableRedirect,
  normalizeScope,
} from '../../server/mcp/oauthConfig.mjs'
import {
  applyDiscoveryCors,
  readBody,
  sendJson,
  sendOAuthError,
} from '../../server/mcp/oauthHttp.mjs'
import { pruneExpired, registerClient } from '../../server/mcp/oauthStore.mjs'

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export default async function handler(req, res) {
  applyDiscoveryCors(res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'POST') {
    sendOAuthError(res, 405, 'invalid_request', 'POST 만 허용됩니다')
    return
  }

  const body = await readBody(req)
  console.log(
    '[oauth/register] 요청',
    JSON.stringify({
      client_name: body.client_name,
      redirect_uris: body.redirect_uris,
      grant_types: body.grant_types,
      response_types: body.response_types,
      scope: body.scope,
      token_endpoint_auth_method: body.token_endpoint_auth_method,
    }),
  )
  const redirectUris = Array.isArray(body.redirect_uris)
    ? body.redirect_uris.map((u) => String(u))
    : typeof body.redirect_uris === 'string'
      ? [body.redirect_uris]
      : []

  if (redirectUris.length === 0) {
    sendOAuthError(res, 400, 'invalid_redirect_uri', 'redirect_uris 가 필요합니다')
    return
  }
  const rejected = redirectUris.filter((u) => !isRegistrableRedirect(u))
  if (rejected.length > 0) {
    sendOAuthError(res, 400, 'invalid_redirect_uri', 'https 또는 루프백 URI 만 허용됩니다')
    return
  }

  const grantTypes = Array.isArray(body.grant_types)
    ? body.grant_types.map((g) => String(g))
    : ['authorization_code', 'refresh_token']
  if (!grantTypes.includes('authorization_code')) {
    sendOAuthError(res, 400, 'invalid_client_metadata', 'authorization_code 그랜트가 필요합니다')
    return
  }

  const responseTypes = Array.isArray(body.response_types)
    ? body.response_types.map((r) => String(r))
    : ['code']
  if (!responseTypes.includes('code')) {
    sendOAuthError(res, 400, 'invalid_client_metadata', 'response_type=code 만 지원합니다')
    return
  }

  try {
    const { clientId, issuedAt } = await registerClient({
      clientName: String(body.client_name ?? '') || 'Claude',
      redirectUris,
      grantTypes,
      tokenEndpointAuthMethod: 'none',
    })
    void pruneExpired()

    // RFC 7591 3.2.1 — 등록된 메타데이터를 모두 돌려준다. 특히 scope 를 빼면
    // 클라이언트가 스코프를 거부당한 것으로 읽고 인가 단계로 넘어가지 않는다.
    const scope = body.scope ? normalizeScope(String(body.scope)) : SUPPORTED_SCOPES.join(' ')
    /** @type {Record<string, unknown>} */
    const registered = {
      client_id: clientId,
      client_id_issued_at: issuedAt,
      client_name: String(body.client_name ?? '') || 'Claude',
      redirect_uris: redirectUris,
      grant_types: grantTypes,
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      scope,
    }
    for (const field of [
      'client_uri',
      'logo_uri',
      'tos_uri',
      'policy_uri',
      'software_id',
      'software_version',
    ]) {
      if (body[field]) registered[field] = String(body[field])
    }

    sendJson(res, 201, registered)
  } catch (e) {
    console.error('[oauth/register]', e instanceof Error ? e.message : String(e))
    sendOAuthError(res, 500, 'server_error', '클라이언트 등록에 실패했습니다')
  }
}
