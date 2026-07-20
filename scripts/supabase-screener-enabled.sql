alter table public.user_settings
  add column if not exists screener_enabled boolean not null default false;
