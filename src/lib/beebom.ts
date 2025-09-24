import * as cheerio from "cheerio";
import type { ScrapeResult, ScrapedCode } from "./scraper-types";

const USER_AGENT = "Mozilla/5.0 (compatible; RobloxCodesBot/1.0)";

function normalizeCode(raw: string): string | null {
  if (!raw) return null;
  let code = raw.replace(/[`"'“”‘’]/g, "").trim();
  code = code.replace(/^code[:\s-]*/i, "").trim();
  if (!code) return null;
  return code.replace(/\s+/g, "").toUpperCase();
}

export async function scrapeBeebomPage(url: string): Promise<ScrapeResult> {
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  const html = await res.text();
  const $ = cheerio.load(html);

  let list: cheerio.Cheerio<cheerio.Element> | null = null;
  const firstHeading = $("h2").first();
  if (firstHeading.length) {
    list = firstHeading.nextUntil("h2").filter("ul, ol").first();
  }
  if (!list || !list.length) {
    list = $("ul, ol").first();
  }

  const codes: ScrapedCode[] = [];
  if (list && list.length) {
    list.find("li").each((_, li) => {
      const text = $(li).text();
      if (!text) return;
      const [beforeColon, ...rest] = text.split(":");
      const normalized = normalizeCode(beforeColon);
      if (!normalized) return;
      const rewardRaw = rest.join(":").trim();
      const cleanedReward = rewardRaw.replace(/\(\s*new\s*\)/gi, () => "");
      const isNew = rewardRaw.length > 0 && /\(\s*new\s*\)/i.test(rewardRaw);
      const reward = cleanedReward.trim();
      const entry: ScrapedCode = {
        code: normalized,
        status: "active",
        provider: "beebom",
      };
      if (reward) {
        entry.rewardsText = reward;
      }
      if (isNew) {
        entry.isNew = true;
      }
      codes.push(entry);
    });
  }

  return {
    codes,
    expiredCodes: [],
  };
}
