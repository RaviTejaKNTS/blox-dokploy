-- ============================================================================
-- Add Trading/Economy Data to Catalog Items
-- Extends roblox_catalog_items with RAP, price history, and calculated metrics
-- Also creates a general history table for tracking changes over time
-- ============================================================================

-- Add RAP and trading data columns to existing catalog items table
alter table public.roblox_catalog_items
  add column if not exists rap bigint,
  add column if not exists rap_sales integer,
  add column if not exists rap_stock integer,
  add column if not exists rap_price_points jsonb default '[]'::jsonb,
  add column if not exists rap_volume_points jsonb default '[]'::jsonb,
  add column if not exists rap_last_fetched timestamptz,
  
  -- Type distinction and UGC support
  add column if not exists limited_type text check (limited_type in ('classic', 'ugc')),
  add column if not exists collectible_item_id text,
  
  -- Calculated trading metrics
  add column if not exists trading_value bigint,
  add column if not exists trading_value_confidence integer check (trading_value_confidence >= 0 and trading_value_confidence <= 100),
  
  add column if not exists trend_direction text check (trend_direction in ('rising', 'stable', 'falling')),
  add column if not exists trend_strength integer check (trend_strength >= 0 and trend_strength <= 100),
  add column if not exists trend_change_7d numeric,
  add column if not exists trend_change_30d numeric,
  
  add column if not exists demand_level text check (demand_level in ('amazing', 'popular', 'normal', 'terrible')),
  add column if not exists demand_score integer check (demand_score >= 0 and demand_score <= 100),
  add column if not exists demand_sales_per_day numeric,
  add column if not exists demand_consistency integer check (demand_consistency >= 0 and demand_consistency <= 100),
  
  add column if not exists is_projected boolean default false,
  add column if not exists projected_confidence integer check (projected_confidence >= 0 and projected_confidence <= 100),
  add column if not exists projected_reason text,
  
  add column if not exists trading_metrics_calculated_at timestamptz;

-- Create indexes for trading/limited item queries
create index if not exists idx_roblox_catalog_items_limited_tradeable
  on public.roblox_catalog_items (is_limited, is_limited_unique, trading_value desc nulls last)
  where (is_limited = true or is_limited_unique = true) and trading_value is not null;

create index if not exists idx_roblox_catalog_items_trading_value
  on public.roblox_catalog_items (trading_value desc nulls last)
  where is_limited = true or is_limited_unique = true;

create index if not exists idx_roblox_catalog_items_rap
  on public.roblox_catalog_items (rap desc nulls last)
  where is_limited = true or is_limited_unique = true;

create index if not exists idx_roblox_catalog_items_demand_level
  on public.roblox_catalog_items (demand_level, trading_value desc nulls last)
  where is_limited = true or is_limited_unique = true;

create index if not exists idx_roblox_catalog_items_trend_direction
  on public.roblox_catalog_items (trend_direction, trading_value desc nulls last)
  where is_limited = true or is_limited_unique = true;

create index if not exists idx_roblox_catalog_items_projected
  on public.roblox_catalog_items (is_projected, trading_value desc nulls last)
  where is_limited = true or is_limited_unique = true;

create index if not exists idx_roblox_catalog_items_rap_last_fetched
  on public.roblox_catalog_items (rap_last_fetched desc nulls last)
  where is_limited = true or is_limited_unique = true;

-- Add comments for documentation
comment on column public.roblox_catalog_items.rap is 'Recent Average Price from Roblox Economy API';
comment on column public.roblox_catalog_items.rap_sales is 'Total sales count from Roblox Economy API';
comment on column public.roblox_catalog_items.rap_stock is 'Current stock from Roblox Economy API';
comment on column public.roblox_catalog_items.rap_price_points is 'Historical price data points from Roblox Economy API';
comment on column public.roblox_catalog_items.rap_volume_points is 'Historical volume data points from Roblox Economy API';
comment on column public.roblox_catalog_items.rap_last_fetched is 'When RAP data was last fetched from Roblox';

