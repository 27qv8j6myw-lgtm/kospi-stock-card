-- Pro 모드 접근: user_settings.pro_enabled
-- Supabase SQL Editor에서 실행

alter table public.user_settings
  add column if not exists pro_enabled boolean not null default false;

-- 기존 Pro 계정 기본 활성화
update public.user_settings us
set pro_enabled = true
where us.user_id in (
  select id from auth.users where lower(trim(email)) = 'joongsuc@me.com'
);

-- user_settings 행이 없는 joongsuc 계정
insert into public.user_settings (user_id, ai_model, pro_enabled)
select u.id, 'opus', true
from auth.users u
where lower(trim(u.email)) = 'joongsuc@me.com'
  and not exists (select 1 from public.user_settings s where s.user_id = u.id)
on conflict (user_id) do update set pro_enabled = true;

-- user_summary 에 pro_enabled 노출 (관리자 목록 select *)
-- 기존 뷰에 ai_model·ai_enabled 가 있으면 해당 컬럼도 유지하세요.
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
  public.get_user_model(u.id) as ai_model,
  coalesce(us.ai_enabled, false) as ai_enabled,
  coalesce(us.pro_enabled, false) as pro_enabled
from auth.users u
left join public.holdings h on h.user_id = u.id
left join public.user_settings us on us.user_id = u.id
group by u.id, u.email, u.raw_user_meta_data, u.created_at, u.last_sign_in_at, us.ai_enabled, us.pro_enabled;
