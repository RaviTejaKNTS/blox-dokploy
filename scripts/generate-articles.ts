import "dotenv/config";

import { Readability } from "@mozilla/readability";
import OpenAI from "openai";
import { JSDOM } from "jsdom";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { createHash } from "node:crypto";

import { slugify } from "@/lib/slug";

type QueueRow = {
  id: string;
  article_title: string | null;
  sources: string | null;
  universe_id: number | null;
  status: "pending" | "completed" | "failed";
  attempts: number;
  last_attempted_at: string | null;
  last_error: string | null;
};

type SearchResult = {
  title: string;
  url: string;
  snippet?: string;
};

type SourceImage = {
  name: string;
  originalUrl: string;
  altText: string | null;
  caption: string | null;
  context: string | null;
  isTable: boolean;
  width: number | null;
  height: number | null;
  rowText?: string | null;
};

type SourceDocument = {
  title: string;
  url: string;
  content: string;
  host: string;
  isForum: boolean;
  images: SourceImage[];
  verification?: "Yes" | "No";
  fromQueue?: boolean;
};

type DraftArticle = {
  title: string;
  content_md: string;
  meta_description: string;
};

type RelatedPage = {
  type: "article" | "codes" | "checklist" | "tool";
  title: string;
  url: string;
  description?: string | null;
  updatedAt?: string | null;
};

type ImagePlacement = {
  name: string;
  publicUrl: string;
  tableKey: string | null;
  context: string | null;
  uploadedPath?: string;
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const AUTHOR_ID = process.env.ARTICLE_AUTHOR_ID ?? "4fc99a58-83da-46f6-9621-7816e36b4088";
const SUPABASE_MEDIA_BUCKET = process.env.SUPABASE_MEDIA_BUCKET;
const SITE_URL = (process.env.SITE_URL ?? "https://bloxodes.com").replace(/\/$/, "");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE.");
}

if (!PERPLEXITY_API_KEY) {
  throw new Error("Missing PERPLEXITY_API_KEY.");
}

if (!OPENAI_KEY) {
  throw new Error("Missing OPENAI_API_KEY.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
const perplexity = new OpenAI({ apiKey: PERPLEXITY_API_KEY, baseURL: "https://api.perplexity.ai" });
const openai = new OpenAI({ apiKey: OPENAI_KEY });

const SOURCE_CHAR_LIMIT = 6500;
const MAX_RESULTS_PER_QUERY = 15;
const MAX_SOURCES = 6; // 3-5 primary, 1-2 fandom
const MIN_SOURCES = 1;
const MAX_FORUM_SOURCES = 2;
const MAX_PER_HOST_DEFAULT = 2;
const MAX_PER_HOST_HIGH_QUALITY = 3;
const BLOCKED_HOSTS_PRIMARY = ["fandom.com", "roblox.fandom.com"];

const QUALITY_DOMAINS = [
  "roblox.com",
  "fandom.com",
  "fandomwiki.com",
  "pcgamesn.com",
  "pockettactics.com",
  "polygon.com",
  "ign.com",
  "gamespot.com",
  "thegamer.com",
  "screenrant.com",
  "dexerto.com",
  "beebom.com",
  "destructoid.com",
  "progameguides.com",
  "game8.co",
  "sportskeeda.com",
  "rockpapershotgun.com",
  "pcgamer.com",
  "digitaltrends.com",
  "gamingonphone.com"
];

let cachedAuthorIds: string[] | null = null;

async function pickAuthorId(): Promise<string | null> {
  if (!cachedAuthorIds) {
    const { data, error } = await supabase.from("authors").select("id");
    if (error) {
      console.warn("⚠️ Unable to load authors:", error.message);
      cachedAuthorIds = [];
    } else {
      cachedAuthorIds = (data ?? [])
        .map((author) => author.id)
        .filter((id): id is string => typeof id === "string" && id.length > 0);
    }
  }

  if (!cachedAuthorIds || cachedAuthorIds.length === 0) {
    console.warn("⚠️ No authors available; falling back to default author.");
    return null;
  }

  const index = Math.floor(Math.random() * cachedAuthorIds.length);
  return cachedAuthorIds[index] ?? null;
}

function isHighQualityHost(hostname: string): boolean {
  const base = hostname.replace(/^www\./i, "").toLowerCase();
  return QUALITY_DOMAINS.some((domain) => base === domain || base.endsWith(`.${domain}`));
}

function isForumHost(hostname: string): boolean {
  const base = hostname.replace(/^www\./i, "").toLowerCase();
  return (
    base.includes("reddit.com") ||
    base.includes("devforum.roblox.com") ||
    base.includes("forum") ||
    base.includes("stackexchange") ||
    base.includes("quora.com")
  );
}

function isVideoHost(hostname: string): boolean {
  const base = hostname.replace(/^www\./i, "").toLowerCase();
  return base.includes("youtube.com") || base.includes("youtu.be") || base.includes("vimeo.com") || base.includes("dailymotion.com");
}

function isFandomHost(hostname: string): boolean {
  const base = hostname.replace(/^www\./i, "").toLowerCase();
  return base === "fandom.com" || base.endsWith(".fandom.com") || base.endsWith(".fandomwiki.com");
}

function cleanText(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length ? normalized : null;
}

function hashForPath(value: string): string {
  return createHash("md5").update(value).digest("hex").slice(0, 8);
}

function normalizeImageFileBase(name: string): string {
  const normalized = slugify(name);
  return normalized && normalized.length > 0 ? normalized : "image";
}

function escapeForSvg(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeOverlayTitle(value: string | null | undefined, limit = 70): string | null {
  if (!value) return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.length > limit ? `${cleaned.slice(0, limit - 1)}…` : cleaned;
}

function pickOverlayFontSize(lines: string[]): number {
  const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);
  let base: number;
  if (longest <= 10) base = 104;
  else if (longest <= 16) base = 94;
  else if (longest <= 22) base = 82;
  else if (longest <= 28) base = 70;
  else if (longest <= 34) base = 62;
  else base = 52;

  const linePenalty = Math.max(0, lines.length - 2) * 6;
  return Math.max(44, base - linePenalty);
}

function wrapOverlayLines(text: string): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const words = cleaned.split(" ");
  const length = cleaned.length;
  let maxLine = 16;
  if (length > 80) maxLine = 24;
  else if (length > 60) maxLine = 20;
  else if (length > 40) maxLine = 18;

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (!current.length) {
      current = word;
      continue;
    }

    const next = `${current} ${word}`;
    if (next.length <= maxLine) {
      current = next;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current.length) {
    lines.push(current);
  }

  return lines;
}

function replaceEmDashes(value: string): string {
  return value.replace(/—\s*/g, ": ");
}

function removeEmDashesFromDraft(article: DraftArticle): DraftArticle {
  return {
    ...article,
    title: replaceEmDashes(article.title),
    meta_description: replaceEmDashes(article.meta_description),
    content_md: replaceEmDashes(article.content_md)
  };
}

function truncateForPrompt(value: string | null | undefined, limit = 240): string | null {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  if (normalized.length > limit) return `${normalized.slice(0, limit)}…`;
  return normalized;
}

function estimateWordCount(markdown: string): number {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/[#>*_\-\[\]\(\)]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return 0;
  return text.split(" ").length;
}

async function ensureUniqueSlug(baseTitle: string): Promise<string> {
  const base = slugify(baseTitle);
  let slug = base || slugify(Date.now().toString());
  let counter = 2;

  while (true) {
    const { data, error } = await supabase.from("articles").select("id").eq("slug", slug).maybeSingle();
    if (error) throw new Error(`Slug check failed: ${error.message}`);
    if (!data) return slug;
    slug = `${base}-${counter}`;
    counter += 1;
  }
}

function parseQueueSources(raw: string | null): string[] {
  if (!raw) return [];
  const urls = raw
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => /^https?:\/\//i.test(entry));

  return Array.from(new Set(urls));
}

function ensureRobloxKeyword(query: string): string {
  const normalized = query.toLowerCase();
  return normalized.includes("roblox") ? query : `${query} Roblox`;
}

type RobloxUniverseMedia = {
  thumbnail_urls?: unknown;
  icon_url?: string | null;
  name?: string | null;
  display_name?: string | null;
};

function normalizeThumbnailUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry) return null;
      if (typeof entry === "string") return entry;
      if (typeof entry === "object" && "url" in entry) {
        const url = (entry as { url?: unknown }).url;
        return typeof url === "string" ? url : null;
      }
      return null;
    })
    .filter((url): url is string => typeof url === "string" && url.trim().length > 0);
}

