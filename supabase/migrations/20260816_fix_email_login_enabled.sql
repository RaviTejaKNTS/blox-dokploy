-- Fix email_login_enabled to only reflect explicit email auth

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  has_email_provider boolean;
begin
  has_email_provider :=
    coalesce(new.raw_app_meta_data->>'provider', '') = 'email'
    or (coalesce(new.raw_app_meta_data->'providers', '[]'::jsonb) ? 'email');

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
    has_email_provider
  )
  on conflict (user_id)
  do update set
    email = excluded.email,
    display_name = excluded.display_name;
  return new;
end;
$$;

update public.app_users au
set
  email_login_enabled = (
    coalesce(u.raw_app_meta_data->>'provider', '') = 'email'
    or (coalesce(u.raw_app_meta_data->'providers', '[]'::jsonb) ? 'email')
  ),
  updated_at = now()
from auth.users u
where au.user_id = u.id;
