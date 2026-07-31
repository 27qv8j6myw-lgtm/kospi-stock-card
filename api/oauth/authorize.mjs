/**
 * OAuth 인가 엔드포인트.
 *
 * GET  — 요청을 검증하고 로그인·동의 화면을 그린다.
 * POST — Signal15 계정(Supabase) 으로 본인 확인 후 인가코드를 발급하고 리다이렉트한다.
 *
 * 개인용 커넥터라 계정은 하나뿐이다. `MCP_USER_ID` 와 일치하는 계정으로 로그인해야만
 * 통과시켜, 다른 사람이 로그인해도 이 커넥터를 붙일 수 없게 한다.
 */
import { createClient } from '@supabase/supabase-js'
import {
  cleanEnv,
  isLoopbackRedirect,
  isRedirectAllowed,
  normalizeScope,
  resolveOrigin,
} from '../../server/mcp/oauthConfig.mjs'
import { escapeHtml, queryOf, readBody, sendHtml } from '../../server/mcp/oauthHttp.mjs'
import { createAuthCode, getClient } from '../../server/mcp/oauthStore.mjs'

const FIELDS = [
  'client_id',
  'redirect_uri',
  'state',
  'scope',
  'code_challenge',
  'code_challenge_method',
  'resource',
]

/** @param {Record<string, string>} params */
function hiddenInputs(params) {
  return FIELDS.filter((f) => params[f])
    .map((f) => `<input type="hidden" name="${f}" value="${escapeHtml(params[f])}" />`)
    .join('\n      ')
}

/**
 * @param {string} title
 * @param {string} body
 */
