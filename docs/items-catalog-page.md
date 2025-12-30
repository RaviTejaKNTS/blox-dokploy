# Roblox Items/Accessories Data Ingestion Guide (for AI + Codebase Context)

> Goal: **ingest as many Roblox catalog items as possible** (especially accessories), with **robust pagination, dedupe, backfill, and caching**, while staying within practical rate limits.

This document is written as context for an AI model (and engineers) to implement a complete item ingestion pipeline.

---

## 1) What “items/accessories data” means on Roblox

Roblox “items” are typically **catalog assets** (Accessories, clothing, gear, etc.). In practice you will pull item data from multiple APIs:

1. **Catalog Search API** (discovery) – find items by category/subcategory, keyword, creator, etc.
2. **Economy Asset Details API** (enrichment) – price, sale status, limited flags, creator, stock, description.
3. **Thumbnails API** (images) – stable image URLs for rendering.
4. **(Optional) Inventory API** (ownership) – only if you need per-user ownership (requires auth).

There is **no single “all items” endpoint**. Getting “as many items as possible” requires a **systematic crawl strategy**.

---

## 2) Core endpoints (public)

### 2.1 Catalog discovery (primary)

**Endpoint**

* `GET https://catalog.roblox.com/v1/search/items`

**What it’s for**

* Discover items via category/subcategory, sorting, creator filters, keyword partitions.

**Important params** (common)

* `category`: high-level group (e.g., `Accessories`)
* `subcategory`: specific accessory type (e.g., `Hats`, `HairAccessories`, `FaceAccessories`, `NeckAccessories`, `ShoulderAccessories`, `BackAccessories`, `WaistAccessories`)
* `keyword`: query string (used for partitioning; more below)
* `sortType`: `Relevance`, `RecentlyUpdated`, `PriceAsc`, `PriceDesc` (available types can vary)
* `limit`: page size (often up to 30)
* `cursor`: pagination cursor returned in response

**Response fields to capture** (typical)

* `data[]`: list of items (each includes `id`, `name`, sometimes `price`, `creator`, `assetType`, etc.)
* `nextPageCursor`: cursor string or null

> **Key limitation:** catalog search will not yield the entire universe without partitioning. You must query multiple subcategories/sorts/keywords to maximize coverage.

---

### 2.2 Economy details (enrichment)

**Endpoint**

* `GET https://economy.roblox.com/v2/assets/{assetId}/details`

**What it’s for**

* Fetch authoritative details for a single asset: price, sale status, creator, limited flags, stock, name/description.

**Response fields to store** (high value)

* `Name`, `Description`
* `Creator`, `CreatorType`, `CreatorTargetId`
* `PriceInRobux`, `IsForSale`, `IsLimited`, `IsLimitedUnique`
* `Remaining` / stock-like fields (when present)
* `AssetTypeId`, `ProductId` (if present)

> This endpoint is typically more reliable for economic attributes than what catalog search returns.

---

### 2.3 Economy bulk (lightweight)

**Endpoint**

* `GET https://economy.roblox.com/v1/assets?assetIds=ID1,ID2,ID3`

**What it’s for**

* Bulk fetch basic economy fields for many items at once.

**Best use**

* Batch enrichment (faster than per-item `/v2/assets/{id}/details`), then only call the detail endpoint for items where you need the full description or extra fields.

---

### 2.4 Thumbnails (images)

**Endpoint**

* `GET https://thumbnails.roblox.com/v1/assets?assetIds=ID1,ID2&size=420x420&format=Png`

**What it’s for**

* Retrieve stable, cacheable image URLs for assets.

**Store**

* `imageUrl`, `state` (Completed/Pending)

---

## 3) Ingestion architecture overview

### 3.1 Two-phase pipeline

**Phase A — Discovery:**

* Use catalog search to collect **candidate asset IDs**.
* Dedupe aggressively.
* Persist “discovery evidence” (which query produced the ID).

**Phase B — Enrichment:**

* Use economy and thumbnails endpoints to fetch canonical metadata.
* Store normalized fields in your DB.
* Schedule periodic refresh (prices/sale status change).

### 3.2 Data model (suggested)

