-- Quiz pages table to power game quiz pages
create table if not exists public.quiz_pages (
  id uuid primary key default uuid_generate_v4(),
  universe_id bigint references public.roblox_universes(universe_id) on delete set null,
  code text not null unique,
  title text not null,
  description_md text,
  seo_title text,
  seo_description text,
  is_published boolean not null default true,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_quiz_pages_is_published
  on public.quiz_pages (is_published, published_at desc nulls last, updated_at desc);
create index if not exists idx_quiz_pages_universe_id on public.quiz_pages (universe_id);

create trigger trg_quiz_pages_updated_at
before update on public.quiz_pages
for each row
execute function public.set_updated_at();

create or replace function public.set_quiz_page_published_at() returns trigger as $$
begin
  if new.is_published = true
     and (old.is_published is distinct from true)
     and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_quiz_page_published_at on public.quiz_pages;
create trigger trg_set_quiz_page_published_at
before insert or update on public.quiz_pages
for each row execute function public.set_quiz_page_published_at();

update public.quiz_pages
set published_at = coalesce(published_at, created_at)
where is_published = true
  and published_at is null;

-- Quiz pages view with universe info
drop view if exists public.quiz_pages_view;
create or replace view public.quiz_pages_view as
select
  qp.*,
  greatest(qp.updated_at, coalesce(qp.published_at, qp.updated_at)) as content_updated_at,
  case when u.universe_id is null then null else jsonb_build_object(
    'universe_id', u.universe_id,
    'slug', u.slug,
    'display_name', u.display_name,
    'name', u.name,
    'icon_url', u.icon_url,
    'thumbnail_urls', u.thumbnail_urls,
    'genre_l1', u.genre_l1,
    'genre_l2', u.genre_l2
  ) end as universe
from public.quiz_pages qp
left join public.roblox_universes u on u.universe_id = qp.universe_id;

-- User quiz progress (account-scoped)
create table if not exists public.user_quiz_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  quiz_code text not null,
  seen_question_ids text[] not null default '{}'::text[],
  last_score int,
  last_total int,
  last_breakdown jsonb not null default '{}'::jsonb,
  last_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, quiz_code)
);

create index if not exists idx_user_quiz_progress_code
  on public.user_quiz_progress (quiz_code);

alter table public.user_quiz_progress enable row level security;

drop policy if exists "admin_full_access" on public.user_quiz_progress;
create policy "admin_full_access" on public.user_quiz_progress
  for all using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "user_quiz_progress_select_own" on public.user_quiz_progress;
create policy "user_quiz_progress_select_own" on public.user_quiz_progress
  for select using (auth.uid() = user_id);

drop policy if exists "user_quiz_progress_insert_own" on public.user_quiz_progress;
create policy "user_quiz_progress_insert_own" on public.user_quiz_progress
  for insert with check (auth.uid() = user_id);

drop policy if exists "user_quiz_progress_update_own" on public.user_quiz_progress;
create policy "user_quiz_progress_update_own" on public.user_quiz_progress
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_quiz_progress_delete_own" on public.user_quiz_progress;
create policy "user_quiz_progress_delete_own" on public.user_quiz_progress
  for delete using (auth.uid() = user_id);

drop trigger if exists trg_user_quiz_progress_updated_at on public.user_quiz_progress;
create trigger trg_user_quiz_progress_updated_at
before update on public.user_quiz_progress
for each row execute function public.set_updated_at();

-- Revalidation coverage for quiz pages
alter table public.revalidation_events
  drop constraint if exists revalidation_events_entity_type_check;

alter table public.revalidation_events
  add constraint revalidation_events_entity_type_check
  check (entity_type in ('code','article','list','author','event','checklist','tool','catalog','music','quiz'));

create or replace function public.trg_enqueue_revalidation_quiz_pages()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.enqueue_revalidation('quiz', old.code, 'quiz_pages_delete');
  elsif new.is_published = true then
    perform public.enqueue_revalidation('quiz', new.code, 'quiz_pages_' || lower(tg_op));
  elsif tg_op = 'UPDATE' and old.is_published = true then
    perform public.enqueue_revalidation('quiz', old.code, 'quiz_pages_unpublish');
  end if;
  return null;
end;
$$;

drop trigger if exists trg_enqueue_revalidation_quiz_pages on public.quiz_pages;
create trigger trg_enqueue_revalidation_quiz_pages
after insert or update or delete on public.quiz_pages
for each row execute function public.trg_enqueue_revalidation_quiz_pages();

-- Search index for quiz pages
create or replace function public.trg_search_index_quiz_pages()
returns trigger
language plpgsql
as $$
declare
  v_search text;
begin
  if (tg_op = 'DELETE') then
    delete from public.search_index
    where entity_type = 'quiz'
      and entity_id = old.id::text;
    return null;
  end if;

  v_search := left(
    concat_ws(
      ' ',
      new.title,
      new.code,
      new.seo_title,
      new.seo_description,
      new.description_md
    ),
    3000
  );

  perform public.upsert_search_index(
    'quiz',
    new.id::text,
    new.code,
    new.title,
    'Quiz',
    '/quizzes/' || new.code,
    new.updated_at,
    new.is_published,
    v_search
  );

  return null;
end;
$$;

drop trigger if exists trg_search_index_quiz_pages on public.quiz_pages;
create trigger trg_search_index_quiz_pages
after insert or update or delete on public.quiz_pages
for each row execute function public.trg_search_index_quiz_pages();

-- Seed The Forge quiz page
insert into public.quiz_pages (
  universe_id,
  code,
  title,
  description_md,
  seo_title,
  seo_description,
  is_published
)
values (
  (
    select universe_id
    from public.roblox_universes
    where lower(slug) = 'the-forge'
       or lower(name) = 'the forge'
       or lower(display_name) = 'the forge'
    limit 1
  ),
  'the-forge',
  'The Forge Quiz',
  'Challenge yourself with 15 randomized questions about The Forge. Mix of easy, medium, and hard questions with instant feedback.',
  'The Forge Quiz',
  'Take the Forge quiz with 15 mixed-difficulty questions about in-game mechanics, NPCs, and regions.',
  true
)
on conflict (code) do update
set universe_id = excluded.universe_id,
    title = excluded.title,
    description_md = excluded.description_md,
    seo_title = excluded.seo_title,
    seo_description = excluded.seo_description,
    is_published = excluded.is_published;
