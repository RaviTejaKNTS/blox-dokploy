-- Unified search index for global site search
create extension if not exists pg_trgm;

create table if not exists public.search_index (
  id uuid primary key default uuid_generate_v4(),
  entity_type text not null,
  entity_id text not null,
  slug text not null,
  title text not null,
  subtitle text,
  url text not null,
  updated_at timestamptz,
  is_published boolean not null default true,
  search_text text not null default '',
  search_vector tsvector generated always as (to_tsvector('english', search_text)) stored
);

create unique index if not exists idx_search_index_entity on public.search_index (entity_type, entity_id);
create index if not exists idx_search_index_type_slug on public.search_index (entity_type, slug);
create index if not exists idx_search_index_published_updated on public.search_index (is_published, updated_at desc);
create index if not exists idx_search_index_vector on public.search_index using gin (search_vector);
create index if not exists idx_search_index_search_text_trgm on public.search_index using gin (search_text gin_trgm_ops);

create or replace function public.upsert_search_index(
  p_entity_type text,
  p_entity_id text,
  p_slug text,
  p_title text,
  p_subtitle text,
  p_url text,
  p_updated_at timestamptz,
  p_is_published boolean,
  p_search_text text
)
returns void
language plpgsql
as $$
begin
  if p_entity_id is null or trim(p_entity_id) = '' then
    return;
  end if;
  if p_slug is null or trim(p_slug) = '' then
    return;
  end if;
  if p_title is null or trim(p_title) = '' then
    return;
  end if;
  if p_url is null or trim(p_url) = '' then
    return;
  end if;

  insert into public.search_index (
    entity_type,
    entity_id,
    slug,
    title,
    subtitle,
    url,
    updated_at,
    is_published,
    search_text
  )
  values (
    lower(p_entity_type),
    p_entity_id,
    lower(trim(p_slug)),
    p_title,
    p_subtitle,
    p_url,
    p_updated_at,
    coalesce(p_is_published, false),
    coalesce(p_search_text, '')
  )
  on conflict (entity_type, entity_id)
  do update set
    slug = excluded.slug,
    title = excluded.title,
    subtitle = excluded.subtitle,
    url = excluded.url,
    updated_at = excluded.updated_at,
    is_published = excluded.is_published,
    search_text = excluded.search_text;
end;
$$;

create or replace function public.search_site(
  p_query text,
  p_limit integer default 120,
  p_offset integer default 0
)
returns table (
  entity_type text,
  entity_id text,
  slug text,
  title text,
  subtitle text,
  url text,
  updated_at timestamptz,
  active_code_count bigint
)
language plpgsql
stable
as $$
declare
  v_query text := trim(coalesce(p_query, ''));
  v_limit integer := greatest(1, least(coalesce(p_limit, 120), 200));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
begin
  if v_query = '' then
    return;
  end if;

  return query
  with q as (
    select websearch_to_tsquery('english', v_query) as tsq
  )
  select
    si.entity_type,
    si.entity_id,
    si.slug,
    si.title,
    si.subtitle,
    si.url,
    coalesce(g.content_updated_at, si.updated_at) as updated_at,
    case when si.entity_type = 'code' then g.active_code_count else null end as active_code_count
  from public.search_index si
  cross join q
  left join public.game_pages_index_view g
    on si.entity_type = 'code'
    and g.id::text = si.entity_id
  where si.is_published = true
    and (
      si.search_vector @@ q.tsq
      or si.search_text ilike '%' || v_query || '%'
    )
  order by
    greatest(
      ts_rank_cd(si.search_vector, q.tsq),
      similarity(si.search_text, v_query)
    ) desc,
    updated_at desc nulls last
  limit v_limit
  offset v_offset;
end;
$$;

create or replace function public.trg_search_index_games()
returns trigger
language plpgsql
as $$
declare
  v_search text;
begin
  if (tg_op = 'DELETE') then
    delete from public.search_index
    where entity_type = 'code'
      and entity_id = old.id::text;
    return null;
  end if;

  v_search := left(
    concat_ws(
      ' ',
      new.name,
      new.slug,
      array_to_string(new.old_slugs, ' '),
      new.seo_title,
      new.seo_description,
      new.intro_md,
      new.description_md,
      new.find_codes_md,
      new.about_game_md
    ),
    4000
  );

  perform public.upsert_search_index(
    'code',
    new.id::text,
    new.slug,
    new.name,
    'Codes',
    '/codes/' || new.slug,
    new.updated_at,
    new.is_published,
    v_search
  );

  return null;