**Table: `roblox_assets`**

* `asset_id` (PK)
* `name`
* `description`
* `asset_type_id`
* `category` (your classification, e.g. Accessories)
* `subcategory`
* `creator_type`
* `creator_id`
* `creator_name`
* `price_robux`
* `is_for_sale`
* `is_limited`
* `is_limited_unique`
* `remaining` (nullable)
* `updated_at` (your timestamp)
* `first_seen_at`

**Table: `roblox_asset_images`**

* `asset_id` (FK)
* `size` (e.g. 420x420)
* `format` (Png/Webp)
* `image_url`
* `state`
* `last_checked_at`

**Table: `roblox_discovery_runs`**

* `run_id` (PK)
* `started_at`, `finished_at`
* `strategy` (e.g. subcategory+sort+keyword)

**Table: `roblox_discovery_hits`**

* `run_id` (FK)
* `asset_id`
* `query_hash`
* `category`, `subcategory`, `sortType`, `keyword`
* `cursor_page_index`
* `seen_at`

**Table: `roblox_refresh_queue`**

* `asset_id`
* `priority` (price-changed, new, error-retry)
* `next_run_at`
* `attempts`
* `last_error`

---

## 4) Strategies to get “as many items as possible”

There is no “download all items” API. To maximize coverage, combine multiple crawling tactics.

### 4.1 Crawl all accessory subcategories

At minimum, enumerate these (Roblox naming may evolve):

* Hats
* HairAccessories
* FaceAccessories
* NeckAccessories
* ShoulderAccessories
* BackAccessories
* WaistAccessories

Run each subcategory with:

* multiple sort orders (e.g., `RecentlyUpdated`, `Relevance`, `PriceAsc`, `PriceDesc`)
* full pagination via `cursor`

**Why:** sorting changes what you see early; deeper pages may be truncated/limited by the platform, so multiple sorts can surface different sets.

### 4.2 Partition by keyword (critical)

Catalog search often behaves like a search index. To expand recall:

* Use keyword partitions: `a`, `b`, `c`, … `z`, `0`…`9`
* Then extend with common bigrams: `aa`, `ab`, … for high-volume categories
* Use Roblox-specific terms: `hood`, `anime`, `pink`, `black`, `mask`, `cap`, `hair`, `cute`, `headphones`, `horns`, etc.

**Guideline:**

* Start with single-character partitions (36 queries per subcategory per sort).
* Measure unique yield; for partitions that still return huge result sets, split further (e.g., `a` → `aa`..`az`).

### 4.3 Partition by creator (optional but powerful)

If you have access to lists of top UGC creators/groups:

* query by `creatorName` (or creatorId if supported)
* crawl per creator to discover items that keyword partitions miss.

### 4.4 Time-based incremental crawl

To keep up:

* Run `sortType=RecentlyUpdated` daily/weekly per subcategory.
* Persist last-seen timestamps and recrawl only recent pages.

### 4.5 Dedupe + backfill loops

* Maintain a global set of `asset_id` already known.
* Discovery writes only new IDs; enrichment queue processes those IDs.
* If enrichment fails, retry with backoff.

---

## 5) Pagination rules (Catalog)

### 5.1 Cursor-driven pagination

* The response provides `nextPageCursor`.
* Continue requesting with `cursor=<nextPageCursor>` until it becomes `null`.

### 5.2 Defensive stop conditions

To avoid infinite loops or repeated cursors:

* Track cursors seen per query.
* Stop if cursor repeats or if data[] becomes empty.

### 5.3 Persist query identity

Define a **query signature**:

* `category + subcategory + sortType + keyword + limit`

Hash it as `query_hash` and store it with every discovery hit.

---

## 6) Rate limiting, reliability, and hygiene

### 6.1 Practical throttling

Roblox endpoints are rate-limited. Implement:

* request concurrency caps (e.g. 2–10 workers depending on endpoint)
* exponential backoff on 429/5xx
* per-host rate buckets (catalog vs economy vs thumbnails)

### 6.2 Caching policy

