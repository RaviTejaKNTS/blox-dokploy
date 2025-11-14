alter table if exists public.games
  add column if not exists universe_id bigint references public.roblox_universes(universe_id);

create index if not exists idx_games_universe_id on public.games (universe_id);

alter table if exists public.article_categories
  add column if not exists universe_id bigint references public.roblox_universes(universe_id);

create index if not exists idx_article_categories_universe on public.article_categories (universe_id);

alter table if exists public.articles
  add column if not exists universe_id bigint references public.roblox_universes(universe_id);

create index if not exists idx_articles_universe on public.articles (universe_id);

update public.article_categories c
set universe_id = g.universe_id
from public.games g
where g.id = c.game_id
  and (c.universe_id is distinct from g.universe_id);

update public.articles a
set universe_id = c.universe_id
from public.article_categories c
where c.id = a.category_id
  and (a.universe_id is distinct from c.universe_id);
