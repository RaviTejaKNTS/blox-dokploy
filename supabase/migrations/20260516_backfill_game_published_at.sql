-- Backfill games.published_at from created_at when missing

update public.games
set published_at = created_at
where published_at is null;
