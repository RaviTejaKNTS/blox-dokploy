-- Add nullable universe reference to article generation queue

alter table if exists public.article_generation_queue
  add column if not exists universe_id bigint references public.roblox_universes(universe_id);
