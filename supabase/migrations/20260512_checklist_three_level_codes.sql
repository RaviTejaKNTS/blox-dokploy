-- Allow three-level section codes (e.g., 1, 1.1, 1.1.1, 1.0.2) and drop the unused position column

-- Relax section_code constraint
alter table if exists public.checklist_items
  drop constraint if exists checklist_items_section_code_check;

-- Drop old uniqueness that referenced position
alter table if exists public.checklist_items
  drop constraint if exists checklist_items_page_id_section_code_position_title_key;

-- Drop old index that referenced position
drop index if exists idx_checklist_items_page_section;

-- Drop the position column (no data to preserve)
alter table if exists public.checklist_items
  drop column if exists position;

-- Drop section_name column (no data to preserve)
alter table if exists public.checklist_items
  drop column if exists section_name;

-- Update normalization to collapse extra dots and trim edges (safe to rerun)
create or replace function public.normalize_section_code(raw text) returns text as $$
declare
  cleaned text;
begin
  cleaned := regexp_replace(coalesce(raw, ''), E'[\\s\\u00A0]', '', 'g');
  cleaned := regexp_replace(cleaned, '[^0-9\\.]', '', 'g');
  cleaned := regexp_replace(cleaned, '\\.{2,}', '.', 'g');
  cleaned := regexp_replace(cleaned, '^\\.|\\.$', '', 'g');
  return cleaned;
end;
$$ language plpgsql immutable;

-- Normalize existing rows before adding constraints
update public.checklist_items
set section_code = public.normalize_section_code(section_code)
where section_code is not null;

-- Set any empty/invalid codes to a safe default before the new constraint
update public.checklist_items
set section_code = '0'
where section_code is null
   or trim(section_code) = ''
   or section_code !~ '^[0-9]+(?:\\.[0-9]+){0,2}$';

-- Add new constraint for up to two dots in the code
alter table if exists public.checklist_items
  add constraint checklist_items_section_code_check
    check (section_code ~ '^[0-9]+(?:\\.[0-9]+){0,2}$');

-- Add a simpler uniqueness constraint
alter table if exists public.checklist_items
  drop constraint if exists checklist_items_page_id_section_code_title_key;
alter table if exists public.checklist_items
  add constraint checklist_items_page_id_section_code_title_key
    unique (page_id, section_code, title);

-- Recreate the index without position
create index if not exists idx_checklist_items_page_section on public.checklist_items (page_id, section_code);