* Discovery results: store indefinitely (IDs don’t change)
* Economy fields: refresh periodically (price/sale status changes)
* Thumbnails: refresh rarely; if `state=Pending`, recheck later

Suggested refresh:

* New items: refresh economy after 1h, 24h, then weekly
* Existing items: weekly/monthly depending on use-case

### 6.3 Error handling

* 404 / deleted items: mark as `is_deleted=true` and stop re-trying
* 429: backoff and reduce concurrency
* 5xx: retry with capped attempts

### 6.4 Respect platform constraints

* Avoid aggressive scraping patterns.
* Add jitter and randomize crawl order.
* Cache responses.

---

## 7) Implementation blueprint (AI instructions)

### 7.1 Discovery worker pseudoflow

1. Generate a list of discovery jobs:

   * for each `subcategory`
   * for each `sortType`
   * for each `keywordPartition` (optional tiers)
2. For each job:

   * call catalog search with `cursor=null`
   * collect asset IDs
   * upsert into `roblox_assets` (minimal record: id + first_seen)
   * enqueue for enrichment if new
   * continue while `nextPageCursor != null`

### 7.2 Enrichment worker pseudoflow

For batches of new asset IDs:

* call economy bulk endpoint for basic fields
* for items that need deep fields (desc, limited info), call economy details endpoint
* call thumbnails endpoint in batches
* upsert results

### 7.3 Data normalization

* Normalize creator fields: creator type (User/Group)
* Normalize booleans and nullables
* Store raw JSON (optional) for debugging and future field upgrades

---

## 8) Common pitfalls

* **Assuming one search query returns everything.** It won’t.
* **Not partitioning keywords.** This drastically limits recall.
* **Not persisting cursors and query identity.** Leads to repeated pages and missing coverage.
* **Over-fetching detail endpoint** for every asset ID (slow). Use bulk economy when possible.
* **Not deduping globally** across all discovery sources.

---

## 9) Recommended minimum viable crawl plan

If you want the best coverage quickly:

1. Subcategories × `sortType=RecentlyUpdated`, paginate fully.
2. Subcategories × keyword partitions (`a-z0-9`) × `sortType=Relevance`.
3. For high-yield partitions (e.g., `a`, `s`, `c`), split into `aa-az`, `sa-sz`, etc.
4. Run incremental `RecentlyUpdated` daily.

---

## 10) Verification metrics

Track:

* Unique asset IDs discovered per day
* Discovery yield per partition (helps split further)
* Enrichment success rate
* Average requests per new item
* % items with imageUrl completed

---

## 11) Security/auth notes

* Most discovery + economy + thumbnails endpoints are public.
* User ownership/inventory endpoints require authentication (cookie + CSRF) and may be restricted.
* Do not store sensitive auth cookies in client code; keep on server.

---

## 12) What to tell the AI model to do (summary)

When implementing item ingestion, the AI should:

* Use `catalog.roblox.com/v1/search/items` to discover IDs.
* Crawl all accessory subcategories.
* Use keyword partitions (`a-z0-9`) and refine into 2-letter partitions for large result sets.
* Use multiple `sortType` values to increase coverage.
* Paginate via `nextPageCursor` until null with loop safety.
* Dedupe globally and persist discovery evidence.
* Enrich via `economy.roblox.com` (bulk first, detail second) and `thumbnails.roblox.com`.
* Implement backoff, retries, and caching.

---

## Appendix A — Example request shapes

### A1) Catalog search example

* `GET https://catalog.roblox.com/v1/search/items?category=Accessories&subcategory=Hats&keyword=a&limit=30`

### A2) Economy details example

* `GET https://economy.roblox.com/v2/assets/1029025/details`

### A3) Thumbnails example

* `GET https://thumbnails.roblox.com/v1/assets?assetIds=1029025&size=420x420&format=Png`

---

## Appendix B — Operational checklist

* [ ] Enumerate subcategories
* [ ] Define partition list (`a-z0-9`, then split heavy partitions)
* [ ] Implement cursor pagination
* [ ] Implement global dedupe
* [ ] Implement enrichment batching
* [ ] Add retry + backoff
* [ ] Add refresh schedules
* [ ] Add metrics

---

*End of document.*
