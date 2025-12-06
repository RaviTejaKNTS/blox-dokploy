-- Allow article drafts to omit published_at until they are actually published

alter table if exists public.articles
  alter column published_at drop not null,
  alter column published_at drop default;

-- Clean up any drafts that were stamped while the column was non-nullable
update public.articles
set published_at = null
where is_published = false
  and published_at is not null;
