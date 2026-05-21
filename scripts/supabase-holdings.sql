-- Phase 1: Supabase SQL Editor 에서 실행 (프로젝트 signal15 등)
-- 계정 차단·is_blocked RLS: 이어서 `scripts/supabase-blocked-users.sql` 실행 권장
-- Google OAuth 는 Authentication → Providers 에서 활성화

create table if not exists public.holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  code text not null,
  stock_name text,
  avg_price numeric not null check (avg_price > 0),
  quantity numeric not null check (quantity > 0),
  stop_loss numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.holdings add column if not exists stock_name text;

create index if not exists holdings_user_id_idx on public.holdings (user_id);

alter table public.holdings enable row level security;

drop policy if exists "Users read own holdings" on public.holdings;
create policy "Users read own holdings" on public.holdings for select using (auth.uid() = user_id);

drop policy if exists "Users insert own holdings" on public.holdings;
create policy "Users insert own holdings" on public.holdings for insert with check (auth.uid() = user_id);

drop policy if exists "Users update own holdings" on public.holdings;
create policy "Users update own holdings" on public.holdings for update using (auth.uid() = user_id);

drop policy if exists "Users delete own holdings" on public.holdings;
create policy "Users delete own holdings" on public.holdings for delete using (auth.uid() = user_id);
