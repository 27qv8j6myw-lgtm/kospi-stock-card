-- 사용자별 AI 작업량(토큰 예산 단계) — 관리자 사용자 탭에서 선택
-- 단계: high(높음, 기본) · extra(추가) · max(최대)
-- 전제: public.user_settings 가 이미 존재 (scripts/supabase-user-settings.sql)

alter table public.user_settings
  add column if not exists ai_workload text not null default 'high'
  check (ai_workload in ('high', 'extra', 'max'));

-- 관리자 계정은 최대로 (선택)
update public.user_settings us
set ai_workload = 'max'
where us.user_id in (
  select id from auth.users where lower(trim(email)) = 'joongsuc@me.com'
);