function pickFromSrcset(value: string | null): string | null {
  if (!value) return null;
  const candidates = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  let best: { url: string; width: number } | null = null;
  for (const candidate of candidates) {
    const [maybeUrl, size] = candidate.split(/\s+/);
    const width = size?.endsWith("w") ? Number.parseInt(size.replace(/[^\d]/g, ""), 10) : Number.NaN;
    const normalizedUrl = maybeUrl?.trim();
    if (!normalizedUrl) continue;
    const isFiniteWidth: boolean = Number.isFinite(width);
    if (!best || (isFiniteWidth && width > best.width)) {
      const fallbackWidth: number = best ? best.width : 0;
      best = { url: normalizedUrl, width: isFiniteWidth ? width : fallbackWidth };
    }
  }

  if (best?.url) return best.url;
  const firstUrl = candidates[0]?.split(/\s+/)[0];
  return firstUrl ?? null;
}

function resolveAbsoluteUrl(url: string | null, base: string): string | null {
  if (!url) return null;
  try {
    return new URL(url, base).toString();
  } catch {
    return null;
  }
}

function deriveImageNameForRecord(alt: string | null, caption: string | null, imageUrl: string): string {
  const fromAlt = cleanText(alt);
  const fromCaption = cleanText(caption);

  if (fromAlt) return fromAlt.slice(0, 200);
  if (fromCaption) return fromCaption.slice(0, 200);

  try {
    const parsed = new URL(imageUrl);
    const last = parsed.pathname.split("/").filter(Boolean).pop() ?? "image";
    const withoutExt = last.replace(/\.[a-z0-9]+$/i, "");
    const decoded = decodeURIComponent(withoutExt);
    const cleaned = cleanText(decoded);
    if (cleaned) return cleaned.slice(0, 200);
  } catch {
    // ignore
  }

  return "image";
}

