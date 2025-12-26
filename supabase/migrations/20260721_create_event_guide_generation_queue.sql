-- Event guide generation queue

create table if not exists public.event_guide_generation_queue (
  id uuid primary key default uuid_generate_v4(),
  event_id text not null references public.roblox_virtual_events(event_id) on delete cascade,
  universe_id bigint references public.roblox_universes(universe_id),
  guide_title text,
  guide_slug text,
  article_id uuid references public.articles(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','completed','failed')),
  attempts int not null default 0,
  last_attempted_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_event_guide_generation_queue_status_created
  on public.event_guide_generation_queue (status, created_at);
create unique index if not exists idx_event_guide_generation_queue_event_id
  on public.event_guide_generation_queue (event_id);

drop trigger if exists trg_event_guide_generation_queue_updated_at on public.event_guide_generation_queue;
create trigger trg_event_guide_generation_queue_updated_at
before update on public.event_guide_generation_queue
for each row execute function public.set_updated_at();

alter table public.event_guide_generation_queue enable row level security;

drop policy if exists "admin_manage_event_guide_generation_queue" on public.event_guide_generation_queue;
create policy "admin_manage_event_guide_generation_queue" on public.event_guide_generation_queue
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
