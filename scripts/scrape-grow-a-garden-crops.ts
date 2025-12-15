import fs from "node:fs/promises";
import path from "node:path";

import * as cheerio from "cheerio";
import fetch from "node-fetch";

const SOURCE_URL = "https://growagarden.fandom.com/wiki/Crops";
const OUTPUT_FILE = path.join(process.cwd(), "grow-a-garden-crops-data.md");

type ExtractedTable = {
  title: string;
  markdown: string;
};

function cleanCellText($: cheerio.CheerioAPI, element: cheerio.Element): string {
  const $cell = $(element).clone();

  $cell.find("style, script, .reference, sup, .mw-editsection").remove();
  $cell.find("br").replaceWith("\n");

  const text = $cell
    .text()
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" / ")
    .replace(/\s+/g, " ")
    .trim();

  return text;
}

function tableToMarkdown(headers: string[], rows: string[][]): string {
  const width = Math.max(headers.length, ...rows.map((row) => row.length));
  const headerRow = headers.length
    ? headers
    : Array.from({ length: width }, (_, idx) => `Column ${idx + 1}`);
  const normalizedRows = rows.map((row) =>
    row.length === width ? row : [...row, ...Array(width - row.length).fill("")]
  );

  const escapePipes = (value: string) => value.replace(/\|/g, "\\|");

  const headerLine = `| ${headerRow.map(escapePipes).join(" | ")} |`;
  const separatorLine = `| ${headerRow.map(() => "---").join(" | ")} |`;
  const rowLines = normalizedRows.map((row) => `| ${row.map(escapePipes).join(" | ")} |`);

  return [headerLine, separatorLine, ...rowLines].join("\n");
}

function extractTables($: cheerio.CheerioAPI): ExtractedTable[] {
  const contentTables = $("#mw-content-text table");
  console.log(`ℹ️  Found ${contentTables.length} tables in #mw-content-text.`);

  const tables = contentTables
    .filter((_, el) => {
      const $el = $(el);
      const className = ($el.attr("class") ?? "").toLowerCase();
      if ($el.closest(".navbox, .portable-infobox, .toc").length) return false;
      if (/infobox|navbox|metadata|maptable/.test(className)) return false;
      const hasHeader = $el.find("th").length > 0;
      const hasRows = $el.find("tr").length > 1;
      return hasHeader && hasRows;
    })
    .toArray();

  console.log(`ℹ️  Keeping ${tables.length} data tables after filtering.`);

  const extracted: ExtractedTable[] = [];

  tables.forEach((tableEl, index) => {
    const $table = $(tableEl);
    const caption = $table.find("caption").first().text().trim();

    const headerRow = $table
      .find("tr")
      .filter((_, tr) => $(tr).find("th").length > 0)
      .first();
    const headers = headerRow.length
      ? headerRow
          .find("th")
          .map((_, th) => cleanCellText($, th))
          .get()
          .filter(Boolean)
      : [];

    const rows = $table
      .find("tr")
      .toArray()
      .map((tr) => {
        const cells = $(tr).find("td");
        if (!cells.length) return null;
        const row = cells
          .toArray()
          .map((td) => cleanCellText($, td))
          .map((value) => value || "");
        return row.every((value) => !value.trim()) ? null : row;
      })
      .filter((row): row is string[] => Array.isArray(row) && row.length > 0);

    if (!rows.length) return;

    const markdown = tableToMarkdown(headers, rows);
    const tableId = $table.attr("id")?.trim();
    extracted.push({
      title: caption || tableId || `Table ${index + 1}`,
      markdown
    });
  });

  return extracted;
}

async function main() {
  console.log(`🔎 Fetching tables from ${SOURCE_URL}...`);
  const response = await fetch(SOURCE_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch page: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const tables = extractTables($);

  if (!tables.length) {
    throw new Error("No data tables were found on the page.");
  }

  const output = [
    "# Grow a Garden crops data",
    `Source: ${SOURCE_URL}`,
    `Generated: ${new Date().toISOString()}`,
    "",
    ...tables.flatMap((table) => [`## ${table.title}`, table.markdown, ""])
  ].join("\n");

  await fs.writeFile(OUTPUT_FILE, output, "utf8");
  console.log(`✅ Saved ${tables.length} tables to ${OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error("❌ scrape-grow-a-garden-crops failed:", error);
  process.exit(1);
});
