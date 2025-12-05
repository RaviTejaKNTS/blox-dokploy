-- Add tags to articles for classification (e.g., items, guides, tierlists, news, reviews, opinions)

alter table if exists public.articles
  add column if not exists tags text[] not null default '{}';
