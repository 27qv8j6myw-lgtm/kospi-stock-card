-- Pro 장 마감 데일리 브리핑 (Cron → pro_daily_briefings) — Supabase SQL Editor
create table if not exists public.pro_daily_briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  brief_date date not null,
  content text not null,
  stats jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, brief_date)
);

create index if not exists pro_daily_briefings_user_date_idx
  on public.pro_daily_briefings (user_id, brief_date desc);

alter table public.pro_daily_briefings enable row level security;

drop policy if exists "Users read own pro_daily_briefings" on public.pro_daily_briefings;
create policy "Users read own pro_daily_briefings"
  on public.pro_daily_briefings for select using (auth.uid() = user_id);

comment on table public.pro_daily_briefings is 'Pro 장 마감 데일리 브리핑 (Vercel Cron, service_role insert)';
