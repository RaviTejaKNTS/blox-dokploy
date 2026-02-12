-- Phase 1: Roblox-only auth foundation (no dependency on Supabase Auth users)

-- Allow app users that do not exist in auth.users.
alter table public.app_users
  drop constraint if exists app_users_user_id_fkey;

-- Keep UUID keys generated inside the app user domain.
alter table public.app_users
  alter column user_id set default uuid_generate_v4();

-- Server-managed application sessions (revocable).
create table if not exists public.app_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.app_users(user_id) on delete cascade,
  user_agent text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_app_sessions_user_id on public.app_sessions (user_id);
create index if not exists idx_app_sessions_expires_at on public.app_sessions (expires_at);
create index if not exists idx_app_sessions_revoked_at on public.app_sessions (revoked_at);

drop trigger if exists trg_app_sessions_updated_at on public.app_sessions;
create trigger trg_app_sessions_updated_at
before update on public.app_sessions
for each row execute function public.set_updated_at();

alter table public.app_sessions enable row level security;
