# Automation scripts

## How to run
- Most scripts are TypeScript and are run via tsx (see package.json scripts).
- Many scripts require Supabase credentials and other env vars; check your runtime config.

## Content generation + editing
- scripts/generate-articles.ts: batch article generation into Supabase.
- scripts/generate-game-article.ts: generate a single game article.
- scripts/generate-events-articles.ts: generate event guide articles from events pages.
- scripts/run-generation-queue.ts: worker for queued generation tasks.
- scripts/run-article-generation-queue.ts: worker for article generation queue.
- scripts/update-articles.ts: refresh/update existing article content.
- scripts/rewrite-codes-articles.ts: rewrite/refresh code articles.
- scripts/generate-universe-description.ts: generate/update universe descriptions.
- scripts/queue-event-guides.ts: queue event guide content for generation.

## Codes refresh + distribution
- scripts/update-codes.ts: refresh active/expired code lists.
- scripts/post-codes.ts: publish code updates to outbound channels.
- scripts/post-online.ts: post a single game update.
- scripts/post-roblox-vibes.ts: post Roblox vibes updates.

## Universe + metadata ingestion
- scripts/import-games.ts: import games into Supabase.
- scripts/collect-roblox-universes.ts: collect universe records from Roblox APIs.
- scripts/backfill-game-universes.ts: backfill missing universe IDs.
- scripts/update-universe-slugs.ts: normalize/update universe slugs.
- scripts/sync-game-slugs.ts: sync game slugs with canonical.
- scripts/enrich-roblox-universes.ts: enrich universe metadata (socials, flags, etc).
- scripts/update-universe-stats.ts: refresh universe stats (visits, likes, etc).
- scripts/update-universe-playing.ts: refresh current playing counts.
- scripts/backfill-social-links.ts: backfill social links for universes.
- scripts/backfill-missing-cover-images.ts: fill missing cover images.
- scripts/backfill-interlinking.ts: backfill interlinking AI copy.

## Lists + rankings
- scripts/refresh-game-lists.ts: refresh list entries and rankings.
- scripts/seed-trending-lists.ts: seed trending lists.

## Events
- scripts/collect-roblox-virtual-events.ts: ingest Roblox virtual events.
- scripts/seed-events-pages.ts: create/update event landing pages.
- scripts/seed-event-details.ts: backfill event details for pages.
- scripts/lib/revalidate-events.ts: helper for revalidating event pages via API.

## Music IDs + catalog
- scripts/collect-roblox-music-ids.ts: ingest music IDs from Roblox sources.
- scripts/collect-curated-roblox-music-ids.ts: ingest curated music IDs.
- scripts/import-roblox-music-id-seeds.ts: import seed lists into Supabase.
- scripts/scrape-roblox-music-id-seeds.ts: scrape external seed lists.
- scripts/enrich-roblox-music-ids.ts: enrich music IDs with metadata.
- scripts/backfill-roblox-music-thumbnails.ts: backfill album art thumbnails.
- scripts/verify-roblox-music-ids.ts: verify boombox readiness / availability.
- scripts/collect-roblox-catalog-items.ts: ingest Roblox catalog items.
- scripts/enrich-roblox-catalog-items.ts: enrich catalog items with metadata.

## Ads + diagnostics
- scripts/update-ads-txt.ts: update ads.txt before builds.
- scripts/report-redeem-md-missing-images.ts: report missing images in redeem markdown.
- scripts/debug-extract-images.ts: debug image extraction in markdown.
- scripts/report-automation.mjs: send automation summaries to Telegram.
