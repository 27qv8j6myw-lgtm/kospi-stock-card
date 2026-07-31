-- MCP 커넥터 OAuth 2.1 인증 서버 상태 (Supabase SQL Editor)
--
-- 서버리스 함수는 요청 간 메모리를 공유하지 않으므로 클라이언트 등록·인가코드·
-- 리프레시 토큰을 DB 에 둔다. 액세스 토큰은 서명된 JWT 라 저장하지 않는다.
--
-- 세 테이블 모두 RLS 를 켜고 정책을 만들지 않는다. service_role 만 접근 가능하고
-- anon/authenticated 키로는 한 줄도 읽히지 않는다.

-- RFC 7591 동적 클라이언트 등록 결과. Claude 는 연결마다 새로 등록할 수 있다.
create table if not exists public.mcp_oauth_clients (
  client_id text primary key,
  client_name text,
  redirect_uris text[] not null default '{}',
  grant_types text[] not null default '{authorization_code,refresh_token}',
  token_endpoint_auth_method text not null default 'none',
  created_at timestamptz not null default now()
);

-- 인가코드: 1회용, 수명 10분. code_challenge 는 PKCE S256 원문 챌린지.
create table if not exists public.mcp_oauth_codes (
  code text primary key,
  client_id text not null,
  redirect_uri text not null,
  code_challenge text not null,
  scope text not null default 'mcp:read',
  resource text,
  user_id uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists mcp_oauth_codes_expires_idx on public.mcp_oauth_codes (expires_at);

-- 리프레시 토큰: 평문 대신 sha256 해시만 저장하고 사용 시 회전한다.
create table if not exists public.mcp_oauth_refresh_tokens (
  token_hash text primary key,
  client_id text not null,
  scope text not null default 'mcp:read',
  resource text,
  user_id uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists mcp_oauth_refresh_expires_idx on public.mcp_oauth_refresh_tokens (expires_at);

alter table public.mcp_oauth_clients enable row level security;
alter table public.mcp_oauth_codes enable row level security;
alter table public.mcp_oauth_refresh_tokens enable row level security;

comment on table public.mcp_oauth_clients is 'MCP 커넥터 OAuth 동적 등록 클라이언트 (RFC 7591)';
comment on table public.mcp_oauth_codes is 'MCP 커넥터 OAuth 인가코드 — 1회용, PKCE S256 챌린지 보관';
comment on table public.mcp_oauth_refresh_tokens is 'MCP 커넥터 리프레시 토큰 해시 — 사용 시 회전';
