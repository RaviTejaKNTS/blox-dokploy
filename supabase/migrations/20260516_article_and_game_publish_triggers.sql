-- Ensure published_at is only set when publishing

-- Articles: drop any default and add trigger to stamp on publish
alter table if exists public.articles
  alter column published_at drop default;

create or replace function public.set_article_published_at() returns trigger as $$
begin
  if NEW.is_published = true
     and (OLD.is_published is distinct from true)
     and NEW.published_at is null then
    NEW.published_at := now();
  end if;
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_set_article_published_at on public.articles;
create trigger trg_set_article_published_at
before insert or update on public.articles
for each row execute function public.set_article_published_at();

-- Games: add published_at and trigger to stamp when is_published flips to true
alter table if exists public.games
  add column if not exists published_at timestamptz;

alter table if exists public.games
  alter column published_at drop default;

create or replace function public.set_game_published_at() returns trigger as $$
begin
  if NEW.is_published = true
     and (OLD.is_published is distinct from true)
     and NEW.published_at is null then
    NEW.published_at := now();
  end if;
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_set_game_published_at on public.games;
create trigger trg_set_game_published_at
before insert or update on public.games
for each row execute function public.set_game_published_at();
