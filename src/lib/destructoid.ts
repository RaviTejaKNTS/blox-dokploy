import * as cheerio from "cheerio";
import type { ScrapeResult, ScrapedCode } from "./scraper-types";

const USER_AGENT = "Mozilla/5.0 (compatible; RobloxCodesBot/1.0)";
const NEW_TEXT_REGEX = /\bnew\b/i;
const EXPIRED_HEADING_REGEX = /\b(expired|inactive|old)\b/i;
const HEADING_SELECTOR = "h1, h2, h3, h4, h5, h6";

function sanitizeReward(raw: string): { reward?: string; isNew?: boolean } {
  if (!raw) return {};
  const hasNew = NEW_TEXT_REGEX.test(raw);
  let cleaned = raw.replace(/\(\s*new\s*\)/gi, "");
  cleaned = cleaned.replace(/\bnew\b/gi, "").replace(/\s+/g, " ").trim();
  return { reward: cleaned || undefined, isNew: hasNew };
}

function findExpiredCodes($: cheerio.CheerioAPI): { code: string; provider: "destructoid" }[] {
  const expired: { code: string; provider: "destructoid" }[] = [];

  const headings = $(HEADING_SELECTOR).filter((_, el) => {
    const text = $(el).text().toLowerCase();
    return text.includes("expired");
  });

  headings.each((_, headingEl) => {
    const heading = $(headingEl);
    let pointer = heading.next();
    let list: cheerio.Cheerio<cheerio.Element> | null = null;

    while (pointer.length) {
      if (pointer.is(HEADING_SELECTOR)) break;
      if (pointer.is("ul, ol")) {
        list = pointer;
        break;
      }
      pointer = pointer.next();
    }

    if (!list || !list.length) return;

    list.find("li").each((_, li) => {
      const strongText = $(li).find("strong, b").first().text().trim();
      if (!strongText) return;
      expired.push({ code: strongText, provider: "destructoid" });
    });
  });

  return expired;
}

export async function scrapeDestructoidPage(url: string): Promise<ScrapeResult> {
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const containers = $(".game-codes-container");
  const activeCodes: ScrapedCode[] = [];
  const expiredCodes: { code: string; provider: "destructoid" }[] = [];

  if (!containers.length) {
    return { codes: activeCodes, expiredCodes: findExpiredCodes($) };
  }

  containers.each((_, container) => {
    const $container = $(container);
    const headingText = $container.find(".game-title").first().text().trim().toLowerCase();
    const isExpiredSection = EXPIRED_HEADING_REGEX.test(headingText);

    const rows = $container.find("table.codes-table tr");
    if (!rows.length) return;

    rows.each((__, row) => {
      const $row = $(row);
      if (!$row.hasClass("code-row")) return;

      const code = $row.find(".code-text").first().text().trim();
      if (!code) return;

      const descriptionText = $row.find(".description-text").first().text().trim();
      const { reward, isNew } = sanitizeReward(descriptionText);

      if (isExpiredSection) return;

      const entry: ScrapedCode = {
        code,
        status: "active",
        provider: "destructoid",
      };

      if (reward) entry.rewardsText = reward;
      if (isNew) entry.isNew = true;

      activeCodes.push(entry);
    });
  });

  if (!expiredCodes.length) {
    expiredCodes.push(...findExpiredCodes($));
  }

  return { codes: activeCodes, expiredCodes };
}