function parseBackgroundUrl(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(/url\((['"]?)(.*?)\1\)/i);
  if (match && match[2]) {
    return match[2].trim();
  }
  return null;
}

function isTableContext(el: Element | null): boolean {
  if (!el) return false;
  if (el.closest("table")) return true;
  const tableLikes = [".table", ".table-responsive", ".wp-block-table", ".wikitable", ".infobox", "[role='table']"];
  return tableLikes.some((selector) => Boolean(el.closest(selector)));
}

function resolveImageAttribute(el: Element, baseUrl: string): string | null {
  const attributeCandidates = [
    "data-srcset",
    "srcset",
    "data-src",
    "data-original",
    "data-image-src",
    "data-url",
    "data-lazy-src",
    "data-lazyload",
    "data-lazy",
    "data-llsrc",
    "data-ll-src",
    "data-img",
    "data-cfsrc",
    "src"
  ];

  for (const attr of attributeCandidates) {
    const raw = el.getAttribute(attr);
    if (!raw) continue;
    const fromSrcset = attr.includes("srcset") ? pickFromSrcset(raw) : raw;
    const absolute = resolveAbsoluteUrl(fromSrcset, baseUrl);
    if (absolute) return absolute;
  }

  return null;
}

function buildTableRowText(el: Element | null): string | null {
  if (!el) return null;
  const row = el.closest("tr");
  if (!row) return null;
  const cells = Array.from(row.querySelectorAll("th,td")).map((cell) => cleanText(cell.textContent ?? "")).filter(Boolean) as string[];
  if (!cells.length) return null;
  return cells.join(" | ");
}

function extractImagesFromDocument(
  document: Document,
  options: { sourceUrl: string; sourceHost: string; allowAllImages: boolean }
): SourceImage[] {
  const images: SourceImage[] = [];
  const seen = new Set<string>();

  const addImageFromElement = (el: Element, absoluteUrl: string, isTable: boolean) => {
    if (seen.has(absoluteUrl)) return;
    seen.add(absoluteUrl);

    const alt =
      cleanText(el.getAttribute("alt")) ??
      cleanText(el.getAttribute("aria-label")) ??
      cleanText(el.getAttribute("title"));

    const tableAncestor = el.closest("table");
    const caption = tableAncestor
      ? cleanText(tableAncestor.querySelector("caption")?.textContent ?? "")
      : cleanText(el.closest("figure")?.querySelector("figcaption")?.textContent ?? "");

    const name = deriveImageNameForRecord(alt, caption, absoluteUrl);

    let context: string | null = null;
    if (isTable) {
      const cell = el.closest("td,th");
      const row = el.closest("tr");
      const header = row ? cleanText(row.querySelector("th")?.textContent ?? "") : null;
      const dataLabel = cell ? cleanText(cell.getAttribute("data-label")) : null;
      const cellText = cell ? cleanText(cell.textContent ?? "") : null;
      const parts = [caption, dataLabel, header, cellText].filter(Boolean) as string[];
      context = parts.length ? parts.join(" | ").slice(0, 500) : null;
    } else if (options.allowAllImages) {
      context = caption;
    }

    const widthAttr = Number.parseInt((el as HTMLElement).getAttribute?.("width") ?? "", 10);
    const heightAttr = Number.parseInt((el as HTMLElement).getAttribute?.("height") ?? "", 10);
    const width = Number.isFinite(widthAttr) ? widthAttr : null;
    const height = Number.isFinite(heightAttr) ? heightAttr : null;
    const rowText = buildTableRowText(el);

    images.push({
      name,
      originalUrl: absoluteUrl,
      altText: alt,
      caption,
      context,
      isTable,
      width,
      height,
      rowText
    });
  };

  const shouldKeep = (el: Element, isTable: boolean) => isTable || options.allowAllImages;

  // Regular <img> tags
  const imgNodes = Array.from(document.querySelectorAll("img"));
  for (const node of imgNodes) {
    const img = node as HTMLImageElement;
    const isTable = isTableContext(img);
    if (!shouldKeep(img, isTable)) continue;

    const absoluteUrl = resolveImageAttribute(img, options.sourceUrl);
    if (!absoluteUrl) continue;

    const lowerUrl = absoluteUrl.toLowerCase();
    if (!lowerUrl.startsWith("http://") && !lowerUrl.startsWith("https://")) continue;
    if (lowerUrl.startsWith("data:") || lowerUrl.startsWith("blob:")) continue;
    if (lowerUrl.includes("sprite") || lowerUrl.includes("spacer") || lowerUrl.includes("blank.") || lowerUrl.includes("pixel")) continue;

    addImageFromElement(img, absoluteUrl, isTable);
  }

  // <source> tags (e.g., inside <picture>) so we don't miss table images without an <img> tag
  const sourceNodes = Array.from(document.querySelectorAll("source"));
  for (const srcNode of sourceNodes) {
    const isTable = isTableContext(srcNode);
    if (!shouldKeep(srcNode, isTable)) continue;

    const rawSrc = pickFromSrcset(srcNode.getAttribute("data-srcset") ?? srcNode.getAttribute("srcset"));
    const absoluteUrl = resolveAbsoluteUrl(rawSrc, options.sourceUrl);
    if (!absoluteUrl) continue;

    const lowerUrl = absoluteUrl.toLowerCase();
    if (!lowerUrl.startsWith("http://") && !lowerUrl.startsWith("https://")) continue;
    if (lowerUrl.startsWith("data:") || lowerUrl.startsWith("blob:")) continue;
    if (lowerUrl.includes("sprite") || lowerUrl.includes("spacer") || lowerUrl.includes("blank.") || lowerUrl.includes("pixel")) continue;

    addImageFromElement(srcNode, absoluteUrl, isTable);
  }

  // Background images inside tables (or anywhere if allowAllImages)
  const bgSelector = options.allowAllImages
    ? "[style*='background-image'],[data-bg],[data-background],[data-bg-src],[data-lazy-bg]"
    : "table [style*='background-image'],table [data-bg],table [data-background],table [data-bg-src],table [data-lazy-bg], .table [style*='background-image'], .wp-block-table [style*='background-image']";
  const bgNodes = Array.from(document.querySelectorAll(bgSelector));

  for (const node of bgNodes) {
    const el = node as HTMLElement;
    const isTable = isTableContext(el);
    if (!shouldKeep(el, isTable)) continue;

    const styleUrl = parseBackgroundUrl(el.getAttribute("style"));
    const dataUrl =
      el.getAttribute("data-bg") ||
      el.getAttribute("data-background") ||
      el.getAttribute("data-bg-src") ||
      el.getAttribute("data-lazy-bg");

    const absoluteUrl = resolveAbsoluteUrl(styleUrl ?? dataUrl, options.sourceUrl);
    if (!absoluteUrl) continue;

    const lowerUrl = absoluteUrl.toLowerCase();
    if (!lowerUrl.startsWith("http://") && !lowerUrl.startsWith("https://")) continue;
    if (lowerUrl.startsWith("data:") || lowerUrl.startsWith("blob:")) continue;
    if (lowerUrl.includes("sprite") || lowerUrl.includes("spacer") || lowerUrl.includes("blank.") || lowerUrl.includes("pixel")) continue;

    addImageFromElement(el, absoluteUrl, isTable);
  }

  // AMP images and lazy noscript fallbacks inside table contexts
  const ampNodes = Array.from(document.querySelectorAll("amp-img"));
  for (const amp of ampNodes) {
    const isTable = isTableContext(amp);
    if (!shouldKeep(amp, isTable)) continue;
    const absoluteUrl = resolveImageAttribute(amp, options.sourceUrl);
    if (!absoluteUrl) continue;
    addImageFromElement(amp, absoluteUrl, isTable);
  }

  const noscripts = Array.from(document.querySelectorAll("noscript"));
  for (const ns of noscripts) {
    if (!isTableContext(ns)) continue;
    const html = ns.innerHTML;
    if (!html || !html.includes("<img")) continue;
    try {
      const fragDom = new JSDOM(html, { url: options.sourceUrl });
      const fragImgs = Array.from(fragDom.window.document.querySelectorAll("img"));
      for (const img of fragImgs) {
        const absoluteUrl = resolveImageAttribute(img, options.sourceUrl);
        if (!absoluteUrl) continue;
        addImageFromElement(img, absoluteUrl, true);
      }
    } catch {
      // ignore parse errors
    }
  }

  return images;
}

async function pickUniverseThumbnail(universeId: number): Promise<{ url: string; gameName?: string } | null> {
  const { data, error } = await supabase
    .from("roblox_universes")
    .select("thumbnail_urls, icon_url, name, display_name")
    .eq("universe_id", universeId)
    .maybeSingle();

  if (error) {
    console.warn(`⚠️ Failed to load universe ${universeId} media:`, error.message);
    return null;
  }

  if (!data) return null;

  const media = data as RobloxUniverseMedia;
  const thumbs = normalizeThumbnailUrls(media.thumbnail_urls);
  const candidates = thumbs.length
    ? thumbs
    : media.icon_url && typeof media.icon_url === "string"
      ? [media.icon_url]
      : [];

  if (!candidates.length) return null;

  const selected = candidates[Math.floor(Math.random() * candidates.length)];
  const rawName = media.display_name ?? media.name ?? null;
  const gameName = rawName?.trim();
  return { url: selected, gameName: gameName && gameName.length ? gameName : undefined };
}

async function downloadResizeAndUploadCover(params: {
  imageUrl: string;
  slug: string;
  fileBase?: string;
  overlayTitle?: string | null;
}): Promise<string | null> {
  if (!SUPABASE_MEDIA_BUCKET) {
    console.log("⚠️ SUPABASE_MEDIA_BUCKET not configured. Skipping cover image upload.");
    return null;
  }

  try {
    const response = await fetch(params.imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8"
      }
    });

    if (!response.ok) {
      console.warn("⚠️ Failed to download universe thumbnail:", response.statusText);
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    const overlayText = normalizeOverlayTitle(params.overlayTitle ?? null);
    const overlayLines = overlayText ? wrapOverlayLines(overlayText) : [];
    const fontSize = overlayLines.length ? pickOverlayFontSize(overlayLines) : 0;
    const lineHeight = fontSize ? Math.round(fontSize * 1.2) : 0;
    const startY = fontSize ? Math.round(337.5 - ((overlayLines.length - 1) * lineHeight) / 2) : 0;

    const textBlock =
      overlayLines.length && fontSize
        ? `<text x="600" y="${startY}" text-anchor="middle" fill="#f8f9fb" font-size="${fontSize}" font-family="Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-weight="800" font-style="italic" letter-spacing="1.2" dominant-baseline="hanging">
            ${overlayLines
              .map((line, idx) => `<tspan x="600" dy="${idx === 0 ? 0 : lineHeight}">${escapeForSvg(line)}</tspan>`)
              .join("")}
          </text>`
        : "";

    const svgOverlay = Buffer.from(
      `<svg width="1200" height="675" xmlns="http://www.w3.org/2000/svg" role="presentation">
        <rect x="0" y="0" width="1200" height="675" fill="rgba(0,0,0,0.78)"/>
        ${textBlock}
      </svg>`.replace(/\s+/g, " ")
    );

    const resized = await sharp(buffer)
      .resize(1200, 675, { fit: "cover", position: "attention" })
      .composite([{ input: svgOverlay, blend: "over" }])
      .webp({ quality: 90, effort: 4 })
      .toBuffer();

    const fileBase =
      (params.fileBase ?? params.slug)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-{2,}/g, "-")
        .replace(/(^-|-$)/g, "") || params.slug;

    const path = `articles/${params.slug}/${fileBase}-cover.webp`;
    const storageClient = supabase.storage.from(SUPABASE_MEDIA_BUCKET);

    const { error } = await storageClient.upload(path, resized, {
      contentType: "image/webp",
      upsert: true
    });

    if (error) {
      console.warn("⚠️ Failed to upload article cover image:", error.message);
      return null;
    }

    const publicUrl = storageClient.getPublicUrl(path);
    return publicUrl.data.publicUrl ?? null;
  } catch (error) {
    console.warn("⚠️ Could not process cover image:", error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function uploadUniverseCoverImage(universeId: number, slug: string, overlayTitle?: string | null): Promise<string | null> {
  if (!SUPABASE_MEDIA_BUCKET) {
    console.log("⚠️ SUPABASE_MEDIA_BUCKET not configured. Skipping cover image upload.");
    return null;
  }

  const pick = await pickUniverseThumbnail(universeId);
  if (!pick) return null;
  return downloadResizeAndUploadCover({
    imageUrl: pick.url,
    slug,
    fileBase: pick.gameName ?? `universe-${universeId}`,
    overlayTitle: overlayTitle ?? pick.gameName ?? null
  });
}

async function getNextQueueItem(): Promise<QueueRow | null> {
  const { data, error } = await supabase
    .from("article_generation_queue")
    .select("id, article_title, sources, status, attempts, last_attempted_at, last_error, universe_id")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch queue: ${error.message}`);
  }

  if (!data) return null;

  const rawUniverseId = (data as { universe_id?: unknown }).universe_id;
  const universeId =
    typeof rawUniverseId === "number"
      ? rawUniverseId
      : rawUniverseId !== null && rawUniverseId !== undefined && !Number.isNaN(Number(rawUniverseId))
        ? Number(rawUniverseId)
        : null;

  return {
    ...data,
    attempts: data.attempts ?? 0,
    status: (data.status as QueueRow["status"]) ?? "pending",
    last_attempted_at: data.last_attempted_at ?? null,
    last_error: data.last_error ?? null,
    sources: (data as { sources?: string | null }).sources ?? null,
    universe_id: Number.isFinite(universeId) ? universeId : null
  };
}

async function markAttempt(queue: QueueRow): Promise<void> {
  const { error } = await supabase
    .from("article_generation_queue")
    .update({
      attempts: queue.attempts + 1,
      last_attempted_at: new Date().toISOString()
    })
    .eq("id", queue.id)
    .eq("status", "pending");

  if (error) {
    throw new Error(`Failed to record attempt: ${error.message}`);
  }
}

async function updateQueueStatus(
  queueId: string,
  status: "completed" | "failed",
  lastError?: string | null
): Promise<void> {
  const { error } = await supabase
    .from("article_generation_queue")
    .update({
      status,
      last_error: lastError ? lastError.slice(0, 500) : null,
      last_attempted_at: new Date().toISOString()
    })
    .eq("id", queueId);

  if (error) {
    throw new Error(`Failed to update queue status: ${error.message}`);
  }
}

async function perplexitySearch(query: string, limit: number): Promise<SearchResult[]> {
  const response = await fetch("https://api.perplexity.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PERPLEXITY_API_KEY}`
    },
    body: JSON.stringify({
      query,
      top_k: limit
    })
  });

  if (!response.ok) {
    throw new Error(`Perplexity search failed for "${query}" (${response.status} ${response.statusText})`);
  }

  const payload = (await response.json()) as { results?: { title?: string; url?: string; snippet?: string }[] };

  return (
    payload.results
      ?.map((item) => ({
        title: item.title ?? "",
        url: item.url ?? "",
        snippet: item.snippet
      }))
      .filter((entry) => entry.title && entry.url) ?? []
  );
}

type ParsedArticle = {
  content: string;
  title: string | null;
  html: string;
  images: SourceImage[];
  host: string;
};

async function fetchArticleContent(
  url: string,
  options: { allowAllImages?: boolean; allowImages?: boolean; sourceHost?: string } = {}
): Promise<ParsedArticle | null> {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    host = options.sourceHost ?? "";
  }

  const allowImages = options.allowImages ?? true;
  const allowAllImages = allowImages && (options.allowAllImages ?? false);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
      },
      redirect: "follow"
    });

    if (!response.ok) {
      console.warn(`   • Skipping ${url}: HTTP ${response.status}`);
      return null;
    }

    const html = await response.text();
    const dom = new JSDOM(html, { url });
    // Extract images before Readability mutates the DOM
    const images = allowImages
      ? extractImagesFromDocument(dom.window.document, {
          sourceUrl: url,
          sourceHost: host || options.sourceHost || "",
          allowAllImages
        })
      : [];
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article?.textContent) {
      console.warn(`   • Readability could not parse ${url}`);
      return null;
    }

    const normalized = article.textContent.replace(/\s+/g, " ").trim();
    if (normalized.length < 250) {
      console.warn(`   • Content short for ${url} (length=${normalized.length}), keeping anyway`);
    }

    const derivedTitle = article.title?.trim() || dom.window.document.title?.trim() || null;

    return {
      content: normalized.slice(0, SOURCE_CHAR_LIMIT),
      title: derivedTitle,
      html,
      images,
      host
    };
  } catch (error) {
    console.warn(`   • Failed to fetch ${url}:`, (error as Error).message);
    return null;
  }
}

