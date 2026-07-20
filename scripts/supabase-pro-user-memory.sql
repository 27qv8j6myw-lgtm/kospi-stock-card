create table if not exists public.pro_user_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  content text not null,
  source_conversation_id uuid,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists pro_user_memory_user_created_idx
  on public.pro_user_memory (user_id, created_at desc);

alter table public.pro_user_memory enable row level security;

drop policy if exists "own memory select" on public.pro_user_memory;
create policy "own memory select" on public.pro_user_memory
  for select using (auth.uid() = user_id);

drop policy if exists "own memory insert" on public.pro_user_memory;
create policy "own memory insert" on public.pro_user_memory
  for insert with check (auth.uid() = user_id);

drop policy if exists "own memory delete" on public.pro_user_memory;
create policy "own memory delete" on public.pro_user_memory
  for delete using (auth.uid() = user_id);
