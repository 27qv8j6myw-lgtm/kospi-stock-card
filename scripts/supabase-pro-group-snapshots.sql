-- Pro 보유 그룹 일별 평가 스냅샷 (Cron → pro_group_snapshots)
create table if not exists public.pro_group_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  group_id uuid not null,
  snapshot_date date not null,
  total_value numeric not null default 0,
  stock_value numeric not null default 0,
  cash_balance numeric not null default 0,
  initial_capital numeric not null default 0,
  return_pct numeric,
  created_at timestamptz not null default now(),
  unique (user_id, group_id, snapshot_date)
);

create index if not exists pro_group_snapshots_user_date_idx
  on public.pro_group_snapshots (user_id, snapshot_date);

alter table public.pro_group_snapshots enable row level security;

drop policy if exists "own snapshots" on public.pro_group_snapshots;
create policy "own snapshots" on public.pro_group_snapshots
  for select using (auth.uid() = user_id);

comment on table public.pro_group_snapshots is 'Pro 그룹 일별 평가·수익률 (Vercel Cron, service_role insert)';
