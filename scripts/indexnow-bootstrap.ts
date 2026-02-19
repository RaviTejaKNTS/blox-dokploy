import "dotenv/config";

const DEFAULT_SITE_URL = "https://bloxodes.com";
const DEFAULT_INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
const DEFAULT_INDEXNOW_KEY = "3f48868cb2e04bfe8b1fb18849d4519f";

type BootstrapConfig = {
  siteOrigin: string;
  host: string;
  sitemapUrl: string;
  indexNowEndpoint: string;
  indexNowKey: string;
  indexNowKeyLocation: string;
  batchSize: number;
  maxSitemaps: number;
  requestDelayMs: number;
  dryRun: boolean;
};

type SubmitStats = {
  attempted: number;
  submitted: number;
  successfulBatches: number;
  failedBatches: number;
};

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
}

function clampNumber(value: string | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeOrigin(raw: string): string {
  const parsed = new URL(raw);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Invalid site URL protocol: ${parsed.protocol}`);
  }
  return `${parsed.protocol}//${parsed.host}`;
}

function normalizeAbsoluteUrl(raw: string, base: string): string {
  const parsed = new URL(raw, base);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Unsupported URL protocol in sitemap: ${parsed.protocol}`);
  }
  parsed.hash = "";
  return parsed.toString();
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

function extractLocValues(xml: string): string[] {
  const values: string[] = [];
  const regex = /<loc>\s*([\s\S]*?)\s*<\/loc>/gi;
  for (const match of xml.matchAll(regex)) {
    const value = decodeXmlEntities(match[1] ?? "");
    if (value) values.push(value);
  }
  return values;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function resolveConfig(): BootstrapConfig {
  const siteOrigin = normalizeOrigin(
    process.env.SITE_URL?.trim() ||
      process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
      DEFAULT_SITE_URL
  );
  const host = new URL(siteOrigin).host;

  const sitemapUrl = normalizeAbsoluteUrl(
    process.env.INDEXNOW_BOOTSTRAP_SITEMAP_URL?.trim() || `${siteOrigin}/sitemap.xml`,
    siteOrigin
  );

  const indexNowEndpoint = normalizeAbsoluteUrl(
    process.env.INDEXNOW_ENDPOINT?.trim() || DEFAULT_INDEXNOW_ENDPOINT,
    siteOrigin
  );

  const indexNowKey = (process.env.INDEXNOW_KEY?.trim() || DEFAULT_INDEXNOW_KEY).trim();
  if (!indexNowKey) {
    throw new Error("INDEXNOW_KEY is empty.");
  }

  const indexNowKeyLocation = normalizeAbsoluteUrl(
    process.env.INDEXNOW_KEY_LOCATION?.trim() || `${siteOrigin}/${indexNowKey}.txt`,
    siteOrigin
  );

  const keyHost = new URL(indexNowKeyLocation).host;
  if (keyHost !== host) {
    throw new Error("INDEXNOW_KEY_LOCATION must use the same host as SITE_URL.");
  }

  return {
    siteOrigin,
    host,
    sitemapUrl,
    indexNowEndpoint,
    indexNowKey,
    indexNowKeyLocation,
    batchSize: clampNumber(process.env.INDEXNOW_BATCH_SIZE, 1000, 1, 10_000),
    maxSitemaps: clampNumber(process.env.INDEXNOW_MAX_SITEMAPS, 200, 1, 10_000),
    requestDelayMs: clampNumber(process.env.INDEXNOW_REQUEST_DELAY_MS, 0, 0, 60_000),
    dryRun: parseBoolean(process.env.INDEXNOW_DRY_RUN, false)
  };
}

async function fetchXml(url: string): Promise<string> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      accept: "application/xml,text/xml,*/*"
    }
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to fetch sitemap ${url}: ${res.status} ${res.statusText} ${body.slice(0, 200)}`);
  }

  return res.text();
}

