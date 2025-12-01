-- Tools table to power calculator/tool pages
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.tools (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,
  title text not null,
  seo_title text not null,
  meta_description text not null,
  intro_md text not null,
  how_it_works_md text not null,
  description_json jsonb not null default '{}'::jsonb,
  faq_json jsonb not null default '[]'::jsonb,
  cta_label text,
  cta_url text,
  schema_ld_json jsonb,
  thumb_url text,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tools_is_published on public.tools (is_published);

create trigger trg_tools_updated_at
before update on public.tools
for each row
execute function public.set_updated_at();
