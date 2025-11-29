-- Keep revalidation queue inserts idempotent under the unique (entity_type, slug) constraint.

-- Use distinct parameter names to avoid ambiguity with column names.
create or replace function public.enqueue_revalidation(p_entity_type text, p_slug text, p_source text default null)
returns void
language plpgsql
as $$
begin
  if p_slug is null or trim(p_slug) = '' then
    return;
  end if;

  insert into public.revalidation_events (entity_type, slug, source)
  values (lower(p_entity_type), lower(trim(p_slug)), p_source)
  on conflict on constraint revalidation_events_entity_slug_key
  do update set
    created_at = now(),
    source = excluded.source;
end;
$$;

-- Rewrite the authors trigger inserts to be upserts as well.
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
    and trim(a.slug) <> ''
  on conflict on constraint revalidation_events_entity_slug_key
  do update set
    created_at = now(),
    source = excluded.source;

  -- Revalidate code pages for games attributed to this author
  insert into public.revalidation_events (entity_type, slug, source)
  select distinct 'code', lower(g.slug), 'authors_games_' || lower(tg_op)
  from public.games g
  where g.author_id = author_id
    and g.is_published = true
    and g.slug is not null
    and trim(g.slug) <> ''
  on conflict on constraint revalidation_events_entity_slug_key
  do update set
    created_at = now(),
    source = excluded.source;

  return null;
end;
$$;
