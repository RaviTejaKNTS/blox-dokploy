# Performance & Egress Optimization Plan

- **Restore static/ISR pages:** Move consent detection from `src/app/layout.tsx` (stop using `headers()`) to a cookie set in `src/middleware.ts` so the root layout and routes can be static/ISR again (`revalidate` respected). Keep consent logic client-side via `ConsentProvider`.
- **Narrow middleware scope:** Update `src/middleware.ts` matcher to skip `_next/static`, `_next/image`, icons, `robots.txt`, and `sitemap.xml` to reduce edge invocations and latency for assets.
- **Cache Supabase reads:** Wrap remaining Supabase fetchers (e.g., `listPublishedGameLists`, `listAuthors`, `getArticleBySlug`, `listPublishedArticlesByUniverseId`, other list/detail fetchers) with `unstable_cache` and tag them to align with `/api/revalidate`.
- **Extend CDN headers:** In `next.config.js`, add `Cache-Control` headers for `/tools/:path*`, `/checklists/:path*`, `/authors/:path*`, `/sitemap.xml`, `/robots.txt`, and `/feed.xml` with `s-maxage` + `stale-while-revalidate`.
- **Image efficiency:** Re-enable Next image optimization (self-hosted loader if avoiding Vercel billing) or ship compressed WebP/AVIF/SVG logos sized to render dimensions; replace remaining `<img>` hero/thumbnail usages with `next/image` where possible.
- **Cache search API:** Add `export const revalidate = 600` (or explicit `Cache-Control`) to `src/app/api/search/all/route.ts`, and consider trimming the payload (fewer items/fields) to cut JSON size.
- **Precompute markdown HTML:** Cache rendered markdown per slug with `unstable_cache` (tagged) or store sanitized HTML in Supabase to avoid per-request rendering.
- **Analytics loading:** Keep Vercel Analytics and Speed Insights, but lazy-load them (e.g., dynamic import or idle callback) to defer JS/requests; consent gating optional per product decision.