end;
$$;

create or replace function public.trg_search_index_articles()
returns trigger
language plpgsql
as $$
declare
  v_search text;
begin
  if (tg_op = 'DELETE') then
    delete from public.search_index
    where entity_type = 'article'
      and entity_id = old.id::text;
    return null;
  end if;

  v_search := left(
    concat_ws(
      ' ',
      new.title,
      new.slug,
      new.meta_description,
      new.content_md
    ),
    4000
  );

  perform public.upsert_search_index(
    'article',
    new.id::text,
    new.slug,
    new.title,
    'Article',
    '/articles/' || new.slug,
    new.updated_at,
    new.is_published,
    v_search
  );

  return null;
end;
$$;

create or replace function public.trg_search_index_checklists()
returns trigger
language plpgsql
as $$
declare
  v_search text;
begin
  if (tg_op = 'DELETE') then
    delete from public.search_index
    where entity_type = 'checklist'
      and entity_id = old.id::text;
    return null;
  end if;

  v_search := left(
    concat_ws(
      ' ',
      new.title,
      new.slug,
      new.description_md,
      new.seo_description
    ),
    3000
  );

  perform public.upsert_search_index(
    'checklist',
    new.id::text,
    new.slug,
    new.title,
    'Checklist',
    '/checklists/' || new.slug,
    new.updated_at,
    new.is_public,
    v_search
  );

  return null;
end;
$$;

create or replace function public.trg_search_index_game_lists()
returns trigger
language plpgsql
as $$
declare
  v_title text;
  v_search text;
begin
  if (tg_op = 'DELETE') then
    delete from public.search_index
    where entity_type = 'list'
      and entity_id = old.id::text;
    return null;
  end if;

  v_title := coalesce(new.display_name, new.title);
  v_search := left(
    concat_ws(
      ' ',
      v_title,
      new.title,
      new.slug,
      new.meta_title,
      new.meta_description,
      new.hero_md,
      new.intro_md,
      new.outro_md
    ),
    3000
  );

  perform public.upsert_search_index(
    'list',
    new.id::text,
    new.slug,
    v_title,
    'List',
    '/lists/' || new.slug,
    new.updated_at,
    new.is_published,
    v_search
  );

  return null;
end;
$$;

create or replace function public.trg_search_index_tools()
returns trigger
language plpgsql
as $$
declare
  v_search text;
begin
  if (tg_op = 'DELETE') then
    delete from public.search_index
    where entity_type = 'tool'
      and entity_id = old.id::text;
    return null;
  end if;

  v_search := left(
    concat_ws(
      ' ',
      new.title,
      new.code,
      new.seo_title,
      new.meta_description,
      new.intro_md,
      new.how_it_works_md
    ),
    3000
  );

  perform public.upsert_search_index(
    'tool',
    new.id::text,
    new.code,
    new.title,
    'Tool',
    '/tools/' || new.code,
    new.updated_at,
    new.is_published,
    v_search
  );

  return null;
end;
$$;

create or replace function public.trg_search_index_catalog_pages()
returns trigger
language plpgsql
as $$
declare
  v_search text;
begin
  if (tg_op = 'DELETE') then
    delete from public.search_index
    where entity_type = 'catalog'
      and entity_id = old.id::text;
    return null;
  end if;

  v_search := left(
    concat_ws(
      ' ',
      new.title,
      new.code,
      new.seo_title,
      new.meta_description,
      new.intro_md,
      new.how_it_works_md
    ),
    3000
  );

  perform public.upsert_search_index(
    'catalog',
    new.id::text,
    new.code,
    new.title,
    'Catalog',
    '/catalog/' || new.code,
    new.updated_at,
    new.is_published,
    v_search
  );

  return null;
end;
$$;

create or replace function public.trg_search_index_events_pages()
returns trigger
language plpgsql
as $$
declare
  v_search text;
begin
  if (tg_op = 'DELETE') then
    delete from public.search_index
    where entity_type = 'event'
      and entity_id = old.id::text;
    return null;
  end if;

  if new.slug is null or trim(new.slug) = '' then
    return null;
  end if;

  v_search := left(
    concat_ws(
      ' ',
      new.title,
      new.slug,
      new.meta_description,
      new.content_md
    ),
    3000
  );

  perform public.upsert_search_index(
    'event',
    new.id::text,
    new.slug,
    new.title,
    'Event',
    '/events/' || new.slug,
    new.updated_at,
    new.is_published,
    v_search
  );

  return null;
