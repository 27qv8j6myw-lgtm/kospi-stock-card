-- Pro 관심 종목 (Supabase SQL Editor에서 실행)
create table if not exists public.pro_watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  code text not null,
  added_at timestamptz default now(),
  note text,
  unique (user_id, code)
);

alter table public.pro_watchlist enable row level security;

drop policy if exists "Own watchlist" on public.pro_watchlist;
create policy "Own watchlist" on public.pro_watchlist
  for all using (auth.uid() = user_id);
