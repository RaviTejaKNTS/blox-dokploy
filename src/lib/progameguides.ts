import * as cheerio from "cheerio";
import type { ScrapeResult, ScrapedCode } from "./scraper-types";

const USER_AGENT = "Mozilla/5.0 (compatible; RobloxCodesBot/1.0)";

function normalizeReward(text: string) {
  const cleaned = text.replace(/\(\s*new\s*\)/gi, "").trim();
  return cleaned.replace(/[\u2014\-–]+/g, " ").replace(/\s+/g, " ").trim();
}

export async function scrapeProGameGuidesPage(url: string): Promise<ScrapeResult> {
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const codes: ScrapedCode[] = [];

  const table = $("table.pgg-codes").first();

  if (table.length) {
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
  }

  if (codes.length === 0) {
    const headingSelector = "h1, h2, h3, h4";
    const headingKeywords = ["active", "working", "new", "current"];
    const listSelector = 'ul[data-injection="true"][data-cmd="true"]';
    const headings = $(headingSelector);

    headings.each((_, el) => {
      if (codes.length) return false; // break once we find codes
      const heading = $(el);
      const text = heading.text().trim().toLowerCase();
      if (!text.includes("code")) return;
      if (!headingKeywords.some((kw) => text.includes(kw))) return;

      const nextHeadingFilter = headingSelector;
      const immediate = heading.next();
      let section = heading.nextUntil(nextHeadingFilter);
      if (immediate.length) {
        section = immediate.add(section);
      }

      const listSelectors = [
        listSelector,
        'ul[data-injection="true"]',
        'ul'
      ];

      let list: cheerio.Cheerio<cheerio.Element> | null = null;
      for (const sel of listSelectors) {
        const direct = section.filter(sel).first();
        if (direct.length) {
          list = direct;
          break;
        }
        const nested = section.find(sel).first();
        if (nested.length) {
          list = nested;
          break;
        }
      }

      if (!list || !list.length) return;

      const items = list.find("li");
      if (!items.length) return;

      const hasNoCodesMessage = items
        .toArray()
        .some((li) => /no\s+active\s+codes/i.test($(li).text()));
      if (hasNoCodesMessage) return; // skip this section and continue search

      items.each((_, li) => {
        const item = $(li);
        const strong = item.find("strong").first();
        let codeText = strong.text().trim();
        if (!codeText) {
          const rawText = item.text();
          const parts = rawText.split(/[:\u2014\-–]\s*/);
          codeText = (parts[0] || "").trim();
        }
        if (!codeText) return;

        const fullText = item.text();
        const rewardPart = strong.length
          ? item.clone().children().remove().end().text().trim()
          : fullText.replace(codeText, "").trim();
        const reward = normalizeReward(rewardPart);
        const isNew = /(\(\s*new\s*\)|\bnew\b)/i.test(fullText);

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

      return false;
    });
  }

  return { codes, expiredCodes: [] };
}
