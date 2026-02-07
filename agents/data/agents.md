# Data sources

## Supabase (primary)
These are the tables/views the site and APIs read from most often.

- Core content
  - games, code_pages_view, game_pages_index_view (codes pages + list views)
  - articles, article_pages_view, article_pages_index_view (articles + list views)
  - authors (author profiles)
  - game_lists, game_lists_index_view, game_list_entries (ranking lists)
  - checklist_pages, checklist_pages_view, checklist_items (checklists)
  - tools, tools_view (tool content + list views)
  - catalog_pages, catalog_pages_view (catalog page copy)
  - events_pages (event landing pages)
- Roblox data enrichment
  - roblox_universes (universe metadata, socials, counts)
  - roblox_groups (group details for ID extractor)
  - roblox_universe_gamepasses, roblox_universe_badges (ID extractor lookups)
- Music IDs catalog
  - roblox_music_ids (raw IDs and stats)
  - roblox_music_ids_ranked_view (sorted/filterable catalog)
  - roblox_music_genres_view, roblox_music_artists_view (filter options)
- Admin / ops
  - app_users (role-based access)
  - RPC: search_site (site-wide search aggregator)

## Local datasets (tools and catalog)
- data/Admin commands/*.md
  - Parsed by src/lib/admin-commands.ts.
  - Used by catalog/admin-commands hub and system pages.
- data/Grow a Garden/crops.json
  - Parsed by src/lib/grow-a-garden/crops.ts.
  - Used by tools/grow-a-garden-crop-value-calculator.
- data/Fisch/fish.json
  - Fisch fish catalog from fischipedia.org.
- data/The Forge/ores.json
  - Parsed by src/lib/forge/ores.ts.
  - Used by tools/the-forge-crafting-calculator.
- data/The Forge/weapons.json
  - Parsed by src/lib/forge/weapons.ts.
  - Used by tools/the-forge-crafting-calculator.
- data/The Forge/armors.json
  - Parsed by src/lib/forge/armors.ts.
  - Used by tools/the-forge-crafting-calculator.
- data/The Forge/pickaxes.json
  - The Forge pickaxe catalog from theforgewiki.org.
- data/The Forge/runes.json
  - The Forge rune catalog from theforgewiki.org.
- data/The Forge/races.json
  - The Forge race catalog from theforgewiki.org.
- data/The Forge/essences.json
  - The Forge essence catalog from theforgewiki.org.
- data/The Forge/totems.json
  - The Forge totem list from theforgewiki.org.
- data/The Forge/potions.json
  - The Forge potion list from theforgewiki.org.
- data/The Forge/enemies.json
  - The Forge enemy list from theforgewiki.org.
- data/The Forge/npcs.json
  - Placeholder dataset (no source page found yet).
- data/The Forge/locations.json
  - The Forge locations list from theforgewiki.org.

## Static configs and JSON
- src/data/slug_oldslugs.json
  - Legacy slug redirect map for /[slug] -> /codes or /articles.
- src/app/(site)/tools/robux-to-usd-calculator/robux-bundles.ts
- src/app/(site)/tools/robux-to-usd-calculator/robux-plans.ts
  - Pricing tables for the Robux to USD calculator.
- src/lib/devex/constants
  - DevEx baseline values for the DevEx calculator.
- public/*
  - OG images, logos, favicons, ads.txt, and other static assets.

## External APIs (runtime + scripts)
- Roblox public APIs (games/users/groups/catalog, thumbnails, asset delivery).
- Telegram API for automation summaries (scripts/report-automation.mjs).