comment on column public.roblox_catalog_items.limited_type is 'Type of Limited: classic (old system) or ugc (new collectibles)';
comment on column public.roblox_catalog_items.collectible_item_id is 'Collectible item UUID for UGC Limiteds (needed for marketplace-sales API)';

comment on column public.roblox_catalog_items.trading_value is 'Calculated trading value using VWAP algorithm (more stable than RAP)';
comment on column public.roblox_catalog_items.trading_value_confidence is 'Confidence in trading_value calculation (0-100), based on data quality';

comment on column public.roblox_catalog_items.trend_direction is 'Price trend direction: rising, stable, or falling';
comment on column public.roblox_catalog_items.trend_strength is 'Strength of trend (0-100) based on R² from linear regression';
comment on column public.roblox_catalog_items.trend_change_7d is 'Percentage price change over last 7 days';
comment on column public.roblox_catalog_items.trend_change_30d is 'Percentage price change over last 30 days';

comment on column public.roblox_catalog_items.demand_level is 'Trading demand level: amazing, popular, normal, or terrible';
comment on column public.roblox_catalog_items.demand_score is 'Demand score (0-100) based on sales velocity and consistency';
comment on column public.roblox_catalog_items.demand_sales_per_day is 'Average sales per day based on volume history';
comment on column public.roblox_catalog_items.demand_consistency is 'Sales consistency score (0-100), lower variance = higher score';

comment on column public.roblox_catalog_items.is_projected is 'True if item appears to have artificially inflated RAP (projected)';
comment on column public.roblox_catalog_items.projected_confidence is 'Confidence in projected detection (0-100)';
comment on column public.roblox_catalog_items.projected_reason is 'Reason why item is flagged as potentially projected';

comment on column public.roblox_catalog_items.trading_metrics_calculated_at is 'When trading metrics were last calculated';

-- ============================================================================
-- Create general catalog items history table
-- Tracks snapshots of catalog items over time (not just RAP)
-- ============================================================================

create table if not exists public.roblox_catalog_items_history (
  asset_id bigint not null references public.roblox_catalog_items(asset_id) on delete cascade,
  recorded_at timestamptz not null default now(),
  
  -- Snapshot of key metrics at this point in time
  rap bigint,
  sales integer,
  price_robux bigint,
  is_for_sale boolean,
  favorite_count bigint,
  
  -- Can add more fields here as needed for historical tracking
  
  primary key (asset_id, recorded_at)
);

create index if not exists idx_roblox_catalog_items_history_asset
  on public.roblox_catalog_items_history (asset_id, recorded_at desc);

create index if not exists idx_roblox_catalog_items_history_recorded_at
  on public.roblox_catalog_items_history (recorded_at desc);

comment on table public.roblox_catalog_items_history is 'Historical snapshots of catalog items for tracking changes over time';
comment on column public.roblox_catalog_items_history.rap is 'RAP value at this snapshot';
comment on column public.roblox_catalog_items_history.sales is 'Total sales at this snapshot';
comment on column public.roblox_catalog_items_history.price_robux is 'Price at this snapshot';

-- ============================================================================
-- Create view for Limited items with trading data
-- ============================================================================

