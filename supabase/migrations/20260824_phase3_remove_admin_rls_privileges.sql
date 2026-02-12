-- Phase 3: remove broad admin DB privileges.
-- Admin role remains available for UI labeling only.

do $$
declare r record;
begin
  for r in select schemaname, tablename from pg_tables where schemaname = 'public' loop
    execute format('drop policy if exists "admin_full_access" on %I.%I', r.schemaname, r.tablename);
  end loop;
end $$;

drop policy if exists "comments_admin_update" on public.comments;

drop policy if exists "comments_select_public" on public.comments;
create policy "comments_select_public" on public.comments
  for select using (
    status = 'approved'
    or author_id = auth.uid()
  );
