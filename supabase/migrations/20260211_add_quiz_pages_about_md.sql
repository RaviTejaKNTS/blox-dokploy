-- Add about_md to quiz pages
alter table public.quiz_pages
  add column if not exists about_md text;

-- Refresh quiz_pages_view to include the new column
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

-- Include about_md in quiz search indexing
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
      new.description_md,
      new.about_md
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
