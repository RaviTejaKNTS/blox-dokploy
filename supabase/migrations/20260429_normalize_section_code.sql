-- Normalize section_code before enforcing the pattern so imports with stray whitespace/NBSP/carriage returns succeed

-- Drop the existing constraint
alter table public.checklist_items
  drop constraint if exists checklist_items_section_code_check;

-- Helper to normalize section_code
create or replace function public.normalize_section_code(raw text) returns text as $$
declare
  cleaned text;
begin
  -- remove whitespace, NBSP, and any non digit/dot
  cleaned := regexp_replace(coalesce(raw, ''), E'[\\s\\u00A0]', '', 'g');
  cleaned := regexp_replace(cleaned, '[^0-9\\.]', '', 'g');
  return cleaned;
end;
$$ language plpgsql immutable;

-- Update existing rows
update public.checklist_items
set section_code = public.normalize_section_code(section_code)
where section_code is not null;

-- Trigger to normalize on insert/update
create or replace function public.trg_normalize_section_code() returns trigger as $$
begin
  new.section_code := public.normalize_section_code(new.section_code);
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_checklist_items_normalize on public.checklist_items;
create trigger trg_checklist_items_normalize
before insert or update on public.checklist_items
for each row execute function public.trg_normalize_section_code();

-- Re-add relaxed constraint (after normalization)
alter table public.checklist_items
  add constraint checklist_items_section_code_check
    check (section_code ~ '^[0-9]+(\\.[0-9]+)?$');
