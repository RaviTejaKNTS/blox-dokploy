/**
 * Fetches the latest ads.txt entries managed by Ezoic and writes them to the public directory.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_EZOIC_ADS_TXT_URL = "https://srv.adstxtmanager.com/19390/bloxodes.com";
const EZOIC_ADS_TXT_URL = (process.env.EZOIC_ADS_TXT_URL ?? DEFAULT_EZOIC_ADS_TXT_URL).trim();
const OUTPUT_DIR = path.resolve(process.cwd(), "public");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "ads.txt");

function parseAdsLines(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function mergeAdsLines(primary: string[], secondary: string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const line of [...primary, ...secondary]) {
    if (!line) continue;
    if (seen.has(line)) continue;
    seen.add(line);
    merged.push(line);
  }
  return merged;
}

async function main() {
  let localContent = "";
  try {
    localContent = await readFile(OUTPUT_PATH, "utf8");
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== "ENOENT") {
      throw err;
    }
  }

  if (!EZOIC_ADS_TXT_URL) {
    console.warn("EZOIC_ADS_TXT_URL not specified; skipping ads.txt refresh.");
    return;
  }

  const response = await fetch(EZOIC_ADS_TXT_URL, { redirect: "follow" });

  if (!response.ok) {
    console.warn(
      `Skipping ads.txt refresh: ${EZOIC_ADS_TXT_URL} responded with ${response.status} ${response.statusText}`
    );
    return;
  }

  const content = (await response.text()).trim();

  if (!content) {
    console.warn("Skipping ads.txt refresh: received empty content from Ezoic.");
    return;
  }

  const localLines = parseAdsLines(localContent);
  const remoteLines = parseAdsLines(content);
  const mergedLines = mergeAdsLines(localLines, remoteLines);
  if (!mergedLines.length) {
    console.warn("Skipping ads.txt refresh: no valid ads.txt lines to write.");
    return;
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_PATH, `${mergedLines.join("\n")}\n`, "utf8");
  console.info(`ads.txt refreshed with ${mergedLines.length} entries (local + Ezoic).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
