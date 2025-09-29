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

const NEW_REGEX = /\(\s*new\s*\)/i;

function stripNewFlag(value: string): { cleaned: string; isNew: boolean } {
  const hasNew = NEW_REGEX.test(value);
  const cleaned = value.replace(new RegExp(NEW_REGEX, "gi"), "").trim();
  return { cleaned, isNew: hasNew };
}

export async function scrapeBeebomPage(url: string): Promise<ScrapeResult> {
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  const html = await res.text();
  const $ = cheerio.load(html);

  const nextElementSibling = (node: cheerio.Cheerio<cheerio.Element>) => {
    let sibling = node.next();
    while (sibling.length && sibling[0].type !== "tag") {
      sibling = sibling.next();
    }
    return sibling;
  };

  const collectSectionNodes = (
    start: cheerio.Cheerio<cheerio.Element>,
    stopSelector: string
  ): cheerio.Cheerio<cheerio.Element> => {
    if (!start || !start.length) return $([]);
    const span = start.nextUntil(stopSelector);
    const immediate = nextElementSibling(start);
    if (immediate.length) {
      return immediate.add(span);
    }
    return span;
  };

  const locateContainer = (
    start: cheerio.Cheerio<cheerio.Element>,
    stopSelector: string
  ): cheerio.Cheerio<cheerio.Element> | null => {
    const sectionNodes = collectSectionNodes(start, stopSelector);
    if (!sectionNodes.length) return null;
    const direct = sectionNodes.filter("ul, ol, table").first();
    if (direct.length) return direct;
    const nested = sectionNodes.find("ul, ol, table").first();
    return nested.length ? nested : null;
  };

  const h1 = $("h1").first();
  let firstH2 = h1.length ? h1.nextAll("h2").first() : $([]);

  if (!firstH2 || !firstH2.length) {
    const articleRoot = h1.length ? h1.closest(".beebom-single-content, article, main, .entry-content") : $([]);
    if (articleRoot.length) {
      firstH2 = articleRoot.find("h2").first();
    }
  }

  if (!firstH2 || !firstH2.length) {
    firstH2 = $("h2").first();
  }

  let container: cheerio.Cheerio<cheerio.Element> | null = null;
  if (firstH2.length) {
    const immediateAfterH2 = nextElementSibling(firstH2);
    if (immediateAfterH2.length && immediateAfterH2.is("h3")) {
      container = locateContainer(immediateAfterH2, "h2, h3");
    }
    if (!container || !container.length) {
      container = locateContainer(firstH2, "h2");
    }
  }

  const codes: ScrapedCode[] = [];
  if (container && container.length) {
    if (container.is("table")) {
      const rows = container.find("tbody tr");
      const targetRows = rows.length ? rows : container.find("tr");
      targetRows.each((_, row) => {
        const cells = $(row).find("td");
        if (cells.length < 2) return;

        const codeCell = $(cells[0]);
        const rewardCell = $(cells[1]);

        const codeDisplayRaw = codeCell.find("strong").first().text().trim();
        const codeFallbackRaw = codeCell.text().trim();
        const rewardRaw = rewardCell.text().trim();

        const { cleaned: codeDisplayClean, isNew: codeDisplayMarkedNew } = stripNewFlag(codeDisplayRaw || codeFallbackRaw);
        const { cleaned: codeCellClean, isNew: codeCellMarkedNew } = stripNewFlag(codeFallbackRaw);
        const { cleaned: rewardCleaned, isNew: rewardMarkedNew } = stripNewFlag(rewardRaw);

        const baseCodeText = codeDisplayRaw || codeFallbackRaw;
        const normalized = normalizeCode(codeDisplayClean || baseCodeText);
        if (!normalized) return;

        const entry: ScrapedCode = {
          code: normalized,
          status: "active",
          provider: "beebom",
        };

        if (rewardCleaned) {
          entry.rewardsText = rewardCleaned;
        }

        if (codeDisplayMarkedNew || codeCellMarkedNew || rewardMarkedNew) {
          entry.isNew = true;
        }

        codes.push(entry);
      });
    } else {
      container.find("li").each((_, li) => {
        const text = $(li).text();
        if (!text) return;
        const [beforeColon, ...rest] = text.split(":");
        const { cleaned: codeClean, isNew: codeMarkedNew } = stripNewFlag(beforeColon);
        const normalized = normalizeCode(codeClean || beforeColon);
        if (!normalized) return;
        const rewardRaw = rest.join(":").trim();
        const { cleaned: cleanedReward, isNew: rewardMarkedNew } = stripNewFlag(rewardRaw);
        const entry: ScrapedCode = {
          code: normalized,
          status: "active",
          provider: "beebom",
        };
        const reward = cleanedReward.trim();
        if (reward) {
          entry.rewardsText = reward;
        }
        if (codeMarkedNew || rewardMarkedNew) {
          entry.isNew = true;
        }
        codes.push(entry);
      });
    }
  }

  return {
    codes,
    expiredCodes: [],
  };
}
