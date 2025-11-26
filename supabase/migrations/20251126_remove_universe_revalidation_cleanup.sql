-- Cleanup: remove roblox universe revalidation triggers/function that were added earlier.

-- Drop triggers on roblox_universes and child tables
drop trigger if exists trg_enqueue_revalidation_roblox_universes on public.roblox_universes;
drop trigger if exists trg_enqueue_revalidation_universe_social_links on public.roblox_universe_social_links;
drop trigger if exists trg_enqueue_revalidation_universe_media on public.roblox_universe_media;
drop trigger if exists trg_enqueue_revalidation_universe_badges on public.roblox_universe_badges;
drop trigger if exists trg_enqueue_revalidation_universe_gamepasses on public.roblox_universe_gamepasses;
drop trigger if exists trg_enqueue_revalidation_universe_stats_daily on public.roblox_universe_stats_daily;
drop trigger if exists trg_enqueue_revalidation_universe_sort_entries on public.roblox_universe_sort_entries;
drop trigger if exists trg_enqueue_revalidation_universe_search_snapshots on public.roblox_universe_search_snapshots;
drop trigger if exists trg_enqueue_revalidation_universe_place_servers on public.roblox_universe_place_servers;

-- Drop the trigger function if present
drop function if exists public.trg_enqueue_revalidation_roblox_universes;
