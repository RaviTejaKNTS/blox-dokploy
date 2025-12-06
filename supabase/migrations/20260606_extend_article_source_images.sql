-- Add metadata for matching images to table rows and storing public URL

alter table if exists public.article_source_images
  add column if not exists public_url text,
  add column if not exists table_key text,
  add column if not exists row_text text;
