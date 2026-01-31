create table if not exists public.comments (
  id uuid primary key default uuid_generate_v4(),
  entity_type text not null check (entity_type in ('code', 'article', 'catalog', 'event', 'list', 'tool')),
  entity_id uuid not null,
  parent_id uuid references public.comments(id) on delete cascade,
  author_id uuid not null references public.app_users(user_id) on delete cascade,
  body_md text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'deleted')),
  moderation jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_comments_entity_created on public.comments (entity_type, entity_id, created_at desc);
create index if not exists idx_comments_parent on public.comments (parent_id);
create index if not exists idx_comments_author on public.comments (author_id);

create trigger trg_comments_updated_at
before update on public.comments
for each row
execute function public.set_updated_at();

alter table public.comments enable row level security;

drop policy if exists "comments_select_public" on public.comments;
create policy "comments_select_public" on public.comments
  for select using (
    status = 'approved'
    or author_id = auth.uid()
    or public.is_admin(auth.uid())
  );

drop policy if exists "comments_insert_authenticated" on public.comments;
create policy "comments_insert_authenticated" on public.comments
  for insert with check (
    auth.uid() = author_id
    and status = 'pending'
    and moderation is null
  );

drop policy if exists "comments_admin_update" on public.comments;
create policy "comments_admin_update" on public.comments
  for update using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "comments_update_own" on public.comments;
create policy "comments_update_own" on public.comments
  for update using (auth.uid() = author_id)
  with check (
    auth.uid() = author_id
    and status = 'pending'
    and moderation is null
  );

drop policy if exists "comments_delete_own" on public.comments;
create policy "comments_delete_own" on public.comments
  for delete using (auth.uid() = author_id);

create or replace function public.trg_comments_revalidate_code()
returns trigger
language plpgsql
as $$
begin
  if new.entity_type = 'code' and new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    insert into public.revalidation_events (entity_type, slug, source)
    select 'code', g.slug, 'comment'
    from public.games g
    where g.id = new.entity_id
    on conflict (entity_type, slug)
    do update set
      source = excluded.source,
      created_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_comments_revalidate_code on public.comments;
create trigger trg_comments_revalidate_code
after insert or update on public.comments
for each row execute function public.trg_comments_revalidate_code();