async function collectFromResults(
  results: SearchResult[],
  collected: SourceDocument[],
  hostCounts: Map<string, number>,
  forumCount: { value: number },
  options: { blockFandom?: boolean; seenUrls: Set<string> }
): Promise<void> {
  for (const result of results) {
    if (collected.length >= MAX_SOURCES) break;
    if (!result.url || !result.title) continue;
    if (options.seenUrls.has(result.url)) continue;

    let parsed: URL;
    try {
      parsed = new URL(result.url);
    } catch {
      continue;
    }

    const host = parsed.hostname.toLowerCase();
    if (options?.blockFandom && BLOCKED_HOSTS_PRIMARY.some((blocked) => host === blocked || host.endsWith(`.${blocked}`))) {
      continue;
    }
    if (isVideoHost(host)) continue;

    const isForum = isForumHost(host);
    if (isForum && forumCount.value >= MAX_FORUM_SOURCES) continue;

    const isFandom = isFandomHost(host);
    const highQuality = isHighQualityHost(host);
    const hostLimit = highQuality ? MAX_PER_HOST_HIGH_QUALITY : MAX_PER_HOST_DEFAULT;
    const hostCount = hostCounts.get(host) ?? 0;
    if (hostCount >= hostLimit) continue;

    const parsedContent = await fetchArticleContent(result.url, {
      allowAllImages: false,
      allowImages: !isFandom,
      sourceHost: host
    });
    if (!parsedContent) continue;

    collected.push({
      title: result.title || parsedContent.title || result.url,
      url: result.url,
      content: parsedContent.content,
      host,
      isForum,
      images: parsedContent.images
    });

    options.seenUrls.add(result.url);
    hostCounts.set(host, hostCount + 1);
    if (isForum) forumCount.value += 1;
    console.log(`source_${collected.length}: ${host}${isForum ? " [forum]" : ""}`);
  }
}

async function sonarResearchNotes(topic: string): Promise<string> {
  const prompt = `
${topic} give me full details related to this — key facts, mechanics, requirements, steps, edge cases, and common questions. Keep it tight, bullet-style notes with no filler. Do not include URLs.
`.trim();

  const completion = await perplexity.chat.completions.create({
    model: "sonar",
    temperature: 0.25,
    max_tokens: 1000,
    messages: [
      { role: "system", content: "Return concise research notes. Do not include URLs." },
      { role: "user", content: prompt }
    ]
  });

  return completion.choices[0]?.message?.content?.trim() || "";
}

async function gatherSources(topic: string, queueSources?: string | null): Promise<SourceDocument[]> {
  const collected: SourceDocument[] = [];
  const hostCounts = new Map<string, number>();
  const forumCount = { value: 0 };
  const seenUrls = new Set<string>();

  const manualUrls = parseQueueSources(queueSources ?? null);
  for (const url of manualUrls) {
    if (collected.length >= MAX_SOURCES) break;
    if (seenUrls.has(url)) continue;

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      continue;
    }

    const host = parsed.hostname.toLowerCase();
    if (isVideoHost(host)) continue;

    const isForum = isForumHost(host);
    if (isForum && forumCount.value >= MAX_FORUM_SOURCES) continue;

    const isFandom = isFandomHost(host);
    const highQuality = isHighQualityHost(host);
    const hostLimit = highQuality ? MAX_PER_HOST_HIGH_QUALITY : MAX_PER_HOST_DEFAULT;
    const hostCount = hostCounts.get(host) ?? 0;
    if (hostCount >= hostLimit) continue;

    const parsedContent = await fetchArticleContent(url, {
      allowAllImages: false,
      allowImages: !isFandom,
      sourceHost: host
    });
    if (!parsedContent) continue;

    collected.push({
      title: parsedContent.title || url,
      url,
      content: parsedContent.content,
      host,
      isForum,
      images: parsedContent.images,
      fromQueue: true
    });

    seenUrls.add(url);
    hostCounts.set(host, hostCount + 1);
    if (isForum) forumCount.value += 1;
    console.log(`source_${collected.length}: ${host} [queue]${isForum ? " [forum]" : ""}`);
  }

  // 1) Primary search (take first 3-5 sources, non-fandom)
  const primaryQuery = ensureRobloxKeyword(`${topic}`);
  try {
    console.log(`🔎 search → ${primaryQuery}`);
    const results = await perplexitySearch(primaryQuery, MAX_RESULTS_PER_QUERY);
    await collectFromResults(results, collected, hostCounts, forumCount, { blockFandom: true, seenUrls });
    if (collected.length > 5) {
      collected.splice(5);
    }
  } catch (error) {
    console.warn(`   • search_failed query="${primaryQuery}" reason="${(error as Error).message}"`);
  }

  // 2) Fandom-specific search (1-2 sources)
  try {
    const fandomQuery = ensureRobloxKeyword(`${topic} fandom`);
    console.log(`🔎 search → ${fandomQuery}`);
    const fandomResults = await perplexitySearch(fandomQuery, 10);
    const fandomOnly = fandomResults.filter((res) => res.url?.toLowerCase().includes("fandom.com"));
    await collectFromResults(fandomOnly, collected, hostCounts, forumCount, { seenUrls });
    if (collected.length > 6) {
      collected.splice(6);
    }
  } catch (error) {
    console.warn(`   • fandom_search_failed reason="${(error as Error).message}"`);
  }

  // Sonar research notes (non-URL) to supplement
  try {
    const notes = await sonarResearchNotes(topic);
    if (notes) {
      collected.push({
        title: "Sonar Research Notes",
        url: "perplexity:sonar-notes",
        content: notes.slice(0, SOURCE_CHAR_LIMIT),
        host: "perplexity.ai",
        isForum: false,
        images: []
      });
      console.log(`source_${collected.length}: perplexity.ai [sonar notes]`);
    }
  } catch (error) {
    console.warn(`   • sonar_notes_failed reason="${(error as Error).message}"`);
  }

  if (collected.length < MIN_SOURCES) {
    throw new Error(`Not enough sources collected (${collected.length}/${MIN_SOURCES}).`);
  }

  return collected.slice(0, MAX_SOURCES);
}

async function verifySourceWithPerplexity(topic: string, source: SourceDocument): Promise<"Yes" | "No"> {
  const prompt = `
For the Roblox topic "${topic}", is the following source accurate and suitable to use? Minor mistakes or slightly outdated details are acceptable if the overall source is relevant and accurate. Respond with exactly "Yes" if the source is acceptable, or "No" if it should not be used. No other words.

Title: ${source.title}
URL: ${source.url}
Host: ${source.host}
Content:
${source.content}
`.trim();

  const completion = await perplexity.chat.completions.create({
    model: "sonar",
    temperature: 0,
    max_tokens: 10,
    messages: [
      {
        role: "system",
        content:
          'You judge whether a source is acceptable for the topic. Reply with exactly "Yes" to approve or "No" to reject. Minor outdated details are fine if the overall source is accurate and relevant.'
      },
      { role: "user", content: prompt }
    ]
  });

  const verdict = completion.choices[0]?.message?.content?.trim().toLowerCase();
  return verdict && verdict.startsWith("yes") ? "Yes" : "No";
}

