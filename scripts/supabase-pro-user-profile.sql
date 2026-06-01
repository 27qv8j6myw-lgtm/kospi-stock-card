-- Pro 투자 프로필 (성향/기간/목표) — user_settings 확장
-- (레거시) pro_user_profiles 테이블이 있다면 아래 ALTER도 실행 가능:
--   ALTER TABLE pro_user_profiles ADD COLUMN IF NOT EXISTS risk_profile text;
--   ALTER TABLE pro_user_profiles ADD COLUMN IF NOT EXISTS invest_horizon text;
--   ALTER TABLE pro_user_profiles ADD COLUMN IF NOT EXISTS profit_goal text;
-- 본 앱은 user_settings 컬럼을 사용합니다.
-- Supabase SQL Editor에서 실행

alter table public.user_settings
  add column if not exists risk_profile text,
  add column if not exists invest_horizon text,
  add column if not exists profit_goal text;

comment on column public.user_settings.risk_profile is '투자성향: 안정형|안정추구형|위험중립형|적극투자형|공격투자형';
comment on column public.user_settings.invest_horizon is '투자기간: 단기|중기|장기';
comment on column public.user_settings.profit_goal is '목표수익: 안정수익|시장수익|고수익';

-- 본인 프로필 수정 (관리자 전용 update 정책과 별도)
drop policy if exists "Users can update own invest profile" on public.user_settings;
create policy "Users can update own invest profile"
  on public.user_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can insert own settings row" on public.user_settings;
create policy "Users can insert own settings row"
  on public.user_settings for insert
  with check (auth.uid() = user_id);
