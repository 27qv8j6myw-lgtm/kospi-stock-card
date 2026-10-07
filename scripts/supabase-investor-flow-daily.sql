-- 종목별 투자자 일별 순매수 누적 테이블 (Supabase SQL Editor에서 실행)
--
-- KIS 투자자 API(FHKST01010900)는 최근 30거래일만 돌려주고 과거 기간 지정이 없다.
-- 매일 장 마감 후 cron(/api/cron-investor-flow)이 추적 종목의 30일치를 받아 upsert 하면
-- 시간이 지날수록 긴 시계열이 쌓인다. 금액은 원(KRW) 단위로 환산해 저장한다.
-- 서비스 롤만 쓰므로 RLS 는 켜되 정책은 두지 않는다 (anon/authenticated 접근 불가).
create table if not exists public.investor_flow_daily (
  code text not null,
  trade_date date not null,
  foreign_net_qty bigint,
  foreign_net_amt bigint,
  institution_net_qty bigint,
  institution_net_amt bigint,
  individual_net_qty bigint,
  individual_net_amt bigint,
  fetched_at timestamptz not null default now(),
  primary key (code, trade_date)
);

create index if not exists investor_flow_daily_date_idx on public.investor_flow_daily (trade_date);

alter table public.investor_flow_daily enable row level security;