async function verifySources(topic: string, sources: SourceDocument[]): Promise<SourceDocument[]> {
  const verified: SourceDocument[] = [];

  for (const source of sources) {
    if (source.fromQueue) {
      source.verification = "Yes";
      verified.push(source);
      continue;
    }

    const decision = await verifySourceWithPerplexity(topic, source);
    source.verification = decision;
    console.log(`verify_source host=${source.host} verdict=${decision}`);
    if (decision === "Yes") {
      verified.push(source);
    }
  }

  if (verified.length < MIN_SOURCES) {
    throw new Error(`Not enough verified sources (${verified.length}/${MIN_SOURCES}).`);
  }

  return verified;
}

function formatSourcesForPrompt(sources: SourceDocument[]): string {
  return sources
    .map(
      (source, index) =>
        `SOURCE ${index + 1}\nTITLE: ${source.title}\nURL: ${source.url}\nHOST: ${source.host}\nCONTENT:\n${source.content}\n`
    )
    .join("\n");
}

function buildArticlePrompt(topic: string, sources: SourceDocument[]): string {
  const sourceBlock = formatSourcesForPrompt(sources);

  return `
Use the research below to write a Roblox article.

Write an article in simple English that is easy for anyone to understand. Use a conversational tone like a professional Roblox gaming writer sharing is Roblox knowledge/experience. The article should feel like a friend talking to a friend while still being factual, helpful, and engaging.

Start with an small intro that hooks the audience into reading the entire article. Keep it direct, focused and on-point. Write a unique, conventional and on point intro that's very human and relatable. Do not repeat the same info template again and again. 
Right after the intro, give the main answer upfront with no heading. Can start with something like "first things first" or "Here's a quick answer" or anything that flows naturally. This should be just a small para only covering the most important aspect like in 2-3 lines long. Instead you can also use 2-3 bullet points here if you think that will make it easier to scan. Keep this section conversational and easy to understand.

After that, start with a H2 heading and then write the main content following these rules:
 - The article should flow like a story from the start to the end. Every section should be connected and tell a clean explaination of the said topic. 
 - Keep the article information dense, and communicate it in a way that is easy to understand. 
 - Adjust depth based on the topic. If something is simple, keep it short. If something needs more explanation, expand it properly. 
 - Use headings only when they are really important and drive the topic forward. Keep the structure simple to scan through. 
 - Random tips can be said with small "Note:" or "Tip:" or anything that works instead of giving a full headings. 
 - Use H2 headings for main sections and H3 headings for sub-sections. (As mentioned, only when really needed)
 - Write in-depth and make sure everything is covered, but write in as less words as possible. 
 - Use full sentences and explain things clearly without any repetations or useless information. 
 - Use tables and bullet points when it makes information easier to scan. Prefer paras to communitate tips, information, etc.
 - Use numbered steps when explaining a process.  
 - Before any tables, bullet points, or steps, write a short paragraph that sets the context.
 - Write first-hand experience like roblox player sharing their knowledge/experience. Do not directly state it, instead you can talk like "It took 4 trials for me" or "I found this particularly helpful during my first week" to make it feel personal and relatable.
 - Share these moments naturally to build connection with the reader. Also write things that only a player who played the game would know.
 - Conclude the answer with a short friendly takeaway that leaves the reader feeling guided and confident. No need for any cringe ending words like "Happy fishing and defending out there!". Just keep it real and helpful.

 Most importantly: Do not add emojis, sources, URLs, or reference numbers. No emdashes anywhere. (Never mention these anywhere in your output)

Sources:
${sourceBlock}

Return JSON:
{
  "title": "A small simple title that's easy to scan and understand. Keep it short and on-point and no key:value pairs",
  "meta_description": "150-160 character summary",
  "content_md": "Full Markdown article"
  }
  `.trim();
}

async function buildArticlePromptWithSonar(topic: string, sources: SourceDocument[]): Promise<string> {
  const sourceBlock = formatSourcesForPrompt(sources);
  const sonarPrompt = `
Create a single, detailed prompt that I can give to an AI model to write a Roblox article. Include all the requirements. Definitely make sure to tell the article should be in simple english, conversation like and easy to understand flow. Do not include your details about prompt writing in the output. Just give me the prompt directly.

Topic: "${topic}"

Use all the research below to tune the prompt:
${sourceBlock}

Requirements in the article so you need to tune the prompt accordingly: 

1. Article needs to be simple english and easy to understand style. Use a conversational tone like a professional Roblox gaming writer sharing is Roblox knowledge/experience.
2. Needs to be factual, grounded, engaging and helpful. The article should flow like a story from start to end.
3. Should explain everything related to the topic in depth
4. Should not drag the article and need to be as less words as possible. 
5. Use H2 headings and then H3 Headings. However use only when it drives the narrative forward. This less number of headings will help user to understand the entire structure easily. Also Headings should be conversational like a casual sentence talking to the user.  
6. No need for title, start with intro directly. 
7. Intro should be unique to the article topic and need to be small and should hook the reader. Keep things grounded and simple.
8. Right after the intro, give a small section with no headings that give away everything user needs to know for their search intent. Can write like just 2-3 lines in para format or use 2-3 bullet points whichever works best for the topic. Prefer paras mostly. Start with section with something like "First things first" or "Here's a quick answer" or anything that flows naturally. 
9. Entire article should be written in full sentences, engaging with as less words as possible. 
10. Write first-hand experience like roblox player sharing their knowledge/experience. Do not directly state it, instead you can talk like "It took 4 trials for me" or "I found this particularly helpful during my first week" to make it feel personal and relatable.
11. When writing, you can casually use words like I, You and explain things in a simple way that everyone can understand. 
12. Do not use any AI-ish anecdotes like "This is not just X, this is also y". Just talk directly without enthusiasm and less hype. Keep things grounded and natual.  
13. Use tables and bullet points when it makes information easier to scan. Prefer paras to communitate tips, information, etc. Use numbered steps when explaining a process. 
14. Before any tables, bullet points, or steps, write a short paragraph that sets the context. This helps the article to flow like a story. 
15. Conclude the answer with a short friendly takeaway that leaves the reader feeling guided and confident. No generic heading like Final Thoughts or Outro is needed. 
17. Adjust depth based on the topic. If something is simple, keep it short. If something needs more explanation, expand it properly. The idea is to create an editorial article that values people's time and help them love reading with flow rather than just a information dump. 
18. Most importantly: Do not add emojis, sources, URLs, or reference numbers. No emdashes anywhere. This step is very important. 

Just directly start and give me the prompt and nothing more. Instead of just a vague prompt, you can include what can be said in the intro that's very small but hooking, what examples can be considered to state them. Give a line or two about the topics that need to be included.  And ask the AI model to feel free to experiment to make the article perfect.`.trim();

  try {
    const completion = await perplexity.chat.completions.create({
      model: "sonar",
      temperature: 0.2,
      max_tokens: 600,
      messages: [
        { role: "system", content: "Return only the crafted prompt text, nothing else." },
        { role: "user", content: sonarPrompt }
      ]
    });

    const generated = completion.choices[0]?.message?.content?.trim();
    if (generated) return generated;
  } catch (error) {
    console.warn("⚠️ Sonar prompt generation failed:", error instanceof Error ? error.message : String(error));
  }

  return buildArticlePrompt(topic, sources);
}

async function draftArticle(prompt: string): Promise<DraftArticle> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.35,
    max_tokens: 4000,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are an expert Roblox writer. Always return valid JSON with title, content_md, and meta_description. Title must be very short, on-point, and include relevant keywords. Meta description must be concise, hooky, and include keywords (around 150-160 characters)."
      },
      { role: "user", content: prompt }
    ]
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`OpenAI did not return valid JSON: ${(error as Error).message}`);
  }

  const { title, content_md, meta_description } = parsed as Partial<DraftArticle>;
  if (!title || !content_md || !meta_description) {
    throw new Error("Draft missing required fields.");
  }

  return {
    title: title.trim(),
    content_md: content_md.trim(),
    meta_description: meta_description.trim()
  };
}

function isNoCoverageFeedback(feedback: string): boolean {
  const normalized = feedback.trim().toLowerCase();
  return normalized === "no" || normalized === "no." || normalized === '"no"' || normalized === "'no'";
}

