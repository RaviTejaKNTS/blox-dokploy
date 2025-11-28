-- Deduplicate existing rows so the unique constraint can be applied.
with dupes as (
  select
    id,
    row_number() over (partition by entity_type, slug order by created_at desc, id desc) as rn
  from public.revalidation_events
)
delete from public.revalidation_events
where id in (select id from dupes where rn > 1);

-- Enforce one row per (entity_type, slug) going forward.
alter table public.revalidation_events
  add constraint revalidation_events_entity_slug_key unique (entity_type, slug);
