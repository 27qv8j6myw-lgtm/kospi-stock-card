-- 계정 차단(P0): Supabase SQL Editor 에서 순서대로 실행
-- 전제: public.holdings, public.activity_logs, is_admin() RPC 가 이미 존재

-- ---------------------------------------------------------------------------
-- [1-1] blocked_users
-- ---------------------------------------------------------------------------
create table if not exists public.blocked_users (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users (id) on delete cascade not null unique,
  blocked_by uuid references auth.users (id) on delete restrict not null,
  reason text,
  blocked_at timestamptz default now() not null
);

create index if not exists blocked_users_user_id_idx on public.blocked_users (user_id);

alter table public.blocked_users enable row level security;

drop policy if exists "Users can check own block status" on public.blocked_users;
create policy "Users can check own block status"
  on public.blocked_users for select
  using (auth.uid() = user_id);

drop policy if exists "Admins can view all blocks" on public.blocked_users;
create policy "Admins can view all blocks"
  on public.blocked_users for select
  using (is_admin());

drop policy if exists "Admins can insert blocks" on public.blocked_users;
create policy "Admins can insert blocks"
  on public.blocked_users for insert
  with check (is_admin());

drop policy if exists "Admins can delete blocks" on public.blocked_users;
create policy "Admins can delete blocks"
  on public.blocked_users for delete
  using (is_admin());

-- ---------------------------------------------------------------------------
-- [1-3] is_blocked() — RLS 에서 사용 (SECURITY DEFINER)
-- ---------------------------------------------------------------------------
create or replace function public.is_blocked()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    exists (
      select 1 from public.blocked_users b
      where b.user_id = auth.uid()
    ),
    false
  );
$$;

revoke all on function public.is_blocked() from public;
grant execute on function public.is_blocked() to authenticated;

-- ---------------------------------------------------------------------------
-- [1-4] holdings — 차단 시 본인 CRUD 불가 (정책 이름: 레포 기준 + 스펙 별칭)
-- ---------------------------------------------------------------------------
drop policy if exists "Users read own holdings" on public.holdings;
drop policy if exists "Users insert own holdings" on public.holdings;
drop policy if exists "Users update own holdings" on public.holdings;
drop policy if exists "Users delete own holdings" on public.holdings;
drop policy if exists "Users can view own holdings" on public.holdings;
drop policy if exists "Users can insert own holdings" on public.holdings;
drop policy if exists "Users can update own holdings" on public.holdings;
drop policy if exists "Users can delete own holdings" on public.holdings;

create policy "Users read own holdings"
  on public.holdings for select
  using (auth.uid() = user_id and not public.is_blocked());

create policy "Users insert own holdings"
  on public.holdings for insert
  with check (auth.uid() = user_id and not public.is_blocked());

create policy "Users update own holdings"
  on public.holdings for update
  using (auth.uid() = user_id and not public.is_blocked());

create policy "Users delete own holdings"
  on public.holdings for delete
  using (auth.uid() = user_id and not public.is_blocked());

-- ---------------------------------------------------------------------------
-- [1-4b] activity_logs — 차단 시 insert 불가 (테이블 없으면 holdings 만 먼저 적용)
-- ---------------------------------------------------------------------------
do $$
declare
  pol record;
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'activity_logs'
  ) then
    for pol in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = 'activity_logs'
    loop
      execute format('drop policy if exists %I on public.activity_logs', pol.policyname);
    end loop;

    execute 'alter table public.activity_logs enable row level security';

    execute $p$
      create policy "Users insert own activity_logs"
        on public.activity_logs for insert
        with check (auth.uid() = user_id and not public.is_blocked())
    $p$;

    execute $p$
      create policy "Admins read activity_logs"
        on public.activity_logs for select
        using (is_admin())
    $p$;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- [1-5] user_summary — is_blocked + last_activity_at (관리자 목록 정렬 유지)
-- `ai_model` 은 `scripts/supabase-user-settings.sql` 실행 후 뷰에 포함됩니다.
-- ---------------------------------------------------------------------------
create or replace view public.user_summary as
select
  u.id as user_id,
  u.email,
  u.raw_user_meta_data->>'full_name' as full_name,
  u.raw_user_meta_data->>'display_name' as display_name,
  u.raw_user_meta_data->>'avatar_url' as avatar_url,
  u.created_at as user_created_at,
  u.last_sign_in_at,
  (
    select max(al.created_at)
    from public.activity_logs al
    where al.user_id = u.id
  ) as last_activity_at,
  count(distinct h.id)::bigint as holdings_count,
  exists (select 1 from public.blocked_users b where b.user_id = u.id) as is_blocked
from auth.users u
left join public.holdings h on h.user_id = u.id
group by u.id, u.email, u.raw_user_meta_data, u.created_at, u.last_sign_in_at;
