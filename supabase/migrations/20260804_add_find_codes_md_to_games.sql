alter table if exists public.games
  add column if not exists find_codes_md text;
