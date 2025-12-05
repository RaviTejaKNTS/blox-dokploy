-- Add published_at to tools and stamp when is_published flips to true

alter table if exists public.tools
  add column if not exists published_at timestamptz;

alter table if exists public.tools
  alter column published_at drop default;

create or replace function public.set_tool_published_at() returns trigger as $$
begin
  if new.is_published = true
     and (old.is_published is distinct from true)
     and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_tool_published_at on public.tools;
create trigger trg_set_tool_published_at
before insert or update on public.tools
for each row execute function public.set_tool_published_at();

-- Backfill existing published rows
update public.tools
set published_at = coalesce(published_at, created_at)
where is_published = true
  and published_at is null;
