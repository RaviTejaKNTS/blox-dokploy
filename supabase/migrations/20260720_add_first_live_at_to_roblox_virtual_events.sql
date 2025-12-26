alter table if exists public.roblox_virtual_events
  add column if not exists first_live_at timestamptz;

create index if not exists idx_roblox_virtual_events_first_live_at
  on public.roblox_virtual_events (first_live_at);
