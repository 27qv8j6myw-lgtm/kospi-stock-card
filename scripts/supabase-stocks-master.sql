-- stocks_master: 종목 검색·표시용 (service_role 로 시드/조회)
create table if not exists public.stocks_master (
  code text primary key,
  name text not null,
  market text,
  sector text,
  updated_at timestamptz not null default now()
);

comment on table public.stocks_master is 'KOSPI/KOSDAQ 마스터 — DART 동기화(`npm run sync:stocks-master`) 또는 시드';

-- DART corp_code (선택): scripts/supabase-stocks-master-corp-code.sql 참고
