-- Trim section_code before enforcing pattern and allow values with incidental whitespace
alter table public.checklist_items
  drop constraint if exists checklist_items_section_code_check;

update public.checklist_items
set section_code = trim(section_code)
where section_code is not null;

alter table public.checklist_items
  add constraint checklist_items_section_code_check
    check (trim(section_code) ~ '^[0-9]+(\\.[0-9]+)?$');