async function checkArticleCoverage(topic: string, article: DraftArticle, sources: SourceDocument[]): Promise<string> {
  const prompt = `
Check if this Roblox article misses any crucial information that readers expect for the topic. Only consider topics that are very close to "${topic}" and crucial for the intent—skip tangents or nice-to-haves. If the article already covers everything important, reply exactly: No
If something critical is missing, list the missing pieces and the exact info to add so it can be inserted as-is. Keep it concise and actionable.

Topic: "${topic}"

Article Title: ${article.title}
Article Markdown:
${article.content_md}

Relevant research:
${formatSourcesForPrompt(sources)}
`.trim();

  const completion = await perplexity.chat.completions.create({
    model: "sonar",
    temperature: 0,
    max_tokens: 600,
    messages: [
      {
        role: "system",
        content:
          'You judge coverage completeness for Roblox articles. Only flag items that are very close to the topic and crucial to its intent. If nothing critical is missing, reply exactly "No". Otherwise, provide only the missing items with the information to add. Do not suggest tangential ideas.'
      },
      { role: "user", content: prompt }
    ]
  });

  const feedback = completion.choices[0]?.message?.content?.trim();
  if (!feedback) {
    throw new Error("Coverage check returned empty feedback.");
  }

  return feedback;
}

async function factCheckArticle(topic: string, article: DraftArticle, sources: SourceDocument[]): Promise<string> {
  const prompt = `
Fact check this Roblox article. Search broadly. If everything is accurate, reply exactly: Yes
If anything is incorrect, missing, or misleading, reply starting with: No
Then give clear details of what is wrong and how to change it, including the correct information needed. Be explicit about what to fix. Make sure to provide all the correct and upto date details. 

Topic: "${topic}"

Article Title: ${article.title}
Meta Description: ${article.meta_description}
Article Markdown:
${article.content_md}
`.trim();

  const completion = await perplexity.chat.completions.create({
    model: "sonar",
    temperature: 0,
    max_tokens: 1200,
    messages: [
      {
        role: "system",
        content:
          "You are a strict fact checker. Always reply exactly 'Yes' if the article is accurate. Otherwise start with 'No' and provide detailed, actionable corrections with the right information."
      },
      { role: "user", content: prompt }
    ]
  });

  const feedback = completion.choices[0]?.message?.content?.trim();
  if (!feedback) {
    throw new Error("Fact check returned empty feedback.");
  }

  return feedback;
}

async function reviseArticleWithFeedback(
  topic: string,
  article: DraftArticle,
  sources: SourceDocument[],
  feedback: string,
  feedbackLabel: string
): Promise<DraftArticle> {
  const sourceBlock = formatSourcesForPrompt(sources);
  const label = feedbackLabel || "feedback";
  const prompt = `
You are updating a Roblox article after ${label}. Keep the same friendly, conversational tone and overall structure.
- If feedback starts with "Yes", return the original article unchanged.
- If feedback starts with "No", only adjust the parts that were flagged. Keep everything else as close as possible to the original voice.
- Use the ${label} plus the provided sources; do not invent new information.
- Make only the changes required by the feedback—no extra rewrites.

Topic: "${topic}"

${label}:
${feedback}

Sources:
${sourceBlock}

Original article:
Title: ${article.title}
Meta Description: ${article.meta_description}
Content:
${article.content_md}

Return JSON:
{
  "title": "Keep this close to the original title unless feedback requires a correction",
  "meta_description": "150-160 character summary",
  "content_md": "Updated Markdown article with only the necessary corrections"
}
`.trim();

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.35,
    max_tokens: 4000,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are an expert Roblox writer. Always return valid JSON with title, content_md, and meta_description. Title must be very short, on-point, and include relevant keywords. Meta description must be concise, hooky, and include keywords (around 150-160 characters)."
      },
      { role: "user", content: prompt }
    ]
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Revision step did not return valid JSON: ${(error as Error).message}`);
  }

  const { title, content_md, meta_description } = parsed as Partial<DraftArticle>;
  if (!title || !content_md || !meta_description) {
    throw new Error("Revision missing required fields.");
  }

  return {
    title: title.trim(),
    content_md: content_md.trim(),
    meta_description: meta_description.trim()
  };
}

async function fetchRelatedPagesForUniverse(params: {
  universeId: number | null;
  excludeSlug?: string | null;
}): Promise<RelatedPage[]> {
  const { universeId, excludeSlug } = params;

  const related: RelatedPage[] = [];
  const seen = new Set<string>();
  const addPage = (page: RelatedPage) => {
    if (seen.has(page.url)) return;
    related.push(page);
    seen.add(page.url);
  };

  try {
    let articleQuery = supabase
      .from("articles")
      .select("title, slug, meta_description, published_at, updated_at")
      .eq("is_published", true);

    if (universeId) {
      articleQuery = articleQuery.eq("universe_id", universeId);
    }

    if (excludeSlug) {
      articleQuery = articleQuery.neq("slug", excludeSlug);
    }

    const { data, error } = await articleQuery.order("published_at", { ascending: false }).limit(25);
    if (error) {
      console.warn("⚠️ Failed to fetch related articles:", error.message);
    } else {
      for (const row of data ?? []) {
        if (!row?.slug || !row?.title) continue;
        addPage({
          type: "article",
          title: row.title,
          url: `${SITE_URL}/articles/${row.slug}`,
          description: truncateForPrompt((row as any).meta_description),
          updatedAt: (row as any).published_at ?? (row as any).updated_at ?? null
        });
      }
    }

    const hadUniverseArticles = related.some((entry) => entry.type === "article" && universeId !== null);

    if ((!universeId || !hadUniverseArticles) && related.filter((p) => p.type === "article").length === 0) {
      const { data: fallbackArticles, error: fallbackError } = await supabase
        .from("articles")
        .select("title, slug, meta_description, published_at, updated_at")
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .limit(25);

      if (fallbackError) {
        console.warn("⚠️ Fallback article lookup failed:", fallbackError.message);
      } else {
        for (const row of fallbackArticles ?? []) {
          if (!row?.slug || !row?.title) continue;
          if (excludeSlug && row.slug === excludeSlug) continue;
          addPage({
            type: "article",
            title: row.title,
            url: `${SITE_URL}/articles/${row.slug}`,
            description: truncateForPrompt((row as any).meta_description),
            updatedAt: (row as any).published_at ?? (row as any).updated_at ?? null
          });
        }
      }
    }
  } catch (error) {
    console.warn("⚠️ Related articles lookup failed:", error instanceof Error ? error.message : String(error));
  }

  if (universeId) {
    try {
      const { data, error } = await supabase
        .from("games")
        .select("name, slug, seo_description, updated_at")
        .eq("universe_id", universeId)
        .eq("is_published", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn("⚠️ Failed to fetch codes page:", error.message);
      } else if (data?.slug) {
        addPage({
          type: "codes",
          title: `${data.name ?? "Game"} codes`,
          url: `${SITE_URL}/codes/${data.slug}`,
          description: truncateForPrompt((data as any).seo_description),
          updatedAt: (data as any).updated_at ?? null
        });
      }
    } catch (error) {
      console.warn("⚠️ Codes page lookup failed:", error instanceof Error ? error.message : String(error));
    }

    try {
      const { data, error } = await supabase
        .from("checklist_pages_view")
        .select("title, slug, description_md, content_updated_at")
        .eq("universe_id", universeId)
        .eq("is_public", true)
        .order("content_updated_at", { ascending: false })
        .limit(3);

      if (error) {
        console.warn("⚠️ Failed to fetch checklist pages:", error.message);
      } else {
        for (const row of data ?? []) {
          if (!row?.slug || !row?.title) continue;
          addPage({
            type: "checklist",
            title: row.title,
            url: `${SITE_URL}/checklists/${row.slug}`,
            description: truncateForPrompt((row as any).description_md),
            updatedAt: (row as any).content_updated_at ?? null
          });
        }
      }
    } catch (error) {
      console.warn("⚠️ Checklist lookup failed:", error instanceof Error ? error.message : String(error));
    }
  }

  try {
    const { data, error } = await supabase
      .from("tools_view")
      .select("code, title, meta_description, content_updated_at")
      .eq("is_published", true)
      .order("content_updated_at", { ascending: false })
      .limit(3);

    if (error) {
      console.warn("⚠️ Failed to fetch tools:", error.message);
    } else {
      for (const row of data ?? []) {
        if (!row?.code || !row?.title) continue;
        addPage({
          type: "tool",
          title: row.title,
          url: `${SITE_URL}/tools/${row.code}`,
          description: truncateForPrompt((row as any).meta_description),
          updatedAt: (row as any).content_updated_at ?? null
        });
      }
    }
  } catch (error) {
    console.warn("⚠️ Tools lookup failed:", error instanceof Error ? error.message : String(error));
  }

  return related;
}

async function interlinkArticleWithRelatedPages(
  topic: string,
  article: DraftArticle,
  pages: RelatedPage[]
): Promise<DraftArticle> {
  const cleanedArticle: DraftArticle = {
    ...article,
    content_md: replaceEmDashes(article.content_md)
  };

  if (pages.length < 2) return cleanedArticle;

  const pageBlock = pages
    .map(
      (page, idx) =>
        `PAGE ${idx + 1}\nType: ${page.type}\nTitle: ${page.title}\nURL: ${page.url}\nDetails: ${page.description ?? "n/a"}\nUpdated: ${
          page.updatedAt ?? "n/a"
        }`
    )
    .join("\n\n");

  const prompt = `
