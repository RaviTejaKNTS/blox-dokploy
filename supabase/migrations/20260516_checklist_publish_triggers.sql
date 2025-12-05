-- Stamp checklist_pages.published_at only when is_public flips to true, and backfill missing values

create or replace function public.set_checklist_published_at() returns trigger as $$
begin
  if new.is_public = true
     and (old.is_public is distinct from true)
     and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_checklist_published_at on public.checklist_pages;
create trigger trg_set_checklist_published_at
before insert or update on public.checklist_pages
for each row execute function public.set_checklist_published_at();

-- Backfill existing rows
update public.checklist_pages
set published_at = coalesce(published_at, created_at)
where is_public = true
  and published_at is null;
