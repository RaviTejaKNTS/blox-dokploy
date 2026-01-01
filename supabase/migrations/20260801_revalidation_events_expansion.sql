-- Expand revalidation queue coverage for catalog, tools, checklists, events, and music IDs.

alter table public.revalidation_events
  drop constraint if exists revalidation_events_entity_type_check;

alter table public.revalidation_events
  add constraint revalidation_events_entity_type_check
  check (entity_type in ('code','article','list','author','event','checklist','tool','catalog','music'));

-- Tools trigger: revalidate tool pages and indexes when tools change.
create or replace function public.trg_enqueue_revalidation_tools()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.enqueue_revalidation('tool', old.code, 'tools_delete');
  elsif new.is_published = true then
    perform public.enqueue_revalidation('tool', new.code, 'tools_' || lower(tg_op));
  elsif tg_op = 'UPDATE' and old.is_published = true then
    perform public.enqueue_revalidation('tool', old.code, 'tools_unpublish');
  end if;
  return null;
end;
$$;

drop trigger if exists trg_enqueue_revalidation_tools on public.tools;
create trigger trg_enqueue_revalidation_tools
after insert or update or delete on public.tools
for each row execute function public.trg_enqueue_revalidation_tools();

-- Catalog pages trigger: revalidate catalog hubs/content when catalog entries change.
create or replace function public.trg_enqueue_revalidation_catalog_pages()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.enqueue_revalidation('catalog', old.code, 'catalog_pages_delete');
  elsif new.is_published = true then
    perform public.enqueue_revalidation('catalog', new.code, 'catalog_pages_' || lower(tg_op));
  elsif tg_op = 'UPDATE' and old.is_published = true then
    perform public.enqueue_revalidation('catalog', old.code, 'catalog_pages_unpublish');
  end if;
  return null;
end;
$$;

drop trigger if exists trg_enqueue_revalidation_catalog_pages on public.catalog_pages;
create trigger trg_enqueue_revalidation_catalog_pages
after insert or update or delete on public.catalog_pages
for each row execute function public.trg_enqueue_revalidation_catalog_pages();

-- Music IDs trigger: revalidate music catalog pages when IDs change.
create or replace function public.trg_enqueue_revalidation_music_ids()
returns trigger
language plpgsql
as $$
begin
  perform public.enqueue_revalidation('music', 'roblox-music-ids', 'roblox_music_ids_' || lower(tg_op));
  return null;
end;
$$;

drop trigger if exists trg_enqueue_revalidation_music_ids on public.roblox_music_ids;
create trigger trg_enqueue_revalidation_music_ids
after insert or update or delete on public.roblox_music_ids
for each row execute function public.trg_enqueue_revalidation_music_ids();

-- Checklist pages trigger: revalidate checklist pages when page metadata changes.
create or replace function public.trg_enqueue_revalidation_checklist_pages()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.enqueue_revalidation('checklist', old.slug, 'checklist_pages_delete');
  elsif new.is_public = true then
    perform public.enqueue_revalidation('checklist', new.slug, 'checklist_pages_' || lower(tg_op));
  elsif tg_op = 'UPDATE' and old.is_public = true then
    perform public.enqueue_revalidation('checklist', old.slug, 'checklist_pages_unpublish');
  end if;
  return null;
end;
$$;

drop trigger if exists trg_enqueue_revalidation_checklist_pages on public.checklist_pages;
create trigger trg_enqueue_revalidation_checklist_pages
after insert or update or delete on public.checklist_pages
for each row execute function public.trg_enqueue_revalidation_checklist_pages();

-- Checklist items trigger: revalidate checklist pages when items change.
create or replace function public.trg_enqueue_revalidation_checklist_items()
returns trigger
language plpgsql
as $$
declare
  page_slug text;
