-- Catalog pages table to power item/ID listing pages
create table if not exists public.catalog_pages (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,
  title text not null,
  seo_title text not null,
  meta_description text not null,
  intro_md text not null,
  how_it_works_md text not null,
  description_json jsonb not null default '{}'::jsonb,
  faq_json jsonb not null default '[]'::jsonb,
  cta_label text,
  cta_url text,
  schema_ld_json jsonb,
  thumb_url text,
  is_published boolean not null default true,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_catalog_pages_is_published on public.catalog_pages (is_published);

create trigger trg_catalog_pages_updated_at
before update on public.catalog_pages
for each row
execute function public.set_updated_at();

create or replace function public.set_catalog_page_published_at() returns trigger as $$
begin
  if new.is_published = true
     and (old.is_published is distinct from true)
     and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_catalog_page_published_at on public.catalog_pages;
create trigger trg_set_catalog_page_published_at
before insert or update on public.catalog_pages
for each row execute function public.set_catalog_page_published_at();

-- Backfill existing published rows
update public.catalog_pages
set published_at = coalesce(published_at, created_at)
where is_published = true
  and published_at is null;

-- Catalog pages view to keep published flags and core content together
drop view if exists public.catalog_pages_view;
create or replace view public.catalog_pages_view as
select
  cp.*,
  greatest(cp.updated_at, coalesce(cp.published_at, cp.updated_at)) as content_updated_at
from public.catalog_pages cp;
