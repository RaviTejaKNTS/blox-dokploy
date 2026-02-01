-- Store user checklist progress (account-scoped)
create table if not exists public.user_checklist_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  checklist_slug text not null,
  checked_item_ids text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, checklist_slug)
);

create index if not exists idx_user_checklist_progress_slug
  on public.user_checklist_progress (checklist_slug);

alter table public.user_checklist_progress enable row level security;

drop policy if exists "admin_full_access" on public.user_checklist_progress;
create policy "admin_full_access" on public.user_checklist_progress
  for all using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "user_checklist_progress_select_own" on public.user_checklist_progress;
create policy "user_checklist_progress_select_own" on public.user_checklist_progress
  for select using (auth.uid() = user_id);

drop policy if exists "user_checklist_progress_insert_own" on public.user_checklist_progress;
create policy "user_checklist_progress_insert_own" on public.user_checklist_progress
  for insert with check (auth.uid() = user_id);

drop policy if exists "user_checklist_progress_update_own" on public.user_checklist_progress;
create policy "user_checklist_progress_update_own" on public.user_checklist_progress
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_checklist_progress_delete_own" on public.user_checklist_progress;
create policy "user_checklist_progress_delete_own" on public.user_checklist_progress
  for delete using (auth.uid() = user_id);

drop trigger if exists trg_user_checklist_progress_updated_at on public.user_checklist_progress;
create trigger trg_user_checklist_progress_updated_at
before update on public.user_checklist_progress
for each row execute function public.set_updated_at();
