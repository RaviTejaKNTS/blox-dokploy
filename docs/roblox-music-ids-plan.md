# Roblox music IDs refresh plan

## Goal
Build a reliable, useful Roblox Music IDs page that only shows playable (Boombox-ready) and popular tracks, while still growing the largest raw catalog for long-term coverage.

## Recommendation (long-run)
Do **not** delete existing IDs. Upgrade the existing `public.roblox_music_ids` table with verification + ranking columns and expose a Boombox-ready view for the public page.

Best long-run structure:
- **Raw table stays**: `public.roblox_music_ids` holds everything collected plus verification data.
- **Boombox view**: `public.roblox_music_ids_boombox_view` filters `boombox_ready = true` and applies sorting for the UI.

Why this is best:
- Avoids data loss and lets us re-score as rules evolve.
- Keeps one source of truth while still surfacing only verified IDs to users.
- Supports the "largest DB" claim without diluting the public page.

## Schema plan (Option B: upgrade existing table)
Add verification + ranking fields to `public.roblox_music_ids` and use a view for Boombox-ready output.

Suggested new columns for `public.roblox_music_ids`:
- `boombox_ready` (bool)
- `boombox_ready_reason` (text)
- `verified_at` (timestamptz)
- `product_info_json` (jsonb) from productinfo
- `asset_delivery_status` (int) last HTTP status from assetdelivery
- `vote_count`, `upvote_percent`, `creator_verified` (from Creator Store)
- `popularity_score` (numeric)

Suggested view: `public.roblox_music_ids_boombox_view`
- Filter: `boombox_ready = true`
- Order: `popularity_score DESC`, then `last_seen_at DESC`

## Data ingestion plan

### 1) Creator Store top charts (high-signal)
Use `toolbox-service/v2/assets:search` with:
- `searchCategoryType=Audio`
- `audioTypes=Music`
- `includeTopCharts=true`
- `musicChartType=Current|Week|Month|Year`
- **No query** (empty query to get actual charts)
This should become the primary source of popular music.

### 2) Creator Store search (breadth)
Keep the existing search, but treat it as raw only:
- Use keyword seeds + duration buckets for breadth.
- Do not surface these directly without verification + scoring.

### 3) Music Discovery top songs
Keep `music-discovery/v1/top-songs` as a second high-signal source.

### 4) Web seed lists (optional)
Use Roblox Den or other sites as **seed inputs** only. Every ID must pass verification before it can appear in curated results.

## Verification plan (Boombox-ready check)
Every candidate ID must pass both checks:
- `https://api.roblox.com/marketplace/productinfo?assetId=...`
  - Must be asset type Audio and not moderated/removed.
- `https://assetdelivery.roblox.com/v1/asset/?id=...`
  - HTTP 200 => likely Open Use (playable in most experiences).
  - HTTP 403 => restricted (not Boombox-ready).

Record the status and reason so we can audit why an ID was excluded.

## Popularity scoring plan
Create a `popularity_score` and sort by it. Suggested inputs:
- Creator Store votes: `voteCount`, `upVotePercent`
- Top charts rank (Current/Week/Month/Year)
- Recency: boost items seen recently
- Creator verified flag (small bonus)

Example scoring (pseudo):
- `score = (voteCount * 0.7) + (upVotePercent * 10) + (chartRankBoost) + (recencyBoost)`

## Page behavior plan
- Default page uses curated table/view only (`boombox_ready = true`).
- Sort by `popularity_score DESC`, then `last_seen_at DESC`.
- If curated results are below a minimum threshold, show a fallback notice and optionally include verified-but-low-score items.

## Migration + rollout plan

### Phase 0: Decision and safety
- Keep raw table and upgrade it with new columns.
- Add a Boombox-ready view for the public page.

### Phase 1: Schema
- Add new columns to `public.roblox_music_ids`.
- Create indexes on `boombox_ready`, `popularity_score`, `verified_at`, `last_seen_at`.
- Create `public.roblox_music_ids_boombox_view`.

### Phase 2: Ingestion
- Add a top-charts pass (no-query) to `scripts/collect-roblox-music-ids.ts`.
- Add a verification pipeline for `productinfo` + `assetdelivery`.
- Store verification results + score in `public.roblox_music_ids`.

### Phase 3: Backfill
- Backfill verification + scoring for existing raw IDs.
- Mark unverified or restricted as `boombox_ready=false`.

### Phase 4: Page update
- Update the catalog queries in `src/app/(site)/catalog/roblox-music-ids/page-data.tsx` to use `public.roblox_music_ids_boombox_view`.
- Add UI copy that these are verified, playable IDs.

### Phase 5: Monitoring
- Re-verify IDs periodically (e.g., weekly) in case permissions change.
- Add alerts for large drops in playable IDs.

## Success criteria
- Page lists only IDs that load in most experiences.
- Rankings look like what players expect (top charts + high votes).
- Raw catalog continues to grow for future re-scoring and coverage.
