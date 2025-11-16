-- Add game_description_md to roblox_universes for richer list descriptions
alter table if exists public.roblox_universes
  add column if not exists game_description_md text;