begin
  if tg_op = 'DELETE' then
    select slug into page_slug from public.checklist_pages where id = old.page_id;
  else
    select slug into page_slug from public.checklist_pages where id = new.page_id;
  end if;

  if page_slug is not null and trim(page_slug) <> '' then
    perform public.enqueue_revalidation('checklist', page_slug, 'checklist_items_' || lower(tg_op));
  end if;
  return null;
end;
$$;

drop trigger if exists trg_enqueue_revalidation_checklist_items on public.checklist_items;
create trigger trg_enqueue_revalidation_checklist_items
after insert or update or delete on public.checklist_items
for each row execute function public.trg_enqueue_revalidation_checklist_items();

-- Event pages trigger: revalidate event hubs when page metadata changes.
create or replace function public.trg_enqueue_revalidation_events_pages()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.enqueue_revalidation('event', old.slug, 'events_pages_delete');
  elsif new.is_published = true then
    perform public.enqueue_revalidation('event', new.slug, 'events_pages_' || lower(tg_op));
  elsif tg_op = 'UPDATE' and old.is_published = true then
    perform public.enqueue_revalidation('event', old.slug, 'events_pages_unpublish');
  end if;
  return null;
end;
$$;

drop trigger if exists trg_enqueue_revalidation_events_pages on public.events_pages;
create trigger trg_enqueue_revalidation_events_pages
after insert or update or delete on public.events_pages
for each row execute function public.trg_enqueue_revalidation_events_pages();

-- Virtual events trigger: revalidate event hubs when Roblox event data changes.
create or replace function public.trg_enqueue_revalidation_virtual_events()
returns trigger
language plpgsql
as $$
declare
  target_universe_id bigint;
  page_slug text;
begin
  target_universe_id := coalesce(new.universe_id, old.universe_id);
  if target_universe_id is null then
    return null;
  end if;

  select slug into page_slug
  from public.events_pages
  where universe_id = target_universe_id
    and is_published = true;

  if page_slug is not null and trim(page_slug) <> '' then
    perform public.enqueue_revalidation('event', page_slug, 'roblox_virtual_events_' || lower(tg_op));
  end if;
  return null;
end;
$$;

drop trigger if exists trg_enqueue_revalidation_virtual_events on public.roblox_virtual_events;
create trigger trg_enqueue_revalidation_virtual_events
after insert or update or delete on public.roblox_virtual_events
for each row execute function public.trg_enqueue_revalidation_virtual_events();

-- Virtual event assets trigger: revalidate event hubs when categories/thumbnails change.
create or replace function public.trg_enqueue_revalidation_virtual_event_assets()
returns trigger
language plpgsql
as $$
declare
  target_event_id text;
  target_universe_id bigint;
  page_slug text;
begin
  target_event_id := coalesce(new.event_id, old.event_id);
  if target_event_id is null then
    return null;
  end if;

  select universe_id into target_universe_id
  from public.roblox_virtual_events
  where event_id = target_event_id;

  if target_universe_id is null then
    return null;
  end if;

  select slug into page_slug
  from public.events_pages
  where universe_id = target_universe_id
    and is_published = true;

  if page_slug is not null and trim(page_slug) <> '' then
    perform public.enqueue_revalidation('event', page_slug, 'roblox_virtual_event_assets_' || lower(tg_op));
  end if;
  return null;
end;
$$;

drop trigger if exists trg_enqueue_revalidation_virtual_event_categories on public.roblox_virtual_event_categories;
create trigger trg_enqueue_revalidation_virtual_event_categories
after insert or update or delete on public.roblox_virtual_event_categories
for each row execute function public.trg_enqueue_revalidation_virtual_event_assets();

drop trigger if exists trg_enqueue_revalidation_virtual_event_thumbnails on public.roblox_virtual_event_thumbnails;
create trigger trg_enqueue_revalidation_virtual_event_thumbnails
after insert or update or delete on public.roblox_virtual_event_thumbnails
for each row execute function public.trg_enqueue_revalidation_virtual_event_assets();
