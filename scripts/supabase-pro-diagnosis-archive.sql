-- Pro AI 진단 아카이브 (보유/포트폴리오/그룹 진단 영구 보관)
-- 진단이 새로 생성될 때만 service_role 로 1건 insert (캐시 적중은 저장 안 함)
create table if not exists public.pro_diagnosis_archive (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text not null check (kind in ('holding', 'portfolio', 'group')),
  ref_id text,
  code text,
  title text not null,
  analysis text not null,
  profit_pct numeric,
  current_price numeric,
  model text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists pro_diagnosis_archive_user_created_idx
  on public.pro_diagnosis_archive (user_id, created_at desc);

create index if not exists pro_diagnosis_archive_user_kind_created_idx
  on public.pro_diagnosis_archive (user_id, kind, created_at desc);

-- 즐겨찾기(핀) — 강화 기능 (기존 테이블에도 멱등 적용)
alter table public.pro_diagnosis_archive
  add column if not exists pinned boolean not null default false;

create index if not exists pro_diagnosis_archive_user_pinned_created_idx
  on public.pro_diagnosis_archive (user_id, pinned, created_at desc);

-- 종목별 타임라인 조회용 (code 필터)
create index if not exists pro_diagnosis_archive_user_code_created_idx
  on public.pro_diagnosis_archive (user_id, code, created_at desc);

alter table public.pro_diagnosis_archive enable row level security;

drop policy if exists "own diagnosis archive select" on public.pro_diagnosis_archive;
create policy "own diagnosis archive select" on public.pro_diagnosis_archive
  for select using (auth.uid() = user_id);

drop policy if exists "own diagnosis archive insert" on public.pro_diagnosis_archive;
create policy "own diagnosis archive insert" on public.pro_diagnosis_archive
  for insert with check (auth.uid() = user_id);

drop policy if exists "own diagnosis archive delete" on public.pro_diagnosis_archive;
create policy "own diagnosis archive delete" on public.pro_diagnosis_archive
  for delete using (auth.uid() = user_id);

comment on table public.pro_diagnosis_archive is 'Pro AI 진단 아카이브 (생성 시 service_role insert, 사용자별 RLS)';
