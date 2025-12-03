-- Add markdown description to checklist pages
alter table public.checklist_pages
  add column if not exists description_md text;
