-- Roblox catalog items + discovery/enrichment support tables
create table if not exists public.roblox_catalog_items (
  asset_id bigint primary key,
  item_type text not null default 'Asset',
  asset_type_id integer,
  category text,
  subcategory text,
  name text,
  description text,
  price_robux bigint,
  price_status text,
  lowest_price_robux bigint,
  lowest_resale_price_robux bigint,
  is_for_sale boolean,
  is_limited boolean,
  is_limited_unique boolean,
  remaining bigint,
  creator_id bigint,
  creator_target_id bigint,
  creator_name text,
  creator_type text,
  creator_has_verified_badge boolean,
  product_id bigint,
  collectible_item_id bigint,
  favorite_count bigint,
  has_resellers boolean,
  total_quantity bigint,
  units_available_for_consumption bigint,
  quantity_limit_per_user bigint,
  sale_location_type text,
  off_sale_deadline timestamptz,
  item_status jsonb,
  item_restrictions jsonb,
  bundled_items jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_enriched_at timestamptz,
  is_deleted boolean not null default false,
  raw_catalog_json jsonb not null default '{}'::jsonb,
  raw_economy_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_roblox_catalog_items_category
  on public.roblox_catalog_items (category);
create index if not exists idx_roblox_catalog_items_subcategory
  on public.roblox_catalog_items (subcategory);
create index if not exists idx_roblox_catalog_items_asset_type_id
  on public.roblox_catalog_items (asset_type_id);
create index if not exists idx_roblox_catalog_items_creator_id
  on public.roblox_catalog_items (creator_id);
create index if not exists idx_roblox_catalog_items_price_robux
  on public.roblox_catalog_items (price_robux);
create index if not exists idx_roblox_catalog_items_last_seen_at
  on public.roblox_catalog_items (last_seen_at desc);
create index if not exists idx_roblox_catalog_items_is_for_sale
  on public.roblox_catalog_items (is_for_sale);
create index if not exists idx_roblox_catalog_items_is_limited
  on public.roblox_catalog_items (is_limited);

drop trigger if exists trg_roblox_catalog_items_updated_at on public.roblox_catalog_items;
create trigger trg_roblox_catalog_items_updated_at
before update on public.roblox_catalog_items
for each row
execute function public.set_updated_at();

create table if not exists public.roblox_catalog_item_images (
  asset_id bigint not null references public.roblox_catalog_items(asset_id) on delete cascade,
  size text not null,
  format text not null,
  image_url text,
  state text,
  version text,
  last_checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (asset_id, size, format)
);

create index if not exists idx_roblox_catalog_item_images_state
  on public.roblox_catalog_item_images (state);

drop trigger if exists trg_roblox_catalog_item_images_updated_at on public.roblox_catalog_item_images;
create trigger trg_roblox_catalog_item_images_updated_at
before update on public.roblox_catalog_item_images
for each row
execute function public.set_updated_at();

create table if not exists public.roblox_catalog_categories (
  category text primary key,
  name text,
  category_id integer,
  order_index integer,
  is_searchable boolean,
  asset_type_ids integer[] not null default '{}',
  bundle_type_ids integer[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_roblox_catalog_categories_updated_at on public.roblox_catalog_categories;
create trigger trg_roblox_catalog_categories_updated_at
before update on public.roblox_catalog_categories
for each row
execute function public.set_updated_at();

create table if not exists public.roblox_catalog_subcategories (
  subcategory text primary key,
  category text not null references public.roblox_catalog_categories(category) on delete cascade,
  name text,
  short_name text,
  subcategory_id integer,
  asset_type_ids integer[] not null default '{}',
  bundle_type_ids integer[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_roblox_catalog_subcategories_category
  on public.roblox_catalog_subcategories (category);

drop trigger if exists trg_roblox_catalog_subcategories_updated_at on public.roblox_catalog_subcategories;
create trigger trg_roblox_catalog_subcategories_updated_at
before update on public.roblox_catalog_subcategories
for each row
execute function public.set_updated_at();

create table if not exists public.roblox_catalog_discovery_runs (
  run_id uuid primary key default uuid_generate_v4(),
  strategy text not null,
  category text,
  subcategory text,
  keyword text,
  sort_type text,
  page_limit integer,
  status text not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_roblox_catalog_discovery_runs_status
  on public.roblox_catalog_discovery_runs (status);

drop trigger if exists trg_roblox_catalog_discovery_runs_updated_at on public.roblox_catalog_discovery_runs;
create trigger trg_roblox_catalog_discovery_runs_updated_at
before update on public.roblox_catalog_discovery_runs
for each row
execute function public.set_updated_at();

create table if not exists public.roblox_catalog_discovery_hits (
  run_id uuid not null references public.roblox_catalog_discovery_runs(run_id) on delete cascade,
  asset_id bigint not null references public.roblox_catalog_items(asset_id) on delete cascade,
  query_hash text,
  category text,
  subcategory text,
  keyword text,
  sort_type text,
  cursor_page integer,
  seen_at timestamptz not null default now(),
  primary key (run_id, asset_id)
);

create index if not exists idx_roblox_catalog_discovery_hits_asset_id
  on public.roblox_catalog_discovery_hits (asset_id);
create index if not exists idx_roblox_catalog_discovery_hits_query_hash
  on public.roblox_catalog_discovery_hits (query_hash);

create table if not exists public.roblox_catalog_refresh_queue (
  asset_id bigint primary key references public.roblox_catalog_items(asset_id) on delete cascade,
  priority text not null default 'new',
  next_run_at timestamptz not null default now(),
  attempts integer not null default 0,
  last_attempt_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_roblox_catalog_refresh_queue_next_run_at
  on public.roblox_catalog_refresh_queue (next_run_at);
create index if not exists idx_roblox_catalog_refresh_queue_priority
  on public.roblox_catalog_refresh_queue (priority);

drop trigger if exists trg_roblox_catalog_refresh_queue_updated_at on public.roblox_catalog_refresh_queue;
create trigger trg_roblox_catalog_refresh_queue_updated_at
before update on public.roblox_catalog_refresh_queue
for each row
execute function public.set_updated_at();