end;
$$;

create or replace function public.trg_search_index_authors()
returns trigger
language plpgsql
as $$
declare
  v_search text;
begin
  if (tg_op = 'DELETE') then
    delete from public.search_index
    where entity_type = 'author'
      and entity_id = old.id::text;
    return null;
  end if;

  v_search := left(
    concat_ws(
      ' ',
      new.name,
      new.slug,
      new.bio_md
    ),
    2000
  );

  perform public.upsert_search_index(
    'author',
    new.id::text,
    new.slug,
    new.name,
    'Author',
    '/authors/' || new.slug,
    new.updated_at,
    true,
    v_search
  );

  return null;
end;
$$;

create or replace function public.refresh_search_index_music()
returns void
language plpgsql
as $$
begin
  delete from public.search_index
  where entity_type in ('music_hub', 'music_genre', 'music_artist');

  insert into public.search_index (
    entity_type,
    entity_id,
    slug,
    title,
    subtitle,
    url,
    updated_at,
    is_published,
    search_text
  )
  values
    ('music_hub', 'roblox-music-ids', 'roblox-music-ids', 'Roblox Music IDs', 'Music IDs', '/catalog/roblox-music-ids', now(), true, 'roblox music ids songs audio'),
    ('music_hub', 'roblox-music-ids-trending', 'roblox-music-ids-trending', 'Trending Roblox Music IDs', 'Music IDs', '/catalog/roblox-music-ids/trending', now(), true, 'trending roblox music ids'),
    ('music_hub', 'roblox-music-ids-genres', 'roblox-music-ids-genres', 'Roblox Music Genres', 'Music IDs', '/catalog/roblox-music-ids/genres', now(), true, 'roblox music ids genres'),
    ('music_hub', 'roblox-music-ids-artists', 'roblox-music-ids-artists', 'Roblox Music Artists', 'Music IDs', '/catalog/roblox-music-ids/artists', now(), true, 'roblox music ids artists');

  insert into public.search_index (
    entity_type,
    entity_id,
    slug,
    title,
    subtitle,
    url,
    updated_at,
    is_published,
    search_text
  )
  select
    'music_genre',
    slug,
    slug,
    label,
    'Music Genre',
    '/catalog/roblox-music-ids/genres/' || slug,
    now(),
    true,
    concat_ws(' ', label, slug, 'roblox music ids genre')
  from public.roblox_music_genres_view;

  insert into public.search_index (
    entity_type,
    entity_id,
    slug,
    title,
    subtitle,
    url,
    updated_at,
    is_published,
    search_text
  )
  select
    'music_artist',
    slug,
    slug,
    label,
    'Music Artist',
    '/catalog/roblox-music-ids/artists/' || slug,
    now(),
    true,
    concat_ws(' ', label, slug, 'roblox music ids artist')
  from public.roblox_music_artists_view;
end;
$$;

create or replace function public.trg_refresh_search_index_music()
returns trigger
language plpgsql
as $$
begin
  perform public.refresh_search_index_music();
  return null;
end;
$$;

drop trigger if exists trg_search_index_games on public.games;
create trigger trg_search_index_games
after insert or update or delete on public.games
for each row execute function public.trg_search_index_games();

drop trigger if exists trg_search_index_articles on public.articles;
create trigger trg_search_index_articles
after insert or update or delete on public.articles
for each row execute function public.trg_search_index_articles();

drop trigger if exists trg_search_index_checklists on public.checklist_pages;
create trigger trg_search_index_checklists
after insert or update or delete on public.checklist_pages
for each row execute function public.trg_search_index_checklists();

drop trigger if exists trg_search_index_game_lists on public.game_lists;
create trigger trg_search_index_game_lists
after insert or update or delete on public.game_lists
for each row execute function public.trg_search_index_game_lists();

drop trigger if exists trg_search_index_tools on public.tools;
create trigger trg_search_index_tools
after insert or update or delete on public.tools
for each row execute function public.trg_search_index_tools();

drop trigger if exists trg_search_index_catalog_pages on public.catalog_pages;
create trigger trg_search_index_catalog_pages
after insert or update or delete on public.catalog_pages
for each row execute function public.trg_search_index_catalog_pages();

