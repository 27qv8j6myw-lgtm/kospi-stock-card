create table if not exists public.pro_screener_archive (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  archive_date date not null,
  generated_at timestamptz,
  model text,
  items jsonb not null default '[]'::jsonb,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, archive_date)
);

create index if not exists pro_screener_archive_user_created_idx
  on public.pro_screener_archive (user_id, created_at desc);

create index if not exists pro_screener_archive_user_pinned_created_idx
  on public.pro_screener_archive (user_id, pinned, created_at desc);

alter table public.pro_screener_archive enable row level security;

drop policy if exists "own screener archive select" on public.pro_screener_archive;
create policy "own screener archive select" on public.pro_screener_archive
  for select using (auth.uid() = user_id);

drop policy if exists "own screener archive insert" on public.pro_screener_archive;
create policy "own screener archive insert" on public.pro_screener_archive
  for insert with check (auth.uid() = user_id);

drop policy if exists "own screener archive delete" on public.pro_screener_archive;
create policy "own screener archive delete" on public.pro_screener_archive
  for delete using (auth.uid() = user_id);
