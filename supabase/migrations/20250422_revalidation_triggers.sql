-- Queue table for revalidation events
create table if not exists public.revalidation_events (
  id uuid primary key default uuid_generate_v4(),
  entity_type text not null check (entity_type in ('code','article','list')),
  slug text not null,
  source text,
  created_at timestamptz not null default now()
);

create index if not exists idx_revalidation_events_type_slug on public.revalidation_events (entity_type, slug);
create index if not exists idx_revalidation_events_created on public.revalidation_events (created_at desc);

-- Helper to enqueue a revalidation event (lowercases slug/type)
create or replace function public.enqueue_revalidation(entity_type text, slug text, source text default null)
returns void
language plpgsql
as $$
begin
  if slug is null or trim(slug) = '' then
    return;
  end if;
  insert into public.revalidation_events (entity_type, slug, source)
  values (lower(entity_type), lower(trim(slug)), source);
end;
$$;

-- Games trigger: queue code page revalidation
create or replace function public.trg_enqueue_revalidation_games()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.enqueue_revalidation('code', old.slug, 'games_delete');
  elsif new.is_published = true then
    perform public.enqueue_revalidation('code', new.slug, 'games_' || lower(tg_op));
  elsif tg_op = 'UPDATE' and old.is_published = true then
    perform public.enqueue_revalidation('code', old.slug, 'games_unpublish');
  end if;
  return null;
end;
$$;

drop trigger if exists trg_enqueue_revalidation_games on public.games;
create trigger trg_enqueue_revalidation_games
after insert or update or delete on public.games
for each row execute function public.trg_enqueue_revalidation_games();

-- Articles trigger: queue article page revalidation
create or replace function public.trg_enqueue_revalidation_articles()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.enqueue_revalidation('article', old.slug, 'articles_delete');
  elsif new.is_published = true then
    perform public.enqueue_revalidation('article', new.slug, 'articles_' || lower(tg_op));
  elsif tg_op = 'UPDATE' and old.is_published = true then
    perform public.enqueue_revalidation('article', old.slug, 'articles_unpublish');
  end if;
  return null;
end;
$$;

drop trigger if exists trg_enqueue_revalidation_articles on public.articles;
create trigger trg_enqueue_revalidation_articles
after insert or update or delete on public.articles
for each row execute function public.trg_enqueue_revalidation_articles();

-- Codes trigger: queue code page revalidation for the parent game slug
create or replace function public.trg_enqueue_revalidation_codes()
returns trigger
language plpgsql
as $$
declare
  game_slug text;
begin
  if tg_op = 'DELETE' then
    select slug into game_slug from public.games where id = old.game_id;
  else
    select slug into game_slug from public.games where id = new.game_id;
  end if;

  if game_slug is not null then
    perform public.enqueue_revalidation('code', game_slug, 'codes_' || lower(tg_op));
  end if;
  return null;
end;
$$;

drop trigger if exists trg_enqueue_revalidation_codes on public.codes;
create trigger trg_enqueue_revalidation_codes
after insert or update or delete on public.codes
for each row execute function public.trg_enqueue_revalidation_codes();

-- Game lists trigger: queue list page revalidation
create or replace function public.trg_enqueue_revalidation_game_lists()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.enqueue_revalidation('list', old.slug, 'game_lists_delete');
  elsif new.is_published = true then
    perform public.enqueue_revalidation('list', new.slug, 'game_lists_' || lower(tg_op));
  elsif tg_op = 'UPDATE' and old.is_published = true then
    perform public.enqueue_revalidation('list', old.slug, 'game_lists_unpublish');
  end if;
  return null;
end;
$$;

drop trigger if exists trg_enqueue_revalidation_game_lists on public.game_lists;
create trigger trg_enqueue_revalidation_game_lists
after insert or update or delete on public.game_lists
for each row execute function public.trg_enqueue_revalidation_game_lists();

-- Game list entries trigger: queue list page revalidation for the parent list slug
create or replace function public.trg_enqueue_revalidation_game_list_entries()
returns trigger
language plpgsql
as $$
declare
  list_slug text;
begin
  if tg_op = 'DELETE' then
    select slug into list_slug from public.game_lists where id = old.list_id;
  else
    select slug into list_slug from public.game_lists where id = new.list_id;
  end if;

  if list_slug is not null then
    perform public.enqueue_revalidation('list', list_slug, 'game_list_entries_' || lower(tg_op));
  end if;
  return null;
end;
$$;

drop trigger if exists trg_enqueue_revalidation_game_list_entries on public.game_list_entries;
create trigger trg_enqueue_revalidation_game_list_entries
after insert or update or delete on public.game_list_entries
for each row execute function public.trg_enqueue_revalidation_game_list_entries();
