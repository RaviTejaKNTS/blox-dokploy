/**
 * Fetches the latest ads.txt entries managed by Ezoic and writes them to the public directory.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_EZOIC_ADS_TXT_URL = "https://srv.adstxtmanager.com/19390/bloxodes.com";
const EZOIC_ADS_TXT_URL = (process.env.EZOIC_ADS_TXT_URL ?? DEFAULT_EZOIC_ADS_TXT_URL).trim();
const OUTPUT_DIR = path.resolve(process.cwd(), "public");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "ads.txt");

async function main() {
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

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_PATH, `${content}\n`, "utf8");
  console.info(`ads.txt refreshed with ${content.split("\n").length} entries from Ezoic.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