drop trigger if exists trg_search_index_events_pages on public.events_pages;
create trigger trg_search_index_events_pages
after insert or update or delete on public.events_pages
for each row execute function public.trg_search_index_events_pages();

drop trigger if exists trg_search_index_authors on public.authors;
create trigger trg_search_index_authors
after insert or update or delete on public.authors
for each row execute function public.trg_search_index_authors();

drop trigger if exists trg_refresh_search_index_music on public.roblox_music_ids;
create trigger trg_refresh_search_index_music
after insert or update or delete on public.roblox_music_ids
for each statement execute function public.trg_refresh_search_index_music();

-- Initial backfill
select public.upsert_search_index(
  'code',
  g.id::text,
  g.slug,
  g.name,
  'Codes',
  '/codes/' || g.slug,
  g.updated_at,
  g.is_published,
  left(
    concat_ws(
      ' ',
      g.name,
      g.slug,
      array_to_string(g.old_slugs, ' '),
      g.seo_title,
      g.seo_description,
      g.intro_md,
      g.description_md,
      g.find_codes_md,
      g.about_game_md
    ),
    4000
  )
)
from public.games g
where g.slug is not null
  and trim(g.slug) <> '';

select public.upsert_search_index(
  'article',
  a.id::text,
  a.slug,
  a.title,
  'Article',
  '/articles/' || a.slug,
  a.updated_at,
  a.is_published,
  left(
    concat_ws(
      ' ',
      a.title,
      a.slug,
      a.meta_description,
      a.content_md
    ),
    4000
  )
)
from public.articles a
where a.slug is not null
  and trim(a.slug) <> '';

select public.upsert_search_index(
  'checklist',
  c.id::text,
  c.slug,
  c.title,
  'Checklist',
  '/checklists/' || c.slug,
  c.updated_at,
  c.is_public,
  left(
    concat_ws(
      ' ',
      c.title,
      c.slug,
      c.description_md,
      c.seo_description
    ),
    3000
  )
)
from public.checklist_pages c
where c.slug is not null
  and trim(c.slug) <> '';

select public.upsert_search_index(
  'list',
  l.id::text,
  l.slug,
  coalesce(l.display_name, l.title),
  'List',
  '/lists/' || l.slug,
  l.updated_at,
  l.is_published,
  left(
    concat_ws(
      ' ',
      l.display_name,
      l.title,
      l.slug,
      l.meta_title,
      l.meta_description,
      l.hero_md,
      l.intro_md,
      l.outro_md
    ),
    3000
  )
)
from public.game_lists l
where l.slug is not null
  and trim(l.slug) <> '';

select public.upsert_search_index(
  'tool',
  t.id::text,
  t.code,
  t.title,
  'Tool',
  '/tools/' || t.code,
  t.updated_at,
  t.is_published,
  left(
    concat_ws(
      ' ',
      t.title,
      t.code,
      t.seo_title,
      t.meta_description,
      t.intro_md,
      t.how_it_works_md
    ),
    3000
  )
)
from public.tools t
where t.code is not null
  and trim(t.code) <> '';

select public.upsert_search_index(
  'catalog',
  cp.id::text,
  cp.code,
  cp.title,
  'Catalog',
  '/catalog/' || cp.code,
  cp.updated_at,
  cp.is_published,
  left(
    concat_ws(
      ' ',
      cp.title,
      cp.code,
      cp.seo_title,
      cp.meta_description,
      cp.intro_md,
      cp.how_it_works_md
    ),
    3000
  )
)
from public.catalog_pages cp
where cp.code is not null
  and trim(cp.code) <> '';

select public.upsert_search_index(
  'event',
  e.id::text,
  e.slug,
  e.title,
  'Event',
  '/events/' || e.slug,
  e.updated_at,
  e.is_published,
  left(
    concat_ws(
      ' ',
      e.title,
      e.slug,
      e.meta_description,
      e.content_md
    ),
    3000
  )
)
from public.events_pages e
where e.slug is not null
  and trim(e.slug) <> '';

select public.upsert_search_index(
  'author',
  au.id::text,
  au.slug,
  au.name,
  'Author',
  '/authors/' || au.slug,
  au.updated_at,
  true,
  left(
    concat_ws(
      ' ',
      au.name,
      au.slug,
      au.bio_md
    ),
    2000
  )
)
from public.authors au
where au.slug is not null
  and trim(au.slug) <> '';

select public.refresh_search_index_music();
