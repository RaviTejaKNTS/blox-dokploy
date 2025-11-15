-- Game lists metadata for reusable list pages
create table if not exists public.game_lists (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  title text not null,
  hero_md text,
  intro_md text,
  outro_md text,
  meta_title text,
  meta_description text,
  cover_image text,
  list_type text not null default 'sql' check (list_type in ('sql','manual','hybrid')),
  filter_config jsonb not null default '{}'::jsonb,
  limit_count int not null default 50 check (limit_count > 0),
  is_published boolean not null default false,
  refreshed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_game_lists_slug on public.game_lists (lower(slug));
create index if not exists idx_game_lists_published on public.game_lists (is_published, updated_at desc);

create table if not exists public.game_list_entries (
  list_id uuid not null references public.game_lists(id) on delete cascade,
  universe_id bigint not null references public.roblox_universes(universe_id) on delete cascade,
  game_id uuid references public.games(id) on delete set null,
  rank int not null,
  metric_value numeric,
  reason text,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (list_id, universe_id)
);

create index if not exists idx_game_list_entries_rank on public.game_list_entries (list_id, rank);
create index if not exists idx_game_list_entries_game on public.game_list_entries (game_id);
create index if not exists idx_game_list_entries_universe on public.game_list_entries (universe_id);

-- update timestamp triggers
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_game_lists_updated_at on public.game_lists;
create trigger trg_game_lists_updated_at before update on public.game_lists
for each row execute function public.set_updated_at();

drop trigger if exists trg_game_list_entries_updated_at on public.game_list_entries;
create trigger trg_game_list_entries_updated_at before update on public.game_list_entries
for each row execute function public.set_updated_at();
