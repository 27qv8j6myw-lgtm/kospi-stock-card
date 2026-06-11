-- Pro 매매일지 (RLS: 본인만) — Supabase SQL Editor
create table if not exists public.pro_trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  group_id uuid references public.pro_groups (id) on delete set null,
  code text not null,
  name text,
  side text not null check (side in ('buy', 'sell')),
  quantity numeric not null check (quantity > 0),
  price numeric not null check (price > 0),
  traded_at date not null default current_date,
  memo text,
  -- 기록 삭제 시 역방향 보정용 스냅샷
  avg_price_at_trade numeric,        -- 거래 직전 보유 평단 (매도 복원·매수 되돌리기)
  realized_profit numeric,           -- 매도 시 실현손익 = (매도가 - 평단) × 수량
  created_at timestamptz not null default now()
);

create index if not exists pro_trades_user_id_idx on public.pro_trades (user_id);
create index if not exists pro_trades_user_code_idx on public.pro_trades (user_id, code);
create index if not exists pro_trades_group_id_idx on public.pro_trades (group_id);

alter table public.pro_trades enable row level security;

drop policy if exists "Users read own pro_trades" on public.pro_trades;
create policy "Users read own pro_trades"
  on public.pro_trades for select using (auth.uid() = user_id);

drop policy if exists "Users insert own pro_trades" on public.pro_trades;
create policy "Users insert own pro_trades"
  on public.pro_trades for insert with check (auth.uid() = user_id);

drop policy if exists "Users delete own pro_trades" on public.pro_trades;
create policy "Users delete own pro_trades"
  on public.pro_trades for delete using (auth.uid() = user_id);

comment on table public.pro_trades is 'Pro 매매일지 — 거래 단위 기록, 보유종목/실현손익 자동 갱신의 원본';
