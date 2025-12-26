alter table if exists public.article_generation_queue
  add column if not exists event_id text;

create unique index if not exists idx_article_generation_queue_event_id
  on public.article_generation_queue (event_id)
  where event_id is not null;
