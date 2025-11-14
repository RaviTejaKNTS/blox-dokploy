alter table if exists public.article_generation_queue
  drop column if exists category_id;

drop index if exists idx_articles_category;

alter table if exists public.articles
  drop column if exists category_id;

drop table if exists public.article_categories cascade;
