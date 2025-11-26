-- Expand revalidation events to cover authors and universe-driven updates.

-- Allow the new entity type
alter table public.revalidation_events
  drop constraint if exists revalidation_events_entity_type_check;

alter table public.revalidation_events
  add constraint revalidation_events_entity_type_check
  check (entity_type in ('code','article','list','author'));

-- Authors trigger: revalidate author pages plus their games/articles
create or replace function public.trg_enqueue_revalidation_authors()
returns trigger
language plpgsql
as $$
declare
  author_id uuid;
  author_slug text;
begin
  author_id := coalesce(new.id, old.id);
  author_slug := coalesce(new.slug, old.slug);

  if author_slug is not null and trim(author_slug) <> '' then
    perform public.enqueue_revalidation('author', author_slug, 'authors_' || lower(tg_op));
  end if;

  -- Revalidate articles authored by this author
  insert into public.revalidation_events (entity_type, slug, source)
  select distinct 'article', lower(a.slug), 'authors_articles_' || lower(tg_op)
  from public.articles a
  where a.author_id = author_id
    and a.slug is not null
    and trim(a.slug) <> '';

  -- Revalidate code pages for games attributed to this author
  insert into public.revalidation_events (entity_type, slug, source)
  select distinct 'code', lower(g.slug), 'authors_games_' || lower(tg_op)
  from public.games g
  where g.author_id = author_id
    and g.is_published = true
    and g.slug is not null
    and trim(g.slug) <> '';

  return null;
end;
$$;

drop trigger if exists trg_enqueue_revalidation_authors on public.authors;
create trigger trg_enqueue_revalidation_authors
after insert or update or delete on public.authors
for each row execute function public.trg_enqueue_revalidation_authors();

-- Roblox universe triggers removed to avoid high-churn revalidation noise.
