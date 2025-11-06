-- Deduplicate case-insensitive codes and enforce canonical casing
with ranked as (
  select
    id,
    row_number() over (
      partition by game_id, upper(btrim(code))
      order by last_seen_at desc, first_seen_at desc, id desc
    ) as rn
  from public.codes
)
delete from public.codes
where id in (select id from ranked where rn > 1);

-- Canonicalize stored codes to trimmed values (preserve original casing)
update public.codes
set code = btrim(code)
where code is not null
  and code <> btrim(code);

-- Ensure provider priority column exists
alter table if exists public.codes
  add column if not exists provider_priority int not null default 0;

-- Canonicalize and deduplicate expired code arrays stored on games
with normalized as (
  select
    g.id as game_id,
    coalesce(
      (
        select to_jsonb(array_agg(d.value order by upper(d.value)))
        from (
          select distinct on (upper(btrim(value))) btrim(value) as value
          from jsonb_array_elements_text(coalesce(g.expired_codes, '[]'::jsonb)) as value
          where coalesce(btrim(value), '') <> ''
          order by upper(btrim(value)), btrim(value)
        ) as d
      ),
      '[]'::jsonb
    ) as normalized_codes
  from public.games g
)
update public.games as g
set expired_codes = normalized.normalized_codes
from normalized
where g.id = normalized.game_id
  and g.expired_codes is distinct from normalized.normalized_codes;

-- Ensure case-insensitive uniqueness for codes per game
drop index if exists idx_codes_game_code_upper;
create unique index idx_codes_game_code_upper on public.codes (game_id, upper(code));
