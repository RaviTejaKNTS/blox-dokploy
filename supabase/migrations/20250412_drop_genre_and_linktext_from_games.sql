-- Drop unused columns from games table
alter table if exists public.games
  drop column if exists genre,
  drop column if exists sub_genre,
  drop column if exists linktext_md;
