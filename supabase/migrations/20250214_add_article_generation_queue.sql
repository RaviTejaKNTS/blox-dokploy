-- Article Generation Queue

create table if not exists public.article_generation_queue (
  id uuid primary key default uuid_generate_v4(),
  article_title text not null,
  category_id uuid references public.article_categories(id) on delete set null,
  article_type text not null check (article_type in ('listicle','how_to','explainer','opinion','news')),
  status text not null default 'pending' check (status in ('pending','completed','failed')),
  attempts int not null default 0,
  last_attempted_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_article_generation_queue_status_created
  on public.article_generation_queue (status, created_at);

-- set_updated_at trigger reuse
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_article_generation_queue_updated_at on public.article_generation_queue;
create trigger trg_article_generation_queue_updated_at
before update on public.article_generation_queue
for each row execute function public.set_updated_at();

alter table public.article_generation_queue enable row level security;

drop policy if exists "admin_manage_article_generation_queue" on public.article_generation_queue;
create policy "admin_manage_article_generation_queue" on public.article_generation_queue
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
