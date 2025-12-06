-- Store images collected from article sources (e.g., table images, fandom assets)

create table if not exists public.article_source_images (
  id uuid primary key default uuid_generate_v4(),
  article_id uuid not null references public.articles(id) on delete cascade,
  source_url text not null,
  source_host text not null,
  name text not null,
  original_url text not null,
  uploaded_path text not null,
  alt_text text,
  caption text,
  context text,
  is_table boolean not null default false,
  width int,
  height int,
  created_at timestamptz not null default now()
);

create index if not exists idx_article_source_images_article on public.article_source_images (article_id);
create index if not exists idx_article_source_images_source on public.article_source_images (source_host, source_url);

alter table public.article_source_images enable row level security;

drop policy if exists "admin_manage_article_source_images" on public.article_source_images;
create policy "admin_manage_article_source_images" on public.article_source_images
  for all
  using (
    exists (
      select 1 from public.admin_users au where au.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.admin_users au where au.user_id = auth.uid()
    )
  );
