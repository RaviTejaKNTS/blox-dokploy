-- Add a display-friendly name for game lists (used by list cards)
alter table if exists public.game_lists
add column if not exists display_name text;
