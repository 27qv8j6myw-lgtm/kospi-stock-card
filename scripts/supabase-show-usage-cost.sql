-- 상단 누적 사용금액(USD) 배지 노출: user_settings.show_usage_cost
-- 관리자 사용자 리스트의 토글로 개인별 ON/OFF 제어
-- Supabase SQL Editor에서 실행

alter table public.user_settings
  add column if not exists show_usage_cost boolean not null default false;

-- 관리자 계정 기본 활성화 (즉시 확인용)
update public.user_settings us
set show_usage_cost = true
where us.user_id in (
  select id from auth.users where lower(trim(email)) = 'joongsuc@me.com'
);

insert into public.user_settings (user_id, ai_model, show_usage_cost)
select u.id, 'opus', true
from auth.users u
where lower(trim(u.email)) = 'joongsuc@me.com'
  and not exists (select 1 from public.user_settings s where s.user_id = u.id)
on conflict (user_id) do update set show_usage_cost = true;

-- 참고: 관리자 사용자 리스트(AdminPage)는 user_settings 를 직접 읽어 show_usage_cost 를
-- 병합하므로 user_summary 뷰는 갱신할 필요가 없습니다.
-- (뷰에 노출하고 싶다면 기존 컬럼 순서를 그대로 둔 채 맨 끝에만 컬럼을 추가해야 합니다.
--  create or replace view 는 컬럼명/순서 변경을 허용하지 않습니다.)
