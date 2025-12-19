Below is a simple, **buildable** plan for a “Roblox ID Extractor” web app that:

* lets users paste **any Roblox link** (game/experience, user, group/community, catalog item, bundle, etc.)
* **detects what it is**
* **extracts the correct ID(s)**
* fetches **clear details** via the **current documented endpoints**
* shows an **“Open on Roblox”** link

I’m going to base this on Roblox’s **current “revamped Open Cloud reference” + the official OpenAPI (swagger) specs for the relevant “legacy” web APIs**, because those specs show what’s deprecated and what request/response formats look like (and Roblox *has* changed formats recently).

---

## 1) Architecture that works reliably (avoid CORS + keep keys safe)

### Recommended architecture

**Frontend (browser UI)** → calls → **Your backend “resolver API”** → calls → **Roblox APIs** → returns JSON → frontend renders cards.

Why backend?

* Many Roblox endpoints are not guaranteed to allow cross-origin browser calls (CORS), and even when they do today, that can change.
* Your backend lets you add **rate limiting, caching, domain allowlisting,** and consistent error handling.

**Good starter stacks**

* **Node.js + Express** (simple)
* **Next.js** (API route + frontend in one)
* **Cloudflare Workers / Vercel Serverless** (fast deploy)

---

## 2) What your app must do (core flow)

### Core flow

1. User pastes a link (or even just a number).
2. You **normalize** it:

   * trim whitespace
   * ensure it’s a URL (add `https://` if missing)
   * optionally follow Roblox “share” redirects (server-side)
3. You **detect the resource type** by matching the URL path.
4. You **extract the ID** from the path.
5. You call the correct Roblox API endpoint(s).
6. You return a single normalized response object to the frontend:

   * `type`
   * `ids` (placeId/universeId/userId/etc)
   * `details` (name/description/creator/stats)
   * `openUrl` (canonical Roblox page)
   * optional thumbnails

---

## 3) URL patterns to support (practical “whatever” list)

Here are the most common Roblox URL patterns you should support first:

### Users

* `https://www.roblox.com/users/<userId>/profile`

### Groups / Communities

Roblox has been moving groups to “communities”, so users may paste either:

* `https://www.roblox.com/groups/<groupId>/...`
* `https://www.roblox.com/communities/<groupId>/...`

### Experiences (“games” pages)

* `https://www.roblox.com/games/<placeId>/...`

**Important:** the URL contains a **placeId**, but most APIs want a **universeId**.

### Catalog items / marketplace

* `https://www.roblox.com/catalog/<assetId>/...`
* `https://www.roblox.com/library/<assetId>/...` (older but still seen)
* `https://www.roblox.com/bundles/<bundleId>/...`

Optional add-ons (easy later):

* Badges: `https://www.roblox.com/badges/<badgeId>/...`
* Game passes: `https://www.roblox.com/game-pass/<gamePassId>/...`

---

## 4) The “latest API” mapping (what to call for each type)

### A) User details (by userId)

**Endpoint (documented):**

```txt
GET https://users.roblox.com/v1/users/{userId}
```

This returns user info like name/displayName/description/created/isBanned.

**Open on Roblox:**

```txt
https://www.roblox.com/users/{userId}/profile
```

---

### B) Group / Community details (by groupId)

Use the Groups API:

```txt
GET https://groups.roblox.com/v1/groups/{groupId}
```

This is the canonical “group/community” data source.

**Open on Roblox (pick one canonical style)**

```txt
https://www.roblox.com/communities/{groupId}
```

(You can also output `/groups/{groupId}` as an alternate; your UI can show both.)

---

### C) Experience (game page URL gives you placeId → you must get universeId)

**Step 1: placeId → universeId**

Roblox’s currently used mapping endpoint:

```txt
GET https://apis.roblox.com/universes/v1/places/{placeId}/universe
```

This is widely referenced as the correct modern endpoint for place→universe mapping.

**Step 2: get game (universe) details**

```txt
GET https://games.roblox.com/v1/games?universeIds={universeId}
```

The Games API v1 spec documents this and notes you can request up to 50 universe IDs.

**Open on Roblox**
Use the original placeId:

```txt
https://www.roblox.com/games/{placeId}
```

**Note on “recent updates / deprecations”**
In the same Games API spec, some endpoints are marked **deprecated** (example: listing game passes via Games API). For example:

* `GET /v1/games/{universeId}/game-passes` is **deprecated**
* replacement: `apis.roblox.com/game-passes/v1/universes/{universeId}/game-passes`

Even if you don’t need game passes on day 1, this is exactly why you should follow the OpenAPI specs and watch deprecations.

---

### D) Catalog item / bundle details (by assetId or bundleId)

