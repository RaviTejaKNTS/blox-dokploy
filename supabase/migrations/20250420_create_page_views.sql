-- Views to simplify read paths for codes, articles, and lists

-- Codes/game pages view: game + author + universe + aggregated codes/counts + recommendations
create or replace view public.code_pages_view as
with code_stats as (
  select
    game_id,
    jsonb_agg(c order by c.status, c.last_seen_at desc) filter (where c.id is not null) as codes,
    count(*) filter (where c.status = 'active') as active_code_count,
    max(c.first_seen_at) filter (where c.status = 'active') as latest_code_first_seen_at
  from public.codes c
  group by game_id
)
select
  g.*,
  coalesce(cs.codes, '[]'::jsonb) as codes,
  coalesce(cs.active_code_count, 0) as active_code_count,
  cs.latest_code_first_seen_at,
  greatest(
    coalesce(cs.latest_code_first_seen_at, g.updated_at),
    g.updated_at
  ) as content_updated_at,
  case when a.id is null then null else jsonb_build_object(
    'id', a.id,
    'name', a.name,
    'slug', a.slug,
    'gravatar_email', a.gravatar_email,
    'avatar_url', a.avatar_url,
    'bio_md', a.bio_md,
    'twitter', a.twitter,
    'youtube', a.youtube,
    'website', a.website,
    'facebook', a.facebook,
    'linkedin', a.linkedin,
    'instagram', a.instagram,
    'roblox', a.roblox,
    'discord', a.discord,
    'created_at', a.created_at,
    'updated_at', a.updated_at
  ) end as author,
  case when u.universe_id is null then null else jsonb_build_object(
    'universe_id', u.universe_id,
    'slug', u.slug,
    'display_name', u.display_name,
    'name', u.name,
    'creator_name', u.creator_name,
    'creator_id', u.creator_id,
    'creator_type', u.creator_type,
    'social_links', u.social_links,
    'icon_url', u.icon_url,
    'playing', u.playing,
    'visits', u.visits,
    'favorites', u.favorites,
    'likes', u.likes,
    'dislikes', u.dislikes,
    'age_rating', u.age_rating,
    'desktop_enabled', u.desktop_enabled,
    'mobile_enabled', u.mobile_enabled,
    'tablet_enabled', u.tablet_enabled,
    'console_enabled', u.console_enabled,
    'vr_enabled', u.vr_enabled,
    'updated_at', u.updated_at,
    'description', u.description,
    'game_description_md', u.game_description_md
  ) end as universe,
  (
    select coalesce(
      jsonb_agg(rec order by rec.active_code_count desc, rec.updated_at desc),
      '[]'::jsonb
    )
    from (
      select
        g2.id,
        g2.name,
        g2.slug,
        g2.cover_image,
        coalesce(cs2.active_code_count, 0) as active_code_count,
        greatest(coalesce(cs2.latest_code_first_seen_at, g2.updated_at), g2.updated_at) as content_updated_at,
        g2.updated_at
      from public.games g2
      left join code_stats cs2 on cs2.game_id = g2.id
      where g2.is_published = true
        and g2.id <> g.id
      order by coalesce(cs2.active_code_count, 0) desc, g2.updated_at desc
      limit 6
    ) rec
  ) as recommended_games
from public.games g
left join code_stats cs on cs.game_id = g.id
left join public.authors a on a.id = g.author_id
left join public.roblox_universes u on u.universe_id = g.universe_id;