Sprinkle 3-4 short internal links throughout the article where they naturally fit. Place them inline across separate, relevant sentences—not all in one sentence or paragraph. No new headings or lists.
- Use inline Markdown links: [label](url).
- Prefer the most relevant same-universe pages: codes page, checklist, and older articles. Use tools only if they genuinely help the reader.
- If fewer than 3 pages are a good fit, add as many as make sense (at least 2) or leave the article unchanged if nothing fits.
- Anchor text can be rephrased; make it read naturally in context instead of matching titles verbatim.
- Use the provided URLs exactly; they are on bloxodes.com. Do not invent links.
- Keep the existing tone and structure; avoid rewrites outside the linked spots.

Topic: "${topic}"

Internal pages:
${pageBlock}

Article Markdown:
${cleanedArticle.content_md}

Return JSON:
{
  "title": "${article.title}",
  "meta_description": "${article.meta_description}",
  "content_md": "Markdown with the internal links inserted where they naturally fit, or unchanged if not enough relevant pages"
}
`.trim();

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.25,
    max_tokens: 3000,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You add natural internal links in-line. Always return valid JSON with title, content_md, and meta_description."
      },
      { role: "user", content: prompt }
    ]
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Interlinking step did not return valid JSON: ${(error as Error).message}`);
  }

  const { title, content_md, meta_description } = parsed as Partial<DraftArticle>;
  if (!title || !content_md || !meta_description) {
    throw new Error("Interlinking step missing required fields.");
  }

  return {
    title: title.trim(),
    content_md: content_md.trim(),
    meta_description: meta_description.trim()
  };
}

async function buildShortCoverTitle(title: string, topic: string): Promise<string> {
  const prompt = `
Create a short, punchy 3-6 word version of this Roblox article title to overlay on a cover image. Keep it clear and scannable. Avoid quotes or extra punctuation.

Title: ${title}
Topic: ${topic}
Return only the shortened title text.
`.trim();

  try {
    const completion = await perplexity.chat.completions.create({
      model: "sonar",
      temperature: 0.2,
      max_tokens: 50,
      messages: [
        { role: "system", content: "Return only the shortened title text, no quotes or labels." },
        { role: "user", content: prompt }
      ]
    });

    const shortText = completion.choices[0]?.message?.content?.trim() ?? "";
    const normalized = normalizeOverlayTitle(shortText);
    if (normalized) return normalized;
  } catch (error) {
    console.warn("⚠️ Short title generation failed:", error instanceof Error ? error.message : String(error));
  }

  return normalizeOverlayTitle(title) ?? "Roblox";
}

