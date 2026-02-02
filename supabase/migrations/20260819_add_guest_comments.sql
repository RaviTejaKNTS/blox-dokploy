alter table public.comments
  alter column author_id drop not null,
  add column if not exists guest_name text,
  add column if not exists guest_email text;

drop policy if exists "comments_insert_authenticated" on public.comments;
create policy "comments_insert_authenticated" on public.comments
  for insert with check (
    auth.uid() = author_id
    and status = 'pending'
    and moderation is null
  );

drop policy if exists "comments_insert_guest" on public.comments;
create policy "comments_insert_guest" on public.comments
  for insert with check (
    auth.uid() is null
    and author_id is null
    and guest_name is not null
    and length(trim(guest_name)) >= 2
    and guest_email is not null
    and position('@' in guest_email) > 1
    and status = 'pending'
    and moderation is null
  );
