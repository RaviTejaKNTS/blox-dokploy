alter table if exists public.games
  add column if not exists re_rewritten_at timestamptz;
