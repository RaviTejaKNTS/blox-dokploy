-- Expand Roblox catalog item counters/prices to bigint to avoid overflow
alter table if exists public.roblox_catalog_items
  alter column price_robux type bigint,
  alter column lowest_price_robux type bigint,
  alter column lowest_resale_price_robux type bigint,
  alter column remaining type bigint,
  alter column favorite_count type bigint,
  alter column total_quantity type bigint,
  alter column units_available_for_consumption type bigint,
  alter column quantity_limit_per_user type bigint;
