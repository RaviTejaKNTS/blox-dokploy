-- Link Roblox account data directly on app_users (one link per user)

alter table public.app_users
  add column if not exists roblox_user_id bigint,
  add column if not exists roblox_username text,
  add column if not exists roblox_display_name text,
  add column if not exists roblox_profile_url text,
  add column if not exists roblox_avatar_url text,
  add column if not exists roblox_linked_at timestamptz;

create unique index if not exists idx_app_users_roblox_user_id
  on public.app_users (roblox_user_id)
  where roblox_user_id is not null;

-- Migrate data from legacy user_roblox_links table if it exists, then drop it.
do $$
begin
  if to_regclass('public.user_roblox_links') is not null then
    update public.app_users au
    set roblox_user_id = ul.roblox_user_id,
        roblox_username = ul.roblox_username,
        roblox_display_name = ul.roblox_display_name,
        roblox_profile_url = ul.profile_url,
        roblox_avatar_url = ul.avatar_url,
        roblox_linked_at = ul.linked_at
    from public.user_roblox_links ul
    where au.user_id = ul.user_id;

    drop table if exists public.user_roblox_links cascade;
  end if;
end $$;
