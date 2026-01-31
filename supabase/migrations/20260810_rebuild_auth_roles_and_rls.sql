-- Remove legacy admin auth, tighten RLS, and add role-based app users

do $$
declare r record;
begin
  -- Drop existing policies in public schema
  for r in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- Remove legacy admin users table
drop trigger if exists trg_admin_users_updated_at on public.admin_users;
drop table if exists public.admin_users;

-- Role-based app users table
create table if not exists public.app_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('admin','user')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_app_users_role on public.app_users (role);

drop trigger if exists trg_app_users_updated_at on public.app_users;
create trigger trg_app_users_updated_at before update on public.app_users
for each row execute function public.set_updated_at();

create or replace function public.is_admin(user_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_users au
    where au.user_id = user_uuid
      and au.role = 'admin'
  );
$$;

-- Enable RLS everywhere and create admin full-access policy
do $$
declare r record;
begin
  for r in select schemaname, tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I.%I enable row level security', r.schemaname, r.tablename);
  end loop;

  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('drop policy if exists "admin_full_access" on public.%I', r.tablename);
    execute format(
      'create policy "admin_full_access" on public.%I for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()))',
      r.tablename
    );
  end loop;
end $$;

-- App users: self-service access (non-admin)
drop policy if exists "app_users_read_self" on public.app_users;
create policy "app_users_read_self" on public.app_users
  for select using (auth.uid() = user_id);

drop policy if exists "app_users_insert_self" on public.app_users;
create policy "app_users_insert_self" on public.app_users
  for insert with check (auth.uid() = user_id and role = 'user');

drop policy if exists "app_users_update_self" on public.app_users;
create policy "app_users_update_self" on public.app_users
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id and role = 'user');
