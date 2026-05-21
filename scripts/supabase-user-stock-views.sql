-- 사용자별 종목 조회 집계 뷰 (최근 7일)
-- Supabase SQL Editor 에서 실행 후 검증: select * from user_stock_views limit 5;
--
-- 전제: public.activity_logs 에 action, metadata(jsonb), user_id, created_at 존재

create or replace view public.user_stock_views as
select
  user_id,
  metadata->>'code' as code,
  metadata->>'name' as name,
  count(*)::bigint as view_count,
  max(created_at) as last_viewed_at,
  min(created_at) as first_viewed_at
from public.activity_logs
where
  action = 'view_stock'
  and created_at > now() - interval '7 days'
  and coalesce(metadata->>'code', '') <> ''
group by user_id, metadata->>'code', metadata->>'name';

comment on view public.user_stock_views is '최근 7일 view_stock 활동 집계 — activity_logs 기반';