async function collectUrlsFromSitemaps(config: BootstrapConfig): Promise<{ urls: string[]; sitemapCount: number }> {
  const queue: string[] = [config.sitemapUrl];
  const seenSitemaps = new Set<string>();
  const pageUrls = new Set<string>();

  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;

    const currentUrl = normalizeAbsoluteUrl(current, config.siteOrigin);
    if (seenSitemaps.has(currentUrl)) continue;
    if (seenSitemaps.size >= config.maxSitemaps) {
      throw new Error(`Sitemap crawl exceeded INDEXNOW_MAX_SITEMAPS=${config.maxSitemaps}.`);
    }
    seenSitemaps.add(currentUrl);

    console.log(`Sitemap ${seenSitemaps.size}: ${currentUrl}`);
    const xml = await fetchXml(currentUrl);
    const locValues = extractLocValues(xml);
    if (!locValues.length) continue;

    const isSitemapIndex = /<\s*sitemapindex\b/i.test(xml);
    const isUrlSet = /<\s*urlset\b/i.test(xml);

    if (isSitemapIndex) {
      for (const loc of locValues) {
        let nested: string;
        try {
          nested = normalizeAbsoluteUrl(loc, currentUrl);
        } catch {
          continue;
        }
        if (new URL(nested).host !== config.host) {
          console.warn(`Skipping cross-host sitemap: ${nested}`);
          continue;
        }
        if (!seenSitemaps.has(nested)) {
          queue.push(nested);
        }
      }
      continue;
    }

    if (isUrlSet) {
      for (const loc of locValues) {
        let pageUrl: string;
        try {
          pageUrl = normalizeAbsoluteUrl(loc, currentUrl);
        } catch {
          continue;
        }
        if (new URL(pageUrl).host !== config.host) {
          console.warn(`Skipping cross-host page URL: ${pageUrl}`);
          continue;
        }
        pageUrls.add(pageUrl);
      }
      continue;
    }

    console.warn(`Unknown sitemap format at ${currentUrl}; skipping.`);
  }

  return { urls: Array.from(pageUrls), sitemapCount: seenSitemaps.size };
}

async function submitToIndexNow(config: BootstrapConfig, urls: string[]): Promise<SubmitStats> {
  const batches = chunkArray(urls, config.batchSize);
  const stats: SubmitStats = {
    attempted: urls.length,
    submitted: 0,
    successfulBatches: 0,
    failedBatches: 0
  };

  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];
    if (!batch || !batch.length) continue;

    const label = `[Batch ${index + 1}/${batches.length}]`;
    if (config.dryRun) {
      console.log(`${label} DRY RUN: would submit ${batch.length} URLs.`);
      continue;
    }

    const res = await fetch(config.indexNowEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify({
        host: config.host,
        key: config.indexNowKey,
        keyLocation: config.indexNowKeyLocation,
        urlList: batch
      })
    });

    if (!res.ok) {
      stats.failedBatches += 1;
      const body = await res.text().catch(() => "");
      console.warn(`${label} failed: ${res.status} ${res.statusText} ${body.slice(0, 200)}`);
    } else {
      stats.successfulBatches += 1;
      stats.submitted += batch.length;
      console.log(`${label} submitted ${batch.length} URLs.`);
    }

    await sleep(config.requestDelayMs);
  }

  return stats;
}

async function main() {
  const config = resolveConfig();

  console.log("IndexNow bootstrap starting...");
  console.log(`Site origin: ${config.siteOrigin}`);
  console.log(`Sitemap root: ${config.sitemapUrl}`);
  console.log(`Endpoint: ${config.indexNowEndpoint}`);
  console.log(`Batch size: ${config.batchSize}`);
  console.log(`Dry run: ${config.dryRun ? "yes" : "no"}`);

  const { urls, sitemapCount } = await collectUrlsFromSitemaps(config);
  const uniqueUrls = Array.from(new Set(urls)).sort();

  if (!uniqueUrls.length) {
    console.warn("No page URLs discovered from sitemaps. Nothing to submit.");
    return;
  }

  console.log(`Discovered ${uniqueUrls.length} URLs from ${sitemapCount} sitemap files.`);
  const stats = await submitToIndexNow(config, uniqueUrls);

  if (config.dryRun) {
    console.log(`Dry run complete. ${stats.attempted} URLs were prepared for submission.`);
    return;
  }

  console.log(
    `IndexNow bootstrap complete. Attempted=${stats.attempted}, submitted=${stats.submitted}, success_batches=${stats.successfulBatches}, failed_batches=${stats.failedBatches}`
  );

  if (stats.successfulBatches === 0) {
    throw new Error("All IndexNow batch submissions failed.");
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`IndexNow bootstrap failed: ${message}`);
  process.exitCode = 1;
});

