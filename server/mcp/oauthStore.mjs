/**
 * MCP 커넥터 OAuth 상태 저장 — service_role 로 mcp_oauth_* 테이블에 접근한다.
 * 스키마는 scripts/supabase-mcp-oauth.sql 참고.
 */
import { getSupabaseService } from '../lib/supabaseService.mjs'
import { AUTH_CODE_TTL_SEC, REFRESH_TOKEN_TTL_SEC } from './oauthConfig.mjs'
import { randomToken, sha256Hex } from './oauthTokens.mjs'

function requireSupabase() {
  const supabase = getSupabaseService()
  if (!supabase) throw new Error('Supabase 서비스 키가 설정되지 않았습니다')
  return supabase
}

/**
 * @param {object} meta
 * @param {string} meta.clientName
 * @param {string[]} meta.redirectUris
 * @param {string[]} meta.grantTypes
 * @param {string} meta.tokenEndpointAuthMethod
 */
export async function registerClient(meta) {
  const supabase = requireSupabase()
  const clientId = `s15_${randomToken(18)}`
  const { error } = await supabase.from('mcp_oauth_clients').insert({
    client_id: clientId,
    client_name: meta.clientName || null,
    redirect_uris: meta.redirectUris,
    grant_types: meta.grantTypes,
    token_endpoint_auth_method: meta.tokenEndpointAuthMethod,
  })
  if (error) throw new Error(`클라이언트 등록 실패: ${error.message}`)
  return { clientId, issuedAt: Math.floor(Date.now() / 1000) }
}

/**
 * @param {string} clientId
 * @returns {Promise<{ clientId: string, clientName: string | null, redirectUris: string[], grantTypes: string[] } | null>}
 */
export async function getClient(clientId) {
  if (!clientId) return null
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('mcp_oauth_clients')
    .select('client_id, client_name, redirect_uris, grant_types')
    .eq('client_id', clientId)
    .maybeSingle()
  if (error || !data) return null
  return {
    clientId: data.client_id,
    clientName: data.client_name ?? null,
    redirectUris: Array.isArray(data.redirect_uris) ? data.redirect_uris : [],
    grantTypes: Array.isArray(data.grant_types) ? data.grant_types : [],
  }
}

/**
 * @param {object} args
 * @param {string} args.clientId
 * @param {string} args.redirectUri
 * @param {string} args.codeChallenge
 * @param {string} args.scope
 * @param {string | null} args.resource
 * @param {string} args.userId
 */
export async function createAuthCode(args) {
  const supabase = requireSupabase()
  const code = randomToken(32)
  const { error } = await supabase.from('mcp_oauth_codes').insert({
    code,
    client_id: args.clientId,
    redirect_uri: args.redirectUri,
    code_challenge: args.codeChallenge,
    scope: args.scope,
    resource: args.resource,
    user_id: args.userId,
    expires_at: new Date(Date.now() + AUTH_CODE_TTL_SEC * 1000).toISOString(),
  })
  if (error) throw new Error(`인가코드 저장 실패: ${error.message}`)
  return code
}

/**
 * 인가코드는 1회용이다. 읽는 즉시 삭제해 재사용을 막는다.
 * @param {string} code
 */
export async function consumeAuthCode(code) {
  if (!code) return null
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('mcp_oauth_codes')
    .delete()
    .eq('code', code)
    .select('client_id, redirect_uri, code_challenge, scope, resource, user_id, expires_at')
    .maybeSingle()
  if (error || !data) return null
  if (new Date(data.expires_at).getTime() <= Date.now()) return null
  return {
    clientId: data.client_id,
    redirectUri: data.redirect_uri,
    codeChallenge: data.code_challenge,
    scope: data.scope,
    resource: data.resource ?? null,
    userId: data.user_id,
  }
}

/**
 * @param {object} args
 * @param {string} args.clientId
 * @param {string} args.scope
 * @param {string | null} args.resource
 * @param {string} args.userId
 */
export async function issueRefreshToken(args) {
  const supabase = requireSupabase()
  const token = randomToken(32)
  const { error } = await supabase.from('mcp_oauth_refresh_tokens').insert({
    token_hash: sha256Hex(token),
    client_id: args.clientId,
    scope: args.scope,
    resource: args.resource,
    user_id: args.userId,
    expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL_SEC * 1000).toISOString(),
  })
  if (error) throw new Error(`리프레시 토큰 저장 실패: ${error.message}`)
  return token
}

/**
 * 공개 클라이언트라 리프레시 토큰을 회전시켜야 한다. 삭제와 조회를 한 번에 처리해
 * 같은 토큰이 두 번 쓰이는 것을 막는다.
 * @param {string} token
 */
export async function consumeRefreshToken(token) {
  if (!token) return null
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('mcp_oauth_refresh_tokens')
    .delete()
    .eq('token_hash', sha256Hex(token))
    .select('client_id, scope, resource, user_id, expires_at')
    .maybeSingle()
  if (error || !data) return null
  if (new Date(data.expires_at).getTime() <= Date.now()) return null
  return {
    clientId: data.client_id,
    scope: data.scope,
    resource: data.resource ?? null,
    userId: data.user_id,
  }
}

/** 만료된 인가코드·리프레시 토큰 정리. 실패해도 요청을 막지 않는다. */
export async function pruneExpired() {
  try {
    const supabase = requireSupabase()
    const now = new Date().toISOString()
    await supabase.from('mcp_oauth_codes').delete().lt('expires_at', now)
    await supabase.from('mcp_oauth_refresh_tokens').delete().lt('expires_at', now)
  } catch {
    // 정리는 부가 작업이라 조용히 넘긴다
  }
}
