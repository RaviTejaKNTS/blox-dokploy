# Route handlers (API + non-page)

## API routes
- /api/revalidate
  - File: src/app/api/revalidate/route.ts
  - Method: POST
  - Purpose: On-demand ISR for codes, articles, lists, authors, events, checklists, tools, and catalog pages.
  - Auth: Authorization Bearer REVALIDATE_SECRET.
- /api/roblox-id-extractor
  - File: src/app/api/roblox-id-extractor/route.ts
  - Method: GET
  - Purpose: Resolve Roblox URLs/IDs into typed entities; fetches from Roblox APIs and falls back to Supabase caches.
  - Data: roblox_universes, roblox_groups, roblox_universe_gamepasses, roblox_universe_badges.
- /api/roblox-music-ids
  - File: src/app/api/roblox-music-ids/route.ts
  - Method: GET
  - Purpose: Paginated search + sort for music IDs.
  - Data: roblox_music_ids_ranked_view.
- /api/search/all
  - File: src/app/api/search/all/route.ts
  - Method: GET
  - Purpose: Site-wide search aggregation.
  - Data: RPC search_site.
- /api/search/games
  - File: src/app/api/search/games/route.ts
  - Method: GET
  - Purpose: Lightweight games list for search UI.
  - Data: game_pages_index_view via listGamesWithActiveCounts.

## Other route handlers
- /sitemap.xml
  - File: src/app/sitemap.xml/route.ts
  - Method: GET
  - Purpose: Build sitemap from Supabase content + static routes; excludes deep music-ID pages.
- /auth/callback
  - File: src/app/auth/callback/route.ts
  - Method: POST
  - Purpose: Supabase auth callback for setting or clearing sessions.
