-- Sync app_users with auth.users email + display name

alter table public.app_users
  add column if not exists email text,
  add column if not exists display_name text,
  add column if not exists email_login_enabled boolean not null default false;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_users (user_id, role, email, display_name, email_login_enabled)
  values (
    new.id,
    'user',
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'display_name',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    new.encrypted_password is not null
  )
  on conflict (user_id)
  do update set
    email = excluded.email,
    display_name = excluded.display_name;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.sync_app_user_on_auth_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.app_users
    set email = new.email,
        display_name = coalesce(
          new.raw_user_meta_data->>'full_name',
          new.raw_user_meta_data->>'name',
          new.raw_user_meta_data->>'display_name',
          split_part(coalesce(new.email, ''), '@', 1)
        ),
        updated_at = now()
  where user_id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
after update of email, raw_user_meta_data on auth.users
for each row execute function public.sync_app_user_on_auth_update();

-- Backfill existing rows
update public.app_users au
set
  email = u.email,
  display_name = coalesce(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    u.raw_user_meta_data->>'display_name',
    split_part(coalesce(u.email, ''), '@', 1)
  ),
  email_login_enabled = (u.encrypted_password is not null),
  updated_at = now()
from auth.users u
where au.user_id = u.id;
