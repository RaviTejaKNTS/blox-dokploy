-- Allow game list refresh to run arbitrary SELECT queries and shape them
-- into the game_list_entries payload without app-side computation.
create or replace function public.run_game_list_sql(
  sql_text text,
  limit_count int default null
)
returns table (
  universe_id bigint,
  rank int,
  metric_value numeric,
  reason text,
  extra jsonb,
  game_id uuid,
  playing bigint,
  visits bigint,
  favorites bigint,
  likes bigint,
  dislikes bigint
)
language plpgsql
set search_path = public
as $$
declare
  trimmed text;
  capped_limit int;
begin
  if sql_text is null or length(trim(sql_text)) = 0 then
    raise exception 'sql_text is required';
  end if;

  trimmed := ltrim(sql_text);
  if lower(left(trimmed, 6)) <> 'select' then
    raise exception 'sql_text must start with SELECT';
  end if;

  capped_limit := nullif(limit_count, 0);

  return query execute format(
    'select * from (%s) as src(universe_id, rank, metric_value, reason, extra, game_id, playing, visits, favorites, likes, dislikes) %s',
    sql_text,
    case
      when capped_limit is null then ''
      else format('limit %s', capped_limit)
    end
  );
end;
$$;