async function insertArticleDraft(
  article: DraftArticle,
  options: { slug?: string; universeId?: number | null; coverImage?: string | null } = {}
): Promise<{ id: string; slug: string }> {
  const slug = options.slug ?? (await ensureUniqueSlug(article.title));
  const wordCount = estimateWordCount(article.content_md);
  const authorId = (await pickAuthorId()) ?? AUTHOR_ID;

  const { data, error } = await supabase
    .from("articles")
    .insert({
      title: article.title,
      slug,
      content_md: article.content_md,
      meta_description: article.meta_description,
      author_id: authorId,
      universe_id: options.universeId ?? null,
      cover_image: options.coverImage ?? null,
      is_published: false,
      word_count: wordCount
    })
    .select("id, slug")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to insert article draft: ${error.message}`);
  }

  if (!data?.id || !data.slug) {
    throw new Error("Article insert did not return expected data.");
  }

  return { id: data.id as string, slug: data.slug as string };
}

async function updateArticleContent(articleId: string, article: DraftArticle): Promise<boolean> {
  const wordCount = estimateWordCount(article.content_md);
  const { error } = await supabase
    .from("articles")
    .update({
      title: article.title,
      meta_description: article.meta_description,
      content_md: article.content_md,
      word_count: wordCount
    })
    .eq("id", articleId);

  if (error) {
    console.warn("⚠️ Failed to update article with images:", error.message);
    return false;
  }
  return true;
}

async function downloadAndConvertSourceImage(
  imageUrl: string
): Promise<{ buffer: Buffer; width: number | null; height: number | null } | null> {
  try {
    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8"
      },
      redirect: "follow"
    });

    if (!response.ok) {
      console.warn(`⚠️ Failed to download source image ${imageUrl}: ${response.statusText}`);
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const metadata = await sharp(buffer).metadata();
    const webpBuffer = await sharp(buffer)
      .webp({ quality: 90, effort: 4 })
      .toBuffer();

    return {
      buffer: webpBuffer,
      width: metadata.width ?? null,
      height: metadata.height ?? null
    };
  } catch (error) {
    console.warn(`⚠️ Could not process source image ${imageUrl}:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function uploadSourceImagesForArticle(params: {
  articleId: string;
  slug: string;
  sources: SourceDocument[];
}): Promise<{ uploaded: number; images: ImagePlacement[] }> {
  if (!SUPABASE_MEDIA_BUCKET) {
    console.log("⚠️ SUPABASE_MEDIA_BUCKET not configured. Skipping source image uploads.");
    return { uploaded: 0, images: [] };
  }

  const storageClient = supabase.storage.from(SUPABASE_MEDIA_BUCKET);
  const seen = new Set<string>();
  const rows: {
    article_id: string;
    source_url: string;
    source_host: string;
    name: string;
    original_url: string;
    uploaded_path: string;
    public_url: string | null;
    table_key: string | null;
    row_text: string | null;
    alt_text: string | null;
    caption: string | null;
    context: string | null;
    is_table: boolean;
    width: number | null;
    height: number | null;
  }[] = [];

  for (const source of params.sources) {
    const images = source.images ?? [];
    console.log(`source_images_found host=${source.host} count=${images.length} url=${source.url}`);
    if (!Array.isArray(images) || images.length === 0) continue;

    for (const image of images) {
      const dedupeKey = `${source.url}|${image.originalUrl}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const converted = await downloadAndConvertSourceImage(image.originalUrl);
      if (!converted) continue;

      if (
        converted.width !== null &&
        converted.height !== null &&
        (converted.width < 20 || converted.height < 20)
      ) {
        console.warn(`⚠️ Skipping tiny source image ${image.originalUrl} (${converted.width}x${converted.height})`);
        continue;
      }

      const fileBase = normalizeImageFileBase(image.name);
      const suffix = hashForPath(`${source.url}-${image.originalUrl}`);
      const path = `articles/${params.slug}/sources/${fileBase}-${suffix}.webp`;

      const uploadResult = await storageClient.upload(path, converted.buffer, {
        contentType: "image/webp",
        upsert: true
      });

      if (uploadResult.error) {
        console.warn(`⚠️ Failed to upload source image ${image.originalUrl}:`, uploadResult.error.message);
        continue;
      }

      const publicUrl = storageClient.getPublicUrl(path).data.publicUrl ?? null;
      const tableKey = image.isTable ? normalizeImageFileBase(image.name) : null;

      rows.push({
        article_id: params.articleId,
        source_url: source.url,
        source_host: source.host,
        name: image.name,
        original_url: image.originalUrl,
        uploaded_path: path,
        public_url: publicUrl,
        table_key: tableKey,
        row_text: image.rowText ?? null,
        alt_text: image.altText,
        caption: image.caption,
        context: image.context ?? image.rowText ?? null,
        is_table: image.isTable,
        width: converted.width ?? image.width ?? null,
        height: converted.height ?? image.height ?? null
      });
    }
  }

  if (rows.length === 0) {
    console.log("source_image_upload_skipped reason=no_images_found");
    return { uploaded: 0, images: [] };
  }

  const { error } = await supabase.from("article_source_images").insert(rows);
  if (error) {
    throw new Error(`Failed to save article source images: ${error.message}`);
  }

  const imagesOut: ImagePlacement[] = rows
    .filter((row) => row.public_url)
    .map((row) => ({
      name: row.name,
      publicUrl: row.public_url as string,
      tableKey: row.table_key,
      context: row.context ?? row.row_text ?? null,
      uploadedPath: row.uploaded_path
    }));

  return { uploaded: rows.length, images: imagesOut };
}

async function reviseArticleWithImages(article: DraftArticle, images: ImagePlacement[]): Promise<DraftArticle> {
  if (!images.length) return article;

  const imagesBlock = images
    .map(
      (img, idx) =>
        `IMAGE ${idx + 1}\nname: ${img.name}\nurl: ${img.publicUrl}\ntable_key: ${img.tableKey ?? "n/a"}\ncontext: ${img.context ?? "n/a"}`
    )
    .join("\n\n");

  const prompt = `
You will insert provided images into the article's Markdown tables. Rules:
- Use only the given image URLs. Do not invent or fetch anything else.
- Match images to table rows by name/table_key/context. If you can't confidently place an image, leave the table as-is.
- Always place the image in a new column of the matching row.
- To add images you can convert the existing info to table and add the images. 
- Prefer putting the image in the first column of the matching row using Markdown image syntax: ![Alt](URL)
- Keep all existing text; add images, do not delete content. Maintain table structure.
- Do not add a new section; only modify existing tables where a match is clear.
- If multiple images match a row, pick one.

Images:
${imagesBlock}

Article Markdown:
${article.content_md}

Return JSON:
{
  "title": "${article.title}",
  "meta_description": "${article.meta_description}",
  "content_md": "Updated Markdown with images inserted into the appropriate table rows"
}
`.trim();

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.2,
    max_tokens: 3000,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are an expert Roblox content editor. Always return valid JSON with title, content_md, and meta_description. Title must be very short, on-point, and include relevant keywords. Meta description must be concise, hooky, and include keywords (around 150-160 characters)."
      },
      { role: "user", content: prompt }
    ]
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Image insertion step did not return valid JSON: ${(error as Error).message}`);
  }

  const { title, content_md, meta_description } = parsed as Partial<DraftArticle>;
  if (!title || !content_md || !meta_description) {
    throw new Error("Image insertion missing required fields.");
  }

  return {
    title: title.trim(),
    content_md: content_md.trim(),
    meta_description: meta_description.trim()
  };
}

async function cleanupUnusedArticleImages(params: {
  articleId: string;
  contentMd: string;
  images: ImagePlacement[];
}): Promise<void> {
  if (!SUPABASE_MEDIA_BUCKET || !params.images.length) return;

  const usedUrls = new Set(
    params.images
      .filter((img) => typeof img.publicUrl === "string" && params.contentMd.includes(img.publicUrl))
      .map((img) => img.publicUrl)
  );

  const pathsToDelete = Array.from(
    new Set(
      params.images
        .filter((img) => !usedUrls.has(img.publicUrl))
        .map((img) => img.uploadedPath)
        .filter((path): path is string => Boolean(path))
    )
  );

  if (!pathsToDelete.length) {
    console.log("source_images_cleanup_skipped reason=all_used");
    return;
  }

  const storageClient = supabase.storage.from(SUPABASE_MEDIA_BUCKET);
  const { error: storageError } = await storageClient.remove(pathsToDelete);
  if (storageError) {
    console.warn("⚠️ Failed to delete unused source images from storage:", storageError.message);
  }

  const { error: dbError } = await supabase
    .from("article_source_images")
    .delete()
    .eq("article_id", params.articleId)
    .in("uploaded_path", pathsToDelete);

  if (dbError) {
    console.warn("⚠️ Failed to delete unused source image rows:", dbError.message);
  } else {
    console.log(`source_images_cleanup_deleted=${pathsToDelete.length}`);
  }
}

async function main() {
  let queueEntry: QueueRow | null = null;

  try {
    queueEntry = await getNextQueueItem();
    if (!queueEntry) {
      console.log("No pending article tasks found.");
      return;
    }

    const topic = queueEntry.article_title?.trim();
    if (!topic) {
      throw new Error("Queue item missing article_title.");
    }

    console.log(`✏️  Generating article for "${topic}" (${queueEntry.id})`);
    await markAttempt(queueEntry);

    const collectedSources = await gatherSources(topic, queueEntry.sources);
    console.log(`sources_collected=${collectedSources.length}`);

    const verifiedSources = await verifySources(topic, collectedSources);
    console.log(`sources_verified=${verifiedSources.length}`);

    const prompt = await buildArticlePromptWithSonar(topic, verifiedSources);
    console.log(`draft_prompt=\n${prompt}`);
    const draft = await draftArticle(prompt);
    console.log(`draft_title="${draft.title}" word_count=${estimateWordCount(draft.content_md)}`);

    const coverageFeedback = await checkArticleCoverage(topic, draft, verifiedSources);
    const coverageLog = coverageFeedback.replace(/\s+/g, " ").slice(0, 200);
    console.log(`coverage_check="${coverageLog}${coverageFeedback.length > 200 ? "..." : ""}"`);

    const coverageDraft = isNoCoverageFeedback(coverageFeedback)
      ? draft
      : await reviseArticleWithFeedback(topic, draft, verifiedSources, coverageFeedback, "coverage feedback");
    console.log(`coverage_title="${coverageDraft.title}" word_count=${estimateWordCount(coverageDraft.content_md)}`);

    const factCheckFeedback = await factCheckArticle(topic, coverageDraft, verifiedSources);
    const factCheckLog = factCheckFeedback.replace(/\s+/g, " ").slice(0, 200);
    console.log(`fact_check="${factCheckLog}${factCheckFeedback.length > 200 ? "..." : ""}"`);

    const factCheckedDraft = await reviseArticleWithFeedback(
      topic,
      coverageDraft,
      verifiedSources,
      factCheckFeedback,
      "fact-check feedback"
    );
    console.log(`fact_checked_title="${factCheckedDraft.title}" word_count=${estimateWordCount(factCheckedDraft.content_md)}`);

    const relatedPages = await fetchRelatedPagesForUniverse({
      universeId: queueEntry.universe_id,
      excludeSlug: slugify(factCheckedDraft.title)
    });
    console.log(`interlink_candidates=${relatedPages.length}`);

    const interlinkedDraft = await interlinkArticleWithRelatedPages(topic, factCheckedDraft, relatedPages);
    console.log(`interlinked_title="${interlinkedDraft.title}" word_count=${estimateWordCount(interlinkedDraft.content_md)}`);

    let currentDraft = interlinkedDraft;
    console.log(`final_title="${currentDraft.title}" word_count=${estimateWordCount(currentDraft.content_md)}`);

    if (currentDraft.content_md.length < 400) {
      throw new Error("Draft content is too short after revision.");
    }

    const slug = await ensureUniqueSlug(currentDraft.title);

    let coverImage: string | null = null;
    if (queueEntry.universe_id) {
      console.log(`🖼️ Attaching universe cover from ${queueEntry.universe_id}...`);
      let coverTitle: string | null = null;
      try {
        coverTitle = await buildShortCoverTitle(currentDraft.title, topic);
      } catch (titleError) {
        console.warn("⚠️ Cover title generation failed:", titleError instanceof Error ? titleError.message : String(titleError));
      }
      coverImage = await uploadUniverseCoverImage(queueEntry.universe_id, slug, coverTitle);
    }

    const article = await insertArticleDraft(currentDraft, {
      slug,
      universeId: queueEntry.universe_id,
      coverImage
    });

    console.log(`article_saved id=${article.id} slug=${article.slug} cover=${coverImage ?? "none"}`);

    let articleContentForCleanup = currentDraft.content_md;
    const imageUploadResult = await uploadSourceImagesForArticle({
      articleId: article.id,
      slug,
      sources: verifiedSources
    });
    console.log(`source_images_uploaded=${imageUploadResult.uploaded}`);

    if (imageUploadResult.images.length > 0) {
      try {
        const withImages = await reviseArticleWithImages(currentDraft, imageUploadResult.images);
        const updated = await updateArticleContent(article.id, withImages);
        console.log(`images_injected word_count=${estimateWordCount(withImages.content_md)} updated=${updated}`);
        if (updated) {
          currentDraft = withImages;
          articleContentForCleanup = withImages.content_md;
        }
      } catch (imageError) {
        console.warn("⚠️ Failed to inject images into article:", imageError instanceof Error ? imageError.message : String(imageError));
      }

      await cleanupUnusedArticleImages({
        articleId: article.id,
        contentMd: articleContentForCleanup,
        images: imageUploadResult.images
      });
    }

    const cleanedDraft = removeEmDashesFromDraft(currentDraft);
    const cleanedUpdated = await updateArticleContent(article.id, cleanedDraft);
    console.log(`emdash_cleanup word_count=${estimateWordCount(cleanedDraft.content_md)} updated=${cleanedUpdated}`);
    if (cleanedUpdated) {
      currentDraft = cleanedDraft;
    }

    await updateQueueStatus(queueEntry.id, "completed", null);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("❌ Article generation failed:", message);
    if (queueEntry) {
      try {
        await updateQueueStatus(queueEntry.id, "failed", message);
      } catch (innerError) {
        console.error("⚠️ Additionally failed to update queue status:", innerError);
      }
    }
    process.exitCode = 1;
  }
}

main();