function page(title, body) {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${escapeHtml(title)} · Signal15</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100dvh; display: grid; place-items: center; padding: 24px;
      background: #0b0d12; color: #e8eaf0;
      font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Pretendard", sans-serif;
    }
    .card {
      width: 100%; max-width: 380px; background: #14171f; border: 1px solid #232833;
      border-radius: 16px; padding: 28px 24px;
    }
    h1 { margin: 0 0 6px; font-size: 19px; letter-spacing: -0.2px; }
    p { margin: 0 0 18px; font-size: 13px; line-height: 1.6; color: #98a0b0; }
    .target { display: flex; gap: 8px; align-items: baseline; margin: 0 0 18px;
      padding: 12px 14px; background: #10131a; border: 1px solid #232833; border-radius: 10px; }
    .target span { font-size: 11px; color: #6f7889; white-space: nowrap; }
    .target strong { font-size: 13px; font-weight: 600; word-break: break-all; }
    label { display: block; font-size: 12px; color: #98a0b0; margin: 0 0 6px; }
    input[type=email], input[type=password] {
      width: 100%; padding: 11px 12px; margin: 0 0 14px; font-size: 15px;
      color: #e8eaf0; background: #0f1218; border: 1px solid #2a3140; border-radius: 10px;
    }
    input:focus { outline: none; border-color: #4a7dff; }
    button, .btn {
      display: block; width: 100%; padding: 12px; font-size: 15px; font-weight: 600;
      text-align: center; text-decoration: none; color: #fff;
      background: #3b6cff; border: 0; border-radius: 10px; cursor: pointer;
    }
    button:hover, .btn:hover { background: #2f5cea; }
    .btn-google { color: #1f2430; background: #fff; }
    .btn-google:hover { background: #eceff5; }
    .account { margin: 0 0 12px; padding: 12px 14px; font-size: 13px; line-height: 1.5;
      background: #10131a; border: 1px solid #232833; border-radius: 10px; }
    .account strong { color: #cfe0ff; word-break: break-all; }
    details { margin: 14px 0 0; }
    summary { font-size: 12.5px; color: #7e8798; cursor: pointer; }
    details form { margin-top: 14px; }
    .sep { margin: 14px 0 0; font-size: 11.5px; color: #6f7889; text-align: center; }
    .warn { margin: 0 0 18px; padding: 10px 12px; font-size: 12px; line-height: 1.5;
      color: #ffd27a; background: #241d0d; border: 1px solid #3d3115; border-radius: 10px; }
    .err { margin: 0 0 16px; padding: 10px 12px; font-size: 12.5px; line-height: 1.5;
      color: #ffb4b4; background: #2a1416; border: 1px solid #452023; border-radius: 10px; }
    .foot { margin: 16px 0 0; font-size: 11.5px; color: #6f7889; }
  </style>
</head>
<body>
  <main class="card">
    ${body}
  </main>
</body>
</html>`
}

/**
 * 승인 화면. 로그인 방식이 Google 뿐인 계정도 있으므로 비밀번호를 요구하지 않는다.
 *  1. 같은 오리진의 앱 세션(localStorage)이 있으면 그 토큰으로 바로 승인
 *  2. 없으면 Supabase Google 로그인을 거쳐 이 페이지로 돌아온 뒤 자동 승인
 *  3. 비밀번호 계정을 위한 폼은 접어서 남겨둔다
 * @param {Record<string, string>} params
 * @param {string} error
 * @param {string} googleUrl
 */
function consentBody(params, error, googleUrl) {
  const host = (() => {
    try {
      return new URL(params.redirect_uri).host
    } catch {
      return params.redirect_uri
    }
  })()
  const loopbackWarning = isLoopbackRedirect(params.redirect_uri)
    ? `<div class="warn">이 요청은 이 기기에서 실행 중인 프로그램(<strong>${escapeHtml(host)}</strong>)으로 돌아갑니다. 직접 커넥터를 연결하는 중이 아니라면 승인하지 마세요.</div>`
    : ''
  const google = googleUrl
    ? `<a class="btn btn-google" href="${escapeHtml(googleUrl)}">Google 계정으로 로그인하고 승인</a>`
    : ''
  return `<h1>포트폴리오 읽기 권한 요청</h1>
    <p>Claude 가 Signal15 의 보유 종목·자산 추이·매매 내역을 <strong>읽기 전용</strong>으로 조회하려 합니다. 본인 계정으로 승인해 주세요.</p>
    <div class="target"><span>승인 대상</span><strong>${escapeHtml(host)}</strong></div>
    ${loopbackWarning}
    ${error ? `<div class="err">${escapeHtml(error)}</div>` : ''}
    <form id="approve-form" method="post" action="/api/oauth/authorize">
      ${hiddenInputs(params)}
      <input type="hidden" name="supabase_access_token" id="sb-token" value="" />
      <div id="session-box" hidden>
        <div class="account">로그인된 계정<br /><strong id="session-email"></strong></div>
        <button type="submit">이 계정으로 승인</button>
      </div>
    </form>
    <div id="signin-box">
      ${google}
      <details>
        <summary>비밀번호로 로그인</summary>
        <form method="post" action="/api/oauth/authorize">
          ${hiddenInputs(params)}
          <label for="email">이메일</label>
          <input id="email" name="email" type="email" autocomplete="username" required />
          <label for="password">비밀번호</label>
          <input id="password" name="password" type="password" autocomplete="current-password" required />
          <button type="submit">로그인하고 승인</button>
        </form>
      </details>
    </div>
    <p class="foot">쓰기 도구는 제공하지 않습니다. 승인 후에도 Claude 는 데이터를 변경할 수 없습니다.</p>
    <script>${sessionScript()}</script>`
}

/**
 * 앱 세션 감지와 Google 로그인 복귀 처리. 같은 오리진이라 앱이 저장한
 * `sb-<ref>-auth-token` 을 그대로 읽을 수 있다.
 */
function sessionScript() {
  return `(function () {
  var form = document.getElementById('approve-form')
  var tokenInput = document.getElementById('sb-token')
  var sessionBox = document.getElementById('session-box')
  var sessionEmail = document.getElementById('session-email')
  var signinBox = document.getElementById('signin-box')

  function tokenFromHash() {
    var h = (location.hash || '').replace(/^#/, '')
    if (!h) return null
    return new URLSearchParams(h).get('access_token')
  }

  function sessionFromStorage() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i)
        if (!k || !/^sb-.+-auth-token$/.test(k)) continue
        var v = JSON.parse(localStorage.getItem(k) || 'null')
        var s = (v && v.currentSession) || v
        if (!s || !s.access_token) continue
        if (s.expires_at && Number(s.expires_at) * 1000 < Date.now() + 30000) continue
        return { token: s.access_token, email: (s.user && s.user.email) || '' }
      }
    } catch (e) {}
    return null
  }

  var hashToken = tokenFromHash()
  if (hashToken) {
    history.replaceState(null, '', location.pathname + location.search)
    tokenInput.value = hashToken
    form.submit()
    return
  }

  var s = sessionFromStorage()
  if (s) {
    tokenInput.value = s.token
    sessionEmail.textContent = s.email || '이 브라우저에 로그인된 계정'
    sessionBox.hidden = false
    signinBox.hidden = true
  }
})()`
}

/** @param {string} message */
function errorBody(message) {
  return `<h1>연결할 수 없습니다</h1>
    <div class="err">${escapeHtml(message)}</div>
    <p class="foot">커넥터 URL 을 확인한 뒤 Claude 에서 다시 시도해 주세요.</p>`
}

/**
 * @param {import('http').ServerResponse} res
 * @param {string} redirectUri
 * @param {string} code
 * @param {string} description
 * @param {string} [state]
 */
function redirectWithError(res, redirectUri, code, description, state) {
  const url = new URL(redirectUri)
  url.searchParams.set('error', code)
  url.searchParams.set('error_description', description)
  if (state) url.searchParams.set('state', state)
  res.statusCode = 302
  res.setHeader('Location', url.toString())
  res.setHeader('Cache-Control', 'no-store')
  res.end()
}

/** @param {Record<string, string>} raw */
function collect(raw) {
  /** @type {Record<string, string>} */
  const out = {}
  for (const f of [...FIELDS, 'response_type']) {
    const v = raw[f]
    if (typeof v === 'string' && v) out[f] = v
  }
  return out
}

/**
 * 요청 자체의 유효성 검사. 리다이렉트가 신뢰 가능한지 먼저 확정해야
 * 오류를 리다이렉트로 돌려줄 수 있다.
 * @param {Record<string, string>} params
 */
async function validate(params) {
  if (!params.client_id) return { fatal: '요청에 client_id 가 없습니다' }
  if (!params.redirect_uri) return { fatal: '요청에 redirect_uri 가 없습니다' }

  const client = await getClient(params.client_id)
  if (!client) return { fatal: '등록되지 않은 클라이언트입니다' }
  if (!isRedirectAllowed(params.redirect_uri, client.redirectUris)) {
    return { fatal: '등록되지 않은 redirect_uri 입니다' }
  }

  if (params.response_type && params.response_type !== 'code') {
    return { redirect: ['unsupported_response_type', 'response_type=code 만 지원합니다'] }
  }
  if (!params.code_challenge) {
    return { redirect: ['invalid_request', 'PKCE code_challenge 가 필요합니다'] }
  }
  if ((params.code_challenge_method ?? 'S256') !== 'S256') {
    return { redirect: ['invalid_request', 'code_challenge_method 는 S256 만 지원합니다'] }
  }
  return { client }
}

function anonClient() {
  const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const anon = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  if (!url || !anon) return null
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

/** Google 로그인 진입 URL — implicit 플로우라 토큰이 프래그먼트로 돌아온다 */
function googleSignInUrl(req) {
  const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL)
  if (!url) return ''
  const back = `${resolveOrigin(req)}${req.url ?? '/api/oauth/authorize'}`
  return `${url}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(back)}`
}

/**
 * 로그인한 계정이 이 커넥터의 소유자인지 확인한다.
 * @param {{ accessToken?: string, email?: string, password?: string }} creds
 */
async function verifyOwner(creds) {
  const ownerId = cleanEnv(process.env.MCP_USER_ID)
  const supabase = anonClient()
  if (!supabase) return { error: '서버에 Supabase 설정이 없습니다' }
  if (!ownerId) return { error: '서버에 MCP_USER_ID 가 설정되지 않았습니다' }

  /** @type {string | null} */
  let userId = null
  if (creds.accessToken) {
    const { data, error } = await supabase.auth.getUser(creds.accessToken)
    if (error || !data?.user?.id)
      return { error: '로그인 세션이 만료되었습니다. 다시 로그인해 주세요' }
    userId = data.user.id
  } else {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: creds.email ?? '',
      password: creds.password ?? '',
    })
    if (error || !data?.user?.id) return { error: '이메일 또는 비밀번호가 올바르지 않습니다' }
    userId = data.user.id
  }

  if (userId !== ownerId) return { error: '이 커넥터를 사용할 수 있는 계정이 아닙니다' }
  return { userId: ownerId }
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export default async function handler(req, res) {
  const isPost = req.method === 'POST'
  if (!isPost && req.method !== 'GET') {
    sendHtml(res, 405, page('오류', errorBody('허용되지 않은 메서드입니다')))
    return
  }

  const raw = isPost ? await readBody(req) : Object.fromEntries(queryOf(req).entries())
  const params = collect(/** @type {Record<string, string>} */ (raw))
  params.scope = normalizeScope(params.scope)
  console.log(
    `[oauth/authorize] ${req.method}`,
    JSON.stringify({
      client_id: params.client_id,
      redirect_uri: params.redirect_uri,
      scope: params.scope,
      resource: params.resource,
      has_challenge: Boolean(params.code_challenge),
      method: params.code_challenge_method,
    }),
  )

  let checked
  try {
    checked = await validate(params)
  } catch (e) {
    console.error('[oauth/authorize]', e instanceof Error ? e.message : String(e))
    sendHtml(res, 500, page('오류', errorBody('인가 요청을 처리할 수 없습니다')))
    return
  }

  if (checked.fatal) {
    sendHtml(res, 400, page('오류', errorBody(checked.fatal)))
    return
  }
  if (checked.redirect) {
    redirectWithError(
      res,
      params.redirect_uri,
      checked.redirect[0],
      checked.redirect[1],
      params.state,
    )
    return
  }

  const googleUrl = googleSignInUrl(req)

  if (!isPost) {
    sendHtml(res, 200, page('커넥터 승인', consentBody(params, '', googleUrl)))
    return
  }

  const accessToken = String(raw.supabase_access_token ?? '').trim()
  const email = String(raw.email ?? '').trim()
  const password = String(raw.password ?? '')
  if (!accessToken && (!email || !password)) {
    sendHtml(
      res,
      400,
      page('커넥터 승인', consentBody(params, '로그인 후 다시 승인해 주세요', googleUrl)),
    )
    return
  }

  const owner = await verifyOwner({ accessToken, email, password })
  if (!owner.userId) {
    sendHtml(
      res,
      401,
      page('커넥터 승인', consentBody(params, owner.error ?? '로그인에 실패했습니다', googleUrl)),
    )
    return
  }

  try {
    const code = await createAuthCode({
      clientId: params.client_id,
      redirectUri: params.redirect_uri,
      codeChallenge: params.code_challenge,
      scope: params.scope,
      resource: params.resource ?? null,
      userId: owner.userId,
    })
    const url = new URL(params.redirect_uri)
    url.searchParams.set('code', code)
    if (params.state) url.searchParams.set('state', params.state)
    res.statusCode = 302
    res.setHeader('Location', url.toString())
    res.setHeader('Cache-Control', 'no-store')
    res.end()
  } catch (e) {
    console.error('[oauth/authorize]', e instanceof Error ? e.message : String(e))
    redirectWithError(
      res,
      params.redirect_uri,
      'server_error',
      '인가코드 발급에 실패했습니다',
      params.state,
    )
  }
}