#### Option 1 (recommended): Catalog “item details” endpoint

Roblox’s Catalog API documents a **multi-get** details endpoint:

```txt
POST https://catalog.roblox.com/v1/catalog/items/details
Content-Type: application/json
```

Request model (important “recent change”):

* Each request item includes:

  * `itemType` as an **integer enum**

    * `1 = Asset`
    * `2 = Bundle`
  * `id` as the assetId/bundleId

Example requests:

**Asset details**

```json
{
  "items": [
    { "itemType": 1, "id": 1818 }
  ]
}
```

**Bundle details**

```json
{
  "items": [
    { "itemType": 2, "id": 123456 }
  ]
}
```

The response model includes fields like item `name`, `description`, creator info, `price`, `favoriteCount`, etc.

This single endpoint is great for your extractor because it can power both `/catalog/<assetId>` and `/bundles/<bundleId>` consistently.

#### Option 2: Bundle-only details endpoint

Catalog API also documents:

```txt
GET https://catalog.roblox.com/v1/bundles/{bundleId}/details
```

(Useful fallback if you want a dedicated bundle fetch.)

**Open on Roblox**

```txt
https://www.roblox.com/catalog/{assetId}
https://www.roblox.com/bundles/{bundleId}
```

---

## 5) Data model your backend should return (simple + scalable)

Have your backend return a consistent schema regardless of type:

```ts
type ResolverResponse =
  | { ok: true; type: "user"; ids: { userId: number }; openUrl: string; details: any; thumbnails?: any }
  | { ok: true; type: "group"; ids: { groupId: number }; openUrl: string; details: any; thumbnails?: any }
  | { ok: true; type: "experience"; ids: { placeId: number; universeId: number }; openUrl: string; details: any; thumbnails?: any }
  | { ok: true; type: "asset"; ids: { assetId: number }; openUrl: string; details: any; thumbnails?: any }
  | { ok: true; type: "bundle"; ids: { bundleId: number }; openUrl: string; details: any; thumbnails?: any }
  | { ok: false; error: { code: string; message: string; hint?: string } };
```

This lets the frontend render “cards” without caring which endpoint you called.

---

## 6) Backend implementation (Node.js + Express example)

### A) URL parsing + type detection

```ts
function detectRobloxType(inputUrl: URL) {
  const host = inputUrl.hostname.toLowerCase();
  const path = inputUrl.pathname.split("/").filter(Boolean);

  // Accept roblox.com + subdomains you expect
  if (!host.endsWith("roblox.com")) return null;

  // users/<id>/profile
  if (path[0] === "users" && /^\d+$/.test(path[1] ?? "")) {
    return { type: "user" as const, id: Number(path[1]) };
  }

  // groups/<id>/... OR communities/<id>/...
  if ((path[0] === "groups" || path[0] === "communities") && /^\d+$/.test(path[1] ?? "")) {
    return { type: "group" as const, id: Number(path[1]) };
  }

  // games/<placeId>/...
  if (path[0] === "games" && /^\d+$/.test(path[1] ?? "")) {
    return { type: "experience" as const, id: Number(path[1]) }; // id = placeId
  }

  // catalog/<assetId>/...
  if ((path[0] === "catalog" || path[0] === "library") && /^\d+$/.test(path[1] ?? "")) {
    return { type: "asset" as const, id: Number(path[1]) };
  }

  // bundles/<bundleId>/...
  if (path[0] === "bundles" && /^\d+$/.test(path[1] ?? "")) {
    return { type: "bundle" as const, id: Number(path[1]) };
  }

  return null;
}
```

### B) A safe fetch helper (timeouts + error mapping)

```ts
async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "accept": "application/json",
        ...(init?.headers ?? {})
      }
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} from ${url}: ${text.slice(0, 200)}`);
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}
```

### C) Resolver functions (the “API map” in code)

```ts
async function resolveUser(userId: number) {
  const details = await fetchJson(`https://users.roblox.com/v1/users/${userId}`);
  return {
    ok: true as const,
    type: "user" as const,
    ids: { userId },
    openUrl: `https://www.roblox.com/users/${userId}/profile`,
    details
  };
}

async function resolveGroup(groupId: number) {
  const details = await fetchJson(`https://groups.roblox.com/v1/groups/${groupId}`);
  return {
    ok: true as const,
    type: "group" as const,
    ids: { groupId },
    openUrl: `https://www.roblox.com/communities/${groupId}`,
    details
  };
}

