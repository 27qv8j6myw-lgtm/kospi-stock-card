-- Pro API usage (Anthropic token tracking) — 이미 생성된 경우 스킵
create table if not exists public.pro_api_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  model text not null default 'claude-opus-4-7',
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists pro_api_usage_created_at_idx
  on public.pro_api_usage (created_at desc);

create index if not exists pro_api_usage_user_id_idx
  on public.pro_api_usage (user_id, created_at desc);
