-- Checklist pages and items with section codes stored on each item
create table if not exists public.checklist_pages (
  id uuid primary key default uuid_generate_v4(),
  universe_id bigint not null references public.roblox_universes(universe_id) on delete cascade,
  slug text not null,
  title text not null,
  seo_title text,
  seo_description text,
  published_at timestamptz,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (universe_id, slug)
);

create index if not exists idx_checklist_pages_universe_slug on public.checklist_pages (universe_id, lower(slug));
create index if not exists idx_checklist_pages_published on public.checklist_pages (is_public, published_at desc nulls last, updated_at desc);

create table if not exists public.checklist_items (
  id uuid primary key default uuid_generate_v4(),
  page_id uuid not null references public.checklist_pages(id) on delete cascade,
  section_code text not null check (section_code ~ '^[0-9]+(\\.[0-9]+)?$'),
  section_name text not null,
  title text not null,
  description text,
  is_required boolean not null default false,
  position int not null default 1 check (position > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (page_id, section_code, position, title)
);

create index if not exists idx_checklist_items_page_section on public.checklist_items (page_id, section_code, position);
create index if not exists idx_checklist_items_page on public.checklist_items (page_id);

drop trigger if exists trg_checklist_pages_updated_at on public.checklist_pages;
create trigger trg_checklist_pages_updated_at before update on public.checklist_pages
for each row execute function public.set_updated_at();

drop trigger if exists trg_checklist_items_updated_at on public.checklist_items;
create trigger trg_checklist_items_updated_at before update on public.checklist_items
for each row execute function public.set_updated_at();
