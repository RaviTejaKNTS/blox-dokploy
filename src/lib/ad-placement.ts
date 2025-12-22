import { load } from "cheerio";
import type { Element } from "domhandler";

type ContentBlock = { type: "html"; html: string } | { type: "ad" };

type AdPlacementOptions = {
  wordsPerAd?: number;
  minWords?: number;
  minAds?: number;
  maxAds?: number;
};

const DEFAULT_WORDS_PER_AD = 500;
const DEFAULT_MIN_WORDS = 250;
const DEFAULT_MIN_ADS = 1;
const DEFAULT_MAX_ADS = 5;
const BLOCKED_AFTER_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "hr"]);

function countWords(text: string): number {
  const cleaned = text.replace(/\u00a0/g, " ").trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter(Boolean).length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function canInsertAfter(node: Element): boolean {
  if (node.type !== "tag") return false;
  return !BLOCKED_AFTER_TAGS.has(node.name.toLowerCase());
}

export function buildArticleContentBlocks(
  html: string,
  {
    wordsPerAd = DEFAULT_WORDS_PER_AD,
    minWords = DEFAULT_MIN_WORDS,
    minAds = DEFAULT_MIN_ADS,
    maxAds = DEFAULT_MAX_ADS
  }: AdPlacementOptions = {}
): ContentBlock[] {
  if (!html?.trim()) {
    return [{ type: "html", html: "" }];
  }

  const $ = load(`<div data-article-root>${html}</div>`);
  const root = $("[data-article-root]");
  const blocks = root.children().toArray();
  const totalWords = countWords(root.text());

  if (!blocks.length || totalWords < minWords) {
    return [{ type: "html", html }];
  }

  const desiredAds = Math.ceil(totalWords / Math.max(1, wordsPerAd));
  const adCount = clamp(desiredAds, minAds, maxAds);
  const wordsPerChunk = totalWords / (adCount + 1);

  const output: ContentBlock[] = [];
  let buffer: string[] = [];
  let adsInserted = 0;
  let wordsSinceAd = 0;
  let pendingAd = false;

  blocks.forEach((node, index) => {
    const nodeHtml = $.html(node);
    if (!nodeHtml) return;
    buffer.push(nodeHtml);
    wordsSinceAd += countWords($(node).text());

    if (adsInserted >= adCount) return;
    if (index === blocks.length - 1) return;

    const reachedTarget = wordsSinceAd >= wordsPerChunk;
    const allowed = canInsertAfter(node);

    if (reachedTarget && allowed) {
      output.push({ type: "html", html: buffer.join("") });
      output.push({ type: "ad" });
      buffer = [];
      wordsSinceAd = 0;
      adsInserted += 1;
      pendingAd = false;
      return;
    }

    if (reachedTarget && !allowed) {
      pendingAd = true;
      return;
    }

    if (pendingAd && allowed && wordsSinceAd > 0) {
      output.push({ type: "html", html: buffer.join("") });
      output.push({ type: "ad" });
      buffer = [];
      wordsSinceAd = 0;
      adsInserted += 1;
      pendingAd = false;
    }
  });

  if (buffer.length) {
    output.push({ type: "html", html: buffer.join("") });
  }

  return output.length ? output : [{ type: "html", html }];
}
