-- Ensure guide_slug exists for linking event guides.
alter table if exists public.roblox_virtual_events
  add column if not exists guide_slug text;
