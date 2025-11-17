alter table if exists public.games
  add column if not exists rewards_md text,
  add column if not exists troubleshoot_md text,
  add column if not exists about_game_md text;
