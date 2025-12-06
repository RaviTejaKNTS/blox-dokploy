import "dotenv/config";
import { JSDOM } from "jsdom";

type FoundImage = {
  kind: "img" | "source" | "bg" | "amp" | "noscript";
  url: string;
  alt?: string | null;
  context?: string | null;
};

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

function resolveUrl(raw: string | null, base: string): string | null {
  if (!raw) return null;
  try {
    return new URL(raw, base).toString();
  } catch {
    return null;
  }
}

function parseBackgroundUrl(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(/url\((['"]?)(.*?)\1\)/i);
  if (match && match[2]) return match[2].trim();
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
    const absolute = resolveUrl(fromSrcset, baseUrl);
    if (absolute) return absolute;
  }

  return null;
}

async function main() {
  const url = process.argv[2] ?? "https://beebom.com/the-forge-runes-list-all-traits-explained/";
  console.log(`Fetching ${url}...`);

  const html = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  }).then((r) => r.text());

  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;
  const images: FoundImage[] = [];
  const seen = new Set<string>();

  const push = (entry: FoundImage) => {
    if (seen.has(entry.url)) return;
    seen.add(entry.url);
    images.push(entry);
  };

  // img
  for (const img of Array.from(doc.querySelectorAll("img"))) {
    const abs = resolveImageAttribute(img, url);
    if (!abs) continue;
    const isTable = isTableContext(img);
    push({ kind: "img", url: abs, alt: img.getAttribute("alt"), context: isTable ? "table" : null });
  }

  // source
  for (const src of Array.from(doc.querySelectorAll("source"))) {
    const abs = resolveUrl(pickFromSrcset(src.getAttribute("data-srcset") ?? src.getAttribute("srcset")), url);
    if (!abs) continue;
    const isTable = isTableContext(src);
    push({ kind: "source", url: abs, context: isTable ? "table" : null });
  }

  // backgrounds
  const bgNodes = Array.from(
    doc.querySelectorAll(
      "[style*='background-image'],[data-bg],[data-background],[data-bg-src],[data-lazy-bg],table [style*='background-image'],.table [style*='background-image']"
    )
  );
  for (const el of bgNodes) {
    const styleUrl = parseBackgroundUrl(el.getAttribute("style"));
    const dataUrl =
      el.getAttribute("data-bg") ||
      el.getAttribute("data-background") ||
      el.getAttribute("data-bg-src") ||
      el.getAttribute("data-lazy-bg");
    const abs = resolveUrl(styleUrl ?? dataUrl, url);
    if (!abs) continue;
    const isTable = isTableContext(el);
    push({ kind: "bg", url: abs, context: isTable ? "table" : null });
  }

  // amp
  for (const amp of Array.from(doc.querySelectorAll("amp-img"))) {
    const abs = resolveImageAttribute(amp, url);
    if (!abs) continue;
    const isTable = isTableContext(amp);
    push({ kind: "amp", url: abs, context: isTable ? "table" : null });
  }

  // noscript
  for (const ns of Array.from(doc.querySelectorAll("noscript"))) {
    if (!isTableContext(ns)) continue;
    const htmlInner = ns.innerHTML;
    if (!htmlInner || !htmlInner.includes("<img")) continue;
    try {
      const frag = new JSDOM(htmlInner, { url });
      for (const img of Array.from(frag.window.document.querySelectorAll("img"))) {
        const abs = resolveImageAttribute(img, url);
        if (!abs) continue;
        push({ kind: "noscript", url: abs, alt: img.getAttribute("alt"), context: "table" });
      }
    } catch {
      // ignore
    }
  }

  console.log(`Found ${images.length} images (unique)`);
  const tableOnly = images.filter((i) => i.context === "table");
  console.log(`Table context images: ${tableOnly.length}`);
  console.log(JSON.stringify(tableOnly, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
