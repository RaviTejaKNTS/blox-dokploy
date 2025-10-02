import * as cheerio from "cheerio";
import type { ScrapeResult, ScrapedCode } from "./scraper-types";

const USER_AGENT = "Mozilla/5.0 (compatible; RobloxCodesBot/1.0)";

function normalizeReward(text: string) {
  const cleaned = text.replace(/\(\s*new\s*\)/gi, "").trim();
  return cleaned.replace(/\s+/g, " ");
}

export async function scrapeProGameGuidesPage(url: string): Promise<ScrapeResult> {
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const table = $("table.pgg-codes").first();

  if (!table.length) {
    return { codes: [], expiredCodes: [] };
  }

  const codes: ScrapedCode[] = [];

  const rows = table.find("tbody tr");
  const targetRows = rows.length ? rows : table.find("tr");

  targetRows.each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 1) return;

    const codeCell = $(cells[0]);
    const rewardCell = cells.length > 2 ? $(cells[2]) : $(cells[cells.length - 1]);

    const codeText = codeCell.text().trim();
    if (!codeText) return;

    const rewardRaw = rewardCell.text().trim();
    const isNew = /\(\s*new\s*\)/i.test(rewardRaw);
    const reward = normalizeReward(rewardRaw);

    const entry: ScrapedCode = {
      code: codeText,
      status: "active",
      provider: "progameguides",
    };

    if (reward) {
      entry.rewardsText = reward;
    }

    if (isNew) {
      entry.isNew = true;
    }

    codes.push(entry);
  });

  return { codes, expiredCodes: [] };
}

