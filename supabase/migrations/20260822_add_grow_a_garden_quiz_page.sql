-- Seed Grow a Garden quiz page
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
    where lower(slug) = 'grow-a-garden'
       or lower(name) = 'grow a garden'
       or lower(display_name) = 'grow a garden'
    limit 1
  ),
  'grow-a-garden',
  'Grow a Garden Quiz',
  'Challenge yourself with 15 randomized questions about Grow a Garden. Mix of easy, medium, and hard questions with instant feedback.',
  'Grow a Garden Quiz',
  'Take the Grow a Garden quiz with 15 mixed-difficulty questions about seeds, mutations, pets, and gear.',
  true
)
on conflict (code) do update
set universe_id = excluded.universe_id,
    title = excluded.title,
    description_md = excluded.description_md,
    seo_title = excluded.seo_title,
    seo_description = excluded.seo_description,
    is_published = excluded.is_published;