async function resolveExperience(placeId: number) {
  // place -> universe
  const uni = await fetchJson<{ universeId: number }>(
    `https://apis.roblox.com/universes/v1/places/${placeId}/universe`
  );

  // universe -> details
  const gameResp = await fetchJson<{ data: any[] }>(
    `https://games.roblox.com/v1/games?universeIds=${uni.universeId}`
  );

  return {
    ok: true as const,
    type: "experience" as const,
    ids: { placeId, universeId: uni.universeId },
    openUrl: `https://www.roblox.com/games/${placeId}`,
    details: gameResp.data?.[0] ?? null
  };
}

async function resolveCatalogItem(itemType: "asset" | "bundle", id: number) {
  // Catalog API expects itemType enum: Asset=1, Bundle=2
  const itemTypeEnum = itemType === "asset" ? 1 : 2;

  const body = JSON.stringify({
    items: [{ itemType: itemTypeEnum, id }]
  });

  const resp = await fetchJson<{ data: any[] }>(
    "https://catalog.roblox.com/v1/catalog/items/details",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body
    }
  );

  return {
    ok: true as const,
    type: itemType,
    ids: itemType === "asset" ? { assetId: id } : { bundleId: id },
    openUrl:
      itemType === "asset"
        ? `https://www.roblox.com/catalog/${id}`
        : `https://www.roblox.com/bundles/${id}`,
    details: resp.data?.[0] ?? null
  };
}
```

### D) The Express route

```ts
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/resolve", async (req, res) => {
  try {
    const q = String(req.query.q ?? "").trim();
    if (!q) return res.status(400).json({ ok: false, error: { code: "MISSING_Q", message: "Missing q" } });

    const normalized = q.startsWith("http") ? q : `https://${q}`;
    const url = new URL(normalized);

    const detected = detectRobloxType(url);
    if (!detected) {
      return res.status(400).json({
        ok: false,
        error: { code: "UNSUPPORTED", message: "Unsupported Roblox link format." }
      });
    }

    let out: any;
    if (detected.type === "user") out = await resolveUser(detected.id);
    else if (detected.type === "group") out = await resolveGroup(detected.id);
    else if (detected.type === "experience") out = await resolveExperience(detected.id);
    else if (detected.type === "asset") out = await resolveCatalogItem("asset", detected.id);
    else if (detected.type === "bundle") out = await resolveCatalogItem("bundle", detected.id);

    res.json(out);
  } catch (e: any) {
    res.status(500).json({ ok: false, error: { code: "INTERNAL", message: e?.message ?? "Unknown error" } });
  }
});

app.listen(3000);
```

---

## 7) Frontend UI (simple but “clear details”)

### Suggested layout

* Input box (paste link)
* “Extract” button
* Result card:

  * Big label: **Detected: User / Experience / Community / Asset / Bundle**
  * IDs (placeId + universeId when relevant)
  * Name + description
  * Creator name/id (when available)
  * Any stats returned (visits/playing/favorites/price/etc)
  * **Open on Roblox** button (uses `openUrl`)

Keep it “card-based” so any new type is just a new card renderer.

---

## 8) Production concerns (don’t skip these)

### A) Rate limiting + caching

* Add per-IP rate limiting on `/api/resolve` (e.g., 30 req/min/IP).
* Add caching:

  * Users/groups/items: TTL 5–30 minutes
  * Experience live stats (like “playing”): TTL 30–120 seconds

### B) SSRF protection (important!)

Because users paste URLs, never “fetch whatever they give you”.

* Only accept hostnames ending in `roblox.com`.
* Don’t follow redirects to non-Roblox hosts.
* Don’t allow arbitrary request forwarding.

### C) Handle Roblox floodchecks

Roblox can return **429** flood limit responses (you’ll see “flood limit exceeded” in some APIs). The Catalog spec explicitly mentions flood limits.
Implement:

* exponential backoff retries (small: 1–2 retries max)
* caching to reduce repeated calls

---

## 9) Staying “latest” when Roblox changes APIs again

Roblox has been consolidating and modernizing documentation and endpoints; they now provide a revamped Open Cloud reference and OpenAPI specs you can track.

To keep your extractor from breaking:

1. **Generate clients from OpenAPI** (TypeScript: `openapi-typescript`, etc.)
2. Add a small test suite that runs daily:

   * known userId/groupId/placeId/assetId/bundleId
   * verify shape + required fields
3. Watch for “deprecated” flags in the specs (Games API already shows deprecated endpoints and replacements).

---

## If you want, I can also give you

* a ready-to-run **Next.js** version (frontend + `/api/resolve`)
* a cleaner “plugin” structure so adding new types (badges, game passes, etc.) is just dropping a new resolver file
* a UI mock (exact fields to show per type)

Tell me what stack you want (plain HTML, React, Next.js, or Express-only), and I’ll tailor the implementation layout to that.
