# Agents: Bloxodes site guide

This folder is the reference set for page types, scripts, data sources, and our content/runtime preferences.

## Index
- agents/pages/agents.md: UI page inventory, data sources, and revalidate values.
- agents/routes/agents.md: API + route handlers (search, revalidate, sitemap, auth callback).
- agents/scripts/agents.md: automation scripts and what each one does.
- agents/data/agents.md: data storage (Supabase, markdown datasets, static configs).

## Stack snapshot
- Next.js App Router (server components by default).
- Supabase as primary data store (tables + views + RPC).
- Markdown content stored in Supabase and local data/*.md files for certain tools.
- Automation in scripts/*.ts via tsx.

## Process + preferences
- Server-first rendering: use server components and fetch data in page/data loaders; use client components only when interactive.
- Lean data access: prefer view tables (e.g., *_view, *_index_view) for list pages; avoid pulling heavy columns for index pages.
- Cache discipline:
  - Page-level ISR via export const revalidate.
  - Data-level caching via unstable_cache with tags in src/lib/*.ts.
  - On-demand revalidation via POST /api/revalidate with REVALIDATE_SECRET.
- SEO rules:
  - Always set metadata or generateMetadata; include canonical URLs.
  - Add JSON-LD for CollectionPage, Article, FAQ, Breadcrumb, ItemList where applicable.
  - Use resolveSeoTitle for templated titles (%month%, %year%).
- Performance rules:
  - Use next/image for media; keep images optimized and sized.
  - Use dynamic imports for client-only widgets (syntax highlighting, calculators, analytics).
  - Avoid fetching large JSON blobs for index pages; use lean views.
- Tool content:
  - Long-form tool copy lives in Supabase (tools/tools_view).
  - Structured tool data for calculators lives in data/*.md and is parsed in src/lib/*.

## Change checklist
- New page type:
  - Add route + metadata + JSON-LD.
  - Set a revalidate value aligned with data freshness.
  - Update src/app/sitemap.xml/route.ts and src/app/api/revalidate/route.ts if needed.
  - Add the new route to agents/pages/agents.md.
- New script:
  - Add to agents/scripts/agents.md.
  - Add npm script entry if it should be run via package.json.
- New catalog/tool:
  - Add entry in Supabase and update src/lib/catalog.ts or src/lib/tools.ts.
  - Ensure revalidation tags include the new code.