create or replace view public.limited_items_trading_view as
select
  ci.asset_id,
  ci.name,
  ci.description,
  ci.item_type,
  ci.asset_type_id,
  ci.category,
  ci.subcategory,
  ci.is_limited,
  ci.is_limited_unique,
  ci.creator_name,
  ci.creator_type,
  ci.creator_has_verified_badge,
  ci.remaining,
  
  -- Raw Roblox data
  ci.rap,
  ci.rap_sales,
  ci.rap_stock,
  ci.rap_last_fetched,
  
  -- Calculated trading metrics
  ci.trading_value,
  ci.trading_value_confidence,
  
  ci.trend_direction,
  ci.trend_strength,
  ci.trend_change_7d,
  ci.trend_change_30d,
  
  ci.demand_level,
  ci.demand_score,
  ci.demand_sales_per_day,
  ci.demand_consistency,
  
  ci.is_projected,
  ci.projected_confidence,
  ci.projected_reason,
  
  ci.trading_metrics_calculated_at,
  ci.updated_at,
  ci.created_at,
  
  -- Computed helper columns
  case
    when ci.is_projected = true then 'projected'
    when ci.demand_level = 'amazing' then 'high_demand'
    when ci.trend_direction = 'rising' and ci.trend_strength > 70 then 'trending_up'
    when ci.rap is not null and ci.trading_value is null then 'needs_calculation'
    else 'normal'
  end as status_flag,
  
  -- Calculate RAP vs Value difference (projected indicator helper)
  case
    when ci.rap is not null and ci.trading_value is not null and ci.rap > 0
    then round(((ci.rap - ci.trading_value)::numeric / ci.rap) * 100, 2)
    else null
  end as rap_value_diff_percent,
  
  -- Data freshness indicators
  case
    when ci.rap_last_fetched is null then 'never_fetched'
    when ci.rap_last_fetched > now() - interval '12 hours' then 'fresh'
    when ci.rap_last_fetched > now() - interval '24 hours' then 'recent'
    when ci.rap_last_fetched > now() - interval '7 days' then 'stale'
    else 'outdated'
  end as data_freshness,
  
  case
    when ci.trading_metrics_calculated_at is null then 'never_calculated'
    when ci.trading_metrics_calculated_at > now() - interval '1 hour' then 'fresh'
    when ci.trading_metrics_calculated_at > now() - interval '6 hours' then 'recent'
    when ci.trading_metrics_calculated_at > now() - interval '24 hours' then 'stale'
    else 'outdated'
  end as metrics_freshness

from public.roblox_catalog_items ci
where ci.is_limited = true or ci.is_limited_unique = true;

-- Grant access to views
grant select on public.limited_items_trading_view to authenticated;
grant select on public.limited_items_trading_view to anon;

comment on view public.limited_items_trading_view is 'Simplified view of Limited items with trading data and freshness indicators for frontend';

-- ============================================================================
-- Helper function: Get items needing RAP update
-- ============================================================================

create or replace function public.get_items_needing_rap_update(
  p_limit integer default 100,
  p_max_age_hours integer default 12
)
returns table (
  asset_id bigint,
  name text,
  last_fetched timestamptz,
  hours_since_update numeric
)
language plpgsql
stable
as $$
begin
  return query
  select
    ci.asset_id,
    ci.name,
    ci.rap_last_fetched,
    case
      when ci.rap_last_fetched is null then null
      else extract(epoch from (now() - ci.rap_last_fetched)) / 3600
    end as hours_since_update
  from public.roblox_catalog_items ci
  where (ci.is_limited = true or ci.is_limited_unique = true)
    and (
      ci.rap_last_fetched is null
      or ci.rap_last_fetched < now() - (p_max_age_hours || ' hours')::interval
    )
  order by
    ci.rap_last_fetched asc nulls first,
    ci.rap desc nulls last
  limit p_limit;
end;
$$;

comment on function public.get_items_needing_rap_update is 'Returns Limited items that need RAP data updated';

-- ============================================================================
-- Helper function: Get items needing metrics calculation
-- ============================================================================

create or replace function public.get_items_needing_metrics_calculation(
  p_limit integer default 100,
  p_max_age_hours integer default 1
)
returns table (
  asset_id bigint,
  name text,
  rap bigint,
  last_calculated timestamptz,
  hours_since_calculation numeric
)
language plpgsql
stable
as $$
begin
  return query
  select
    ci.asset_id,
    ci.name,
    ci.rap,
    ci.trading_metrics_calculated_at,
    case
      when ci.trading_metrics_calculated_at is null then null
      else extract(epoch from (now() - ci.trading_metrics_calculated_at)) / 3600
    end as hours_since_calculation
  from public.roblox_catalog_items ci
  where (ci.is_limited = true or ci.is_limited_unique = true)
    and ci.rap is not null
    and (
      ci.trading_metrics_calculated_at is null
      or ci.trading_metrics_calculated_at < now() - (p_max_age_hours || ' hours')::interval
    )
  order by
    ci.trading_metrics_calculated_at asc nulls first,
    ci.rap desc nulls last
  limit p_limit;
end;
$$;

comment on function public.get_items_needing_metrics_calculation is 'Returns Limited items that need trading metrics calculated';
