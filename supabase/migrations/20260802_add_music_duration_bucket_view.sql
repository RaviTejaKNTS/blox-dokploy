-- Duration bucket view for music ID ordering (prefer full-length songs first).
-- Preferred length: 90-300s; expansion step: 30s.

drop view if exists public.roblox_music_ids_ranked_view;
create or replace view public.roblox_music_ids_ranked_view as
select
  rm.*,
  case
    when rm.duration_seconds is null or rm.duration_seconds <= 0 then 999
    when rm.duration_seconds between 90 and 300 then 0
    when rm.duration_seconds < 90 then ceil((90 - rm.duration_seconds)::numeric / 30)::int
    else ceil((rm.duration_seconds - 300)::numeric / 30)::int
  end as duration_bucket
from public.roblox_music_ids rm;