-- Articles view: article + author + universe JSON + related articles
create or replace view public.article_pages_view as
select
  art.*,
  case when a.id is null then null else jsonb_build_object(
    'id', a.id,
    'name', a.name,
    'slug', a.slug,
    'gravatar_email', a.gravatar_email,
    'avatar_url', a.avatar_url,
    'bio_md', a.bio_md,
    'twitter', a.twitter,
    'youtube', a.youtube,
    'website', a.website,
    'facebook', a.facebook,
    'linkedin', a.linkedin,
    'instagram', a.instagram,
    'roblox', a.roblox,
    'discord', a.discord,
    'created_at', a.created_at,
    'updated_at', a.updated_at
  ) end as author,
  case when u.universe_id is null then null else jsonb_build_object(
    'universe_id', u.universe_id,
    'slug', u.slug,
    'display_name', u.display_name,
    'name', u.name
  ) end as universe,
  (
    select coalesce(
      jsonb_agg(rec order by rec.published_at desc),
      '[]'::jsonb
    )
    from (
      select
        a2.id,
        a2.title,
        a2.slug,
        a2.cover_image,
        a2.published_at,
        a2.updated_at,
        case when a3.id is null then null else jsonb_build_object(
          'id', a3.id,
          'name', a3.name,
          'slug', a3.slug,
          'avatar_url', a3.avatar_url,
          'gravatar_email', a3.gravatar_email
        ) end as author
      from public.articles a2
      left join public.authors a3 on a3.id = a2.author_id
      where a2.is_published = true
        and a2.id <> art.id
      order by a2.published_at desc
      limit 6
    ) rec
  ) as related_articles
from public.articles art
left join public.authors a on a.id = art.author_id
left join public.roblox_universes u on u.universe_id = art.universe_id;

-- Game lists view: list + aggregated entries with universe/game details + badges + other lists
create or replace view public.game_lists_view as
select
  l.*,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'universe_id', e.universe_id,
        'list_id', e.list_id,
        'rank', e.rank,
        'metric_value', e.metric_value,
        'reason', e.reason,
        'extra', e.extra,
        'game_id', e.game_id,
        'game', case when g.id is null then null else jsonb_build_object(
          'id', g.id,
          'name', g.name,
          'slug', g.slug,
          'cover_image', g.cover_image,
          'universe_id', g.universe_id
        ) end,
        'universe', case when u.universe_id is null then null else jsonb_build_object(
          'universe_id', u.universe_id,
          'slug', u.slug,
          'display_name', u.display_name,
          'name', u.name,
          'icon_url', u.icon_url,
          'playing', u.playing,
          'visits', u.visits,
          'favorites', u.favorites,
          'likes', u.likes,
          'dislikes', u.dislikes,
          'age_rating', u.age_rating,
          'desktop_enabled', u.desktop_enabled,
          'mobile_enabled', u.mobile_enabled,
          'tablet_enabled', u.tablet_enabled,
          'console_enabled', u.console_enabled,
          'vr_enabled', u.vr_enabled,
          'updated_at', u.updated_at,
          'description', u.description,
          'game_description_md', u.game_description_md
        ) end,
        'badges',
          (
            select coalesce(
              jsonb_agg(rec order by rec.rank),
              '[]'::jsonb
            )
            from (
              select
                gle2.list_id,
                gl2.slug as list_slug,
                gl2.title as list_title,
                gle2.rank
              from public.game_list_entries gle2
              join public.game_lists gl2 on gl2.id = gle2.list_id and gl2.is_published = true
              where gle2.universe_id = e.universe_id
                and (gl2.id <> l.id)
                and gle2.rank between 1 and 3
              order by gle2.rank
              limit 3
            ) rec
          )
      )
      order by e.rank
    ) filter (where e.universe_id is not null),
    '[]'::jsonb
  ) as entries,
  (
    select coalesce(
      jsonb_agg(rec order by rec.updated_at desc),
      '[]'::jsonb
    )
    from (
      select
        l2.id,
        l2.slug,
        l2.title,
        l2.updated_at
      from public.game_lists l2
      where l2.is_published = true
        and l2.id <> l.id
      order by l2.updated_at desc
      limit 6
    ) rec
  ) as other_lists
from public.game_lists l
left join public.game_list_entries e on e.list_id = l.id
left join public.roblox_universes u on u.universe_id = e.universe_id
left join public.games g on g.id = e.game_id
group by l.id;
