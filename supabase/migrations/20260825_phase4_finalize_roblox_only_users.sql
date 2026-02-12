-- Phase 4: finalize Roblox-only user schema.
-- Remove legacy Supabase Auth profile sync and login-only columns.

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_updated on auth.users;

drop function if exists public.sync_app_user_on_auth_update();
drop function if exists public.handle_new_user();

alter table public.app_users
  drop column if exists email,
  drop column if exists email_login_enabled;

-- Progress now belongs to app_users identities, not auth.users identities.
delete from public.user_checklist_progress ucp
where not exists (
  select 1
  from public.app_users au
  where au.user_id = ucp.user_id
);

delete from public.user_quiz_progress uqp
where not exists (
  select 1
  from public.app_users au
  where au.user_id = uqp.user_id
);

alter table public.user_checklist_progress
  drop constraint if exists user_checklist_progress_user_id_fkey;

alter table public.user_checklist_progress
  add constraint user_checklist_progress_user_id_fkey
  foreign key (user_id) references public.app_users(user_id) on delete cascade;

alter table public.user_quiz_progress
  drop constraint if exists user_quiz_progress_user_id_fkey;

alter table public.user_quiz_progress
  add constraint user_quiz_progress_user_id_fkey
  foreign key (user_id) references public.app_users(user_id) on delete cascade;
