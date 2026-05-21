-- activity_logs.is_pro — Pro 모드 조회 구분 (없을 때만 실행)
alter table public.activity_logs
  add column if not exists is_pro boolean not null default false;

create index if not exists activity_logs_is_pro_created_at_idx
  on public.activity_logs (is_pro, action, created_at desc);
