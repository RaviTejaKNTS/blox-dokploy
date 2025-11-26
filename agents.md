Ways to make it faster for bots and users:

Cache harder: set long s-maxage/stale-while-revalidate headers on ISR pages and static assets; keep on-demand revalidation for freshness.
Trim JS: remove unused client scripts, defer/async analytics, avoid heavy libraries; favor server components and static rendering; code-split non-critical UI.
Images/media: use Next Image with proper sizes, AVIF/WebP, and lazy loading; purge unused assets; tighten remotePatterns.
CSS/fonts: preload critical fonts, use fewer font weights, and prefer system/hosted fonts to cut blocking requests.
Reduce blocking scripts: keep third-party scripts minimal; everything non-essential should be async/deferred.
Database/views: ensure base table indexes cover view queries; keep views lean; avoid N+1 in server code; monitor slow queries.
Delivery: enable Brotli/HTTP/2, CDN edge caching for all static/ISR routes; preconnect to primary domains (roblox assets).
Hydration cost: avoid client components where not needed, keep props small, and strip unused React features on server routes.
Warm critical pages: pre-render or warm top slugs post-deploy so bots/users always hit cached responses.
Monitor: track TTFB and LCP via RUM or Search Console; watch Supabase latency and Next logs for cache misses.
These are additive to the current on-demand revalidation and view-based data fetching.