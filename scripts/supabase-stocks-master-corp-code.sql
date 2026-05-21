-- stocks_master: DART corp_code · 검색 인덱스 (선택)
alter table public.stocks_master
  add column if not exists corp_code text;

create index if not exists idx_stocks_master_corp_code on public.stocks_master (corp_code);
create index if not exists idx_stocks_master_name on public.stocks_master (name);

comment on column public.stocks_master.corp_code is 'OpenDART 고유번호 (공시 API용)';
