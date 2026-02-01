alter table public.roblox_universes
  add column if not exists created_at_api timestamptz,
  add column if not exists updated_at_api timestamptz;

update public.roblox_universes
set
  created_at_api = coalesce(
    case
      when (raw_details->>'created') ~ '^\\d{4}-\\d{2}-\\d{2}' then (raw_details->>'created')::timestamptz
      else null
    end,
    case
      when (raw_details->'data'->>'created') ~ '^\\d{4}-\\d{2}-\\d{2}' then (raw_details->'data'->>'created')::timestamptz
      else null
    end
  ),
  updated_at_api = coalesce(
    case
      when (raw_details->>'updated') ~ '^\\d{4}-\\d{2}-\\d{2}' then (raw_details->>'updated')::timestamptz
      else null
    end,
    case
      when (raw_details->'data'->>'updated') ~ '^\\d{4}-\\d{2}-\\d{2}' then (raw_details->'data'->>'updated')::timestamptz
      else null
    end
  )
where created_at_api is null or updated_at_api is null;
