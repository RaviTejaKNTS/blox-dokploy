-- Normalize section_code and accept simple numeric dot patterns even if whitespace or stray characters are present
alter table public.checklist_items
  drop constraint if exists checklist_items_section_code_check;

update public.checklist_items
set section_code = trim(regexp_replace(section_code, '[^0-9\\.]+', '', 'g'))
where section_code is not null;

alter table public.checklist_items
  add constraint checklist_items_section_code_check
    check (regexp_replace(trim(section_code), '[^0-9\\.]', '', 'g') ~ '^[0-9]+(\\.[0-9]+)?$');
