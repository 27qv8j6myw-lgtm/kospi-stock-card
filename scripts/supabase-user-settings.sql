-- 사용자별 AI 모델 (관리자만 user_settings 수정)
-- 전제: public.holdings, public.activity_logs, public.blocked_users, is_admin() 가 이미 존재
-- user_summary 뷰를 아래 정의로 교체합니다 (차단·last_activity_at·display_name 유지).

-- ---------------------------------------------------------------------------
-- [1-1] user_settings
-- ---------------------------------------------------------------------------
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  ai_model text not null default 'sonnet' check (ai_model in ('opus', 'sonnet', 'fable')),
  set_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists user_settings_ai_model_idx on public.user_settings (ai_model);

alter table public.user_settings enable row level security;

drop policy if exists "Users can view own settings" on public.user_settings;
create policy "Users can view own settings"
  on public.user_settings for select
  using (auth.uid() = user_id);

drop policy if exists "Admins can view all settings" on public.user_settings;
create policy "Admins can view all settings"
  on public.user_settings for select
  using (is_admin());

drop policy if exists "Admins can insert settings" on public.user_settings;
create policy "Admins can insert settings"
  on public.user_settings for insert
  with check (is_admin());

drop policy if exists "Admins can update settings" on public.user_settings;
create policy "Admins can update settings"
  on public.user_settings for update
  using (is_admin());

drop policy if exists "Admins can delete settings" on public.user_settings;
create policy "Admins can delete settings"
  on public.user_settings for delete
  using (is_admin());

-- ---------------------------------------------------------------------------
-- [1-3] get_user_model — 서비스 롤·본인·관리자만 임의 user_id 조회
--        (관리자 계정은 항상 fable — 최상위 모델. 필요 시 IN 목록/관리자 판별 확장)
-- ---------------------------------------------------------------------------
create or replace function public.get_user_model(target_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public, auth
stable
as $$
declare
  jwt_role text;
  em text;
  is_admin_target boolean;
  from_settings text;
begin
  if target_user_id is null then
    return 'sonnet';
  end if;

  jwt_role := nullif(trim(coalesce(current_setting('request.jwt.claim.role', true), '')), '');

  if jwt_role is distinct from 'service_role' and auth.uid() is distinct from target_user_id and not public.is_admin() then
    return 'sonnet';
  end if;

  select lower(trim(coalesce(u.email, ''))) into em
  from auth.users u
  where u.id = target_user_id;

  -- 관리자 판별: 이메일 허용목록(+ 필요 시 역할/테이블 기반으로 확장).
  -- 관리자는 최상위 모델(fable)을 항상 사용.
  is_admin_target := em in ('joongsuc@me.com');

  if is_admin_target then
    return 'fable';
  end if;

  select us.ai_model into from_settings
  from public.user_settings us
  where us.user_id = target_user_id;

  return coalesce(from_settings, 'sonnet');
end;
$$;

revoke all on function public.get_user_model(uuid) from public;
grant execute on function public.get_user_model(uuid) to authenticated;
grant execute on function public.get_user_model(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- [1-4] user_summary (차단·활동·display_name·ai_model 포함)
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
  exists (select 1 from public.blocked_users b where b.user_id = u.id) as is_blocked,
  public.get_user_model(u.id) as ai_model
from auth.users u
left join public.holdings h on h.user_id = u.id
group by u.id, u.email, u.raw_user_meta_data, u.created_at, u.last_sign_in_at;
