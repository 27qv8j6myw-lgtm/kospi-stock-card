/**
 * OAuth 토큰 엔드포인트 — authorization_code 와 refresh_token 그랜트.
 *
 * 본문은 form-urlencoded 로 온다. 공개 클라이언트이므로 클라이언트 인증은 없고
 * PKCE 로 대체한다. 리프레시 토큰은 사용 시마다 회전시킨다.
 */
import { SCOPE_OFFLINE, resolveIssuer, resolveResourceUrl } from '../../server/mcp/oauthConfig.mjs'
import { readBody, sendJson, sendOAuthError } from '../../server/mcp/oauthHttp.mjs'
import {
  consumeAuthCode,
  consumeRefreshToken,
  issueRefreshToken,
} from '../../server/mcp/oauthStore.mjs'
import { constantTimeEqual, s256Challenge, signAccessToken } from '../../server/mcp/oauthTokens.mjs'

/**
 * @param {import('http').ServerResponse} res
 * @param {object} args
 * @param {string} args.issuer
 * @param {string} args.audience
 * @param {string} args.userId
 * @param {string} args.clientId
 * @param {string} args.scope
 * @param {string | null} args.resource
 */
async function issueTokens(res, args) {
  const { token, expiresIn } = signAccessToken({
    issuer: args.issuer,
    subject: args.userId,
    audience: args.audience,
    scope: args.scope,
    clientId: args.clientId,
  })

  /** @type {Record<string, unknown>} */
  const payload = {
    access_token: token,
    token_type: 'Bearer',
    expires_in: expiresIn,
    scope: args.scope,
  }

  // Claude 는 만료 시 재인증 대신 리프레시를 시도한다. 스코프에 offline_access 가
  // 없어도 재연결 요구를 줄이기 위해 발급한다.
  payload.refresh_token = await issueRefreshToken({
    clientId: args.clientId,
    scope: args.scope.includes(SCOPE_OFFLINE) ? args.scope : `${args.scope} ${SCOPE_OFFLINE}`,
    resource: args.resource,
    userId: args.userId,
  })

  sendJson(res, 200, payload)
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendOAuthError(res, 405, 'invalid_request', 'POST 만 허용됩니다')
    return
  }

  const body = await readBody(req)
  const grantType = String(body.grant_type ?? '')
  const clientId = String(body.client_id ?? '')
  const issuer = resolveIssuer(req)
  const audience = resolveResourceUrl(req)

  try {
    if (grantType === 'authorization_code') {
      const code = String(body.code ?? '')
      const verifier = String(body.code_verifier ?? '')
      if (!code || !verifier) {
        sendOAuthError(res, 400, 'invalid_request', 'code 와 code_verifier 가 필요합니다')
        return
      }

      const stored = await consumeAuthCode(code)
      if (!stored) {
        sendOAuthError(res, 400, 'invalid_grant', '인가코드가 유효하지 않거나 만료되었습니다')
        return
      }
      if (clientId && stored.clientId !== clientId) {
        sendOAuthError(res, 400, 'invalid_grant', '인가코드가 이 클라이언트의 것이 아닙니다')
        return
      }
      const redirectUri = String(body.redirect_uri ?? '')
      if (redirectUri && redirectUri !== stored.redirectUri) {
        sendOAuthError(res, 400, 'invalid_grant', 'redirect_uri 가 인가 요청과 다릅니다')
        return
      }
      if (!constantTimeEqual(s256Challenge(verifier), stored.codeChallenge)) {
        sendOAuthError(res, 400, 'invalid_grant', 'PKCE 검증에 실패했습니다')
        return
      }

      await issueTokens(res, {
        issuer,
        audience,
        userId: stored.userId,
        clientId: stored.clientId,
        scope: stored.scope,
        resource: stored.resource,
      })
      return
    }

    if (grantType === 'refresh_token') {
      const refresh = String(body.refresh_token ?? '')
      if (!refresh) {
        sendOAuthError(res, 400, 'invalid_request', 'refresh_token 이 필요합니다')
        return
      }
      const stored = await consumeRefreshToken(refresh)
      if (!stored) {
        sendOAuthError(res, 400, 'invalid_grant', '리프레시 토큰이 유효하지 않거나 만료되었습니다')
        return
      }
      if (clientId && stored.clientId !== clientId) {
        sendOAuthError(res, 400, 'invalid_grant', '리프레시 토큰이 이 클라이언트의 것이 아닙니다')
        return
      }

      await issueTokens(res, {
        issuer,
        audience,
        userId: stored.userId,
        clientId: stored.clientId,
        scope: stored.scope,
        resource: stored.resource,
      })
      return
    }

    sendOAuthError(res, 400, 'unsupported_grant_type', `지원하지 않는 grant_type: ${grantType}`)
  } catch (e) {
    console.error('[oauth/token]', e instanceof Error ? e.message : String(e))
    sendOAuthError(res, 500, 'server_error', '토큰 발급에 실패했습니다')
  }
}
