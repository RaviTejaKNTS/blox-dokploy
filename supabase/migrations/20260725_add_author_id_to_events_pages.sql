alter table public.events_pages
  add column if not exists author_id uuid references public.authors(id) on delete set null;

create index if not exists idx_events_pages_author on public.events_pages (author_id, is_published);
