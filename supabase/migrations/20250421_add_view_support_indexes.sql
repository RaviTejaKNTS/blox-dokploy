-- Supporting indexes for view lookups

-- Speed up code_pages_view: filter/sort published games
create index if not exists idx_games_published_updated on public.games (is_published, updated_at desc);

-- Speed up latest/active code aggregation
create index if not exists idx_codes_game_first_seen on public.codes (game_id, first_seen_at desc);

-- Speed up article_pages_view: filter/sort published articles
create index if not exists idx_articles_published_published_at on public.articles (is_published, published_at desc);
