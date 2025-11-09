-- Allow optional metadata and introduce manual sources for article generation queue

alter table if exists public.article_generation_queue
  alter column article_title drop not null,
  alter column article_type drop not null;

alter table if exists public.article_generation_queue
  add column if not exists sources text;
