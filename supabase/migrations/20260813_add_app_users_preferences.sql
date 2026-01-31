-- Add preferences JSON to app_users for user settings (theme, etc.)

alter table public.app_users
  add column if not exists preferences jsonb not null default '{}'::jsonb;

-- Backfill in case any rows were created before the column existed
update public.app_users
set preferences = '{}'::jsonb
where preferences is null;
