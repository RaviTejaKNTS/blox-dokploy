-- Add storage for AI-generated interlinking content and reset link counters
alter table public.games
  add column if not exists interlinking_ai jsonb not null default '{}'::jsonb;

alter table public.games
  add column if not exists interlinking_ai_copy_md text;

-- Start fresh on internal link usage
update public.games
set internal_links = 0;

-- Refresh view so new column is exposed to the app layer
drop view if exists public.code_pages_view;
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
  g.id,
  g.name,
  g.slug,
  g.old_slugs,
  g.author_id,
  g.roblox_link,
  g.universe_id,
  g.community_link,
  g.discord_link,
  g.twitter_link,
  g.youtube_link,
  g.expired_codes,
  g.cover_image,
  g.seo_title,
  g.seo_description,
  g.intro_md,
  g.redeem_md,
  g.troubleshoot_md,
  g.rewards_md,
  g.about_game_md,
  g.description_md,
  g.internal_links,
  g.is_published,
  g.re_rewritten_at,
  g.created_at,
  g.updated_at,
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
  ) as recommended_games,
  g.interlinking_ai_copy_md
from public.games g
left join code_stats cs on cs.game_id = g.id
left join public.authors a on a.id = g.author_id
left join public.roblox_universes u on u.universe_id = g.universe_id;
