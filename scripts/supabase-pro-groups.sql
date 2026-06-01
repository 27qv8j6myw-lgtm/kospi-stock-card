-- Pro 보유 그룹 (RLS: 본인만) — Supabase SQL Editor
create table if not exists public.pro_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.pro_groups add column if not exists realized_profit numeric default 0;

alter table public.pro_holdings add column if not exists group_id uuid references public.pro_groups (id) on delete set null;

create index if not exists pro_groups_user_id_idx on public.pro_groups (user_id);
create index if not exists pro_holdings_group_id_idx on public.pro_holdings (group_id);

alter table public.pro_groups enable row level security;

drop policy if exists "Users read own pro_groups" on public.pro_groups;
create policy "Users read own pro_groups"
  on public.pro_groups for select using (auth.uid() = user_id);

drop policy if exists "Users insert own pro_groups" on public.pro_groups;
create policy "Users insert own pro_groups"
  on public.pro_groups for insert with check (auth.uid() = user_id);

drop policy if exists "Users update own pro_groups" on public.pro_groups;
create policy "Users update own pro_groups"
  on public.pro_groups for update using (auth.uid() = user_id);

drop policy if exists "Users delete own pro_groups" on public.pro_groups;
create policy "Users delete own pro_groups"
  on public.pro_groups for delete using (auth.uid() = user_id);
