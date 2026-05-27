-- Pro 보유종목 (RLS: 본인만) — Supabase SQL Editor
create table if not exists public.pro_holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  code text not null,
  name text,
  quantity numeric not null check (quantity > 0),
  avg_price numeric not null check (avg_price > 0),
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, code)
);

create index if not exists pro_holdings_user_id_idx on public.pro_holdings (user_id);

alter table public.pro_holdings enable row level security;

drop policy if exists "Users read own pro_holdings" on public.pro_holdings;
create policy "Users read own pro_holdings"
  on public.pro_holdings for select using (auth.uid() = user_id);

drop policy if exists "Users insert own pro_holdings" on public.pro_holdings;
create policy "Users insert own pro_holdings"
  on public.pro_holdings for insert with check (auth.uid() = user_id);

drop policy if exists "Users update own pro_holdings" on public.pro_holdings;
create policy "Users update own pro_holdings"
  on public.pro_holdings for update using (auth.uid() = user_id);

drop policy if exists "Users delete own pro_holdings" on public.pro_holdings;
create policy "Users delete own pro_holdings"
  on public.pro_holdings for delete using (auth.uid() = user_id);
