import { chromium } from 'playwright';
import * as fs from 'fs/promises';
import * as path from 'path';

interface DecalData {
    id: string;
    page: number;
}

async function scrapeDecalIDs() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const allDecals: DecalData[] = [];
    const totalPages = 47;

    console.log(`Starting to scrape ${totalPages} pages...`);

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        let retries = 3;
        let success = false;

        while (retries > 0 && !success) {
            try {
                const url = pageNum === 1
                    ? 'https://robloxden.com/decal-ids'
                    : `https://robloxden.com/decal-ids/${pageNum}`;

                console.log(`Scraping page ${pageNum}/${totalPages}: ${url} (${4 - retries}/3)`);

                // Use domcontentloaded instead of networkidle for faster, more reliable loading
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

                // Wait for the decal containers to load
                await page.waitForSelector('.string-container.svelte-1ybxx10', { timeout: 15000 });

                // Extract all decal IDs from the page
                const ids = await page.evaluate(() => {
                    const elements = document.querySelectorAll('.string-container.svelte-1ybxx10');
                    return Array.from(elements).map(el => el.textContent?.trim() || '');
                });

                // Add to our collection
                ids.forEach(id => {
                    if (id) {
                        allDecals.push({ id, page: pageNum });
                    }
                });

                console.log(`  ✓ Found ${ids.length} decals on page ${pageNum}`);
                success = true;

                // Small delay to be polite to the server
                await page.waitForTimeout(1000);

            } catch (error) {
                retries--;
                console.error(`  ✗ Error scraping page ${pageNum} (${retries} retries left):`, error instanceof Error ? error.message : error);

                if (retries > 0) {
                    console.log(`  ↻ Retrying page ${pageNum}...`);
                    await page.waitForTimeout(2000);
                }
            }
        }

        if (!success) {
            console.error(`  ✗ Failed to scrape page ${pageNum} after all retries`);
        }
    }

    await browser.close();

    console.log(`\n✓ Total decals scraped: ${allDecals.length}`);

    // Save to JSON file
    const outputPath = path.join(process.cwd(), 'data', 'decal-ids', 'decal-ids.json');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(allDecals, null, 2));
    console.log(`✓ Saved to: ${outputPath}`);

    // Also save just the IDs as a simple array
    const idsOnlyPath = path.join(process.cwd(), 'data', 'decal-ids', 'decal-ids-only.json');
    await fs.writeFile(idsOnlyPath, JSON.stringify(allDecals.map(d => d.id), null, 2));
    console.log(`✓ Saved IDs only to: ${idsOnlyPath}`);

    // Save as CSV for easy viewing
    const csvPath = path.join(process.cwd(), 'data', 'decal-ids', 'decal-ids.csv');
    const csvContent = 'id,page\n' + allDecals.map(d => `${d.id},${d.page}`).join('\n');
    await fs.writeFile(csvPath, csvContent);
    console.log(`✓ Saved CSV to: ${csvPath}`);

    return allDecals;
}

// Run the scraper
scrapeDecalIDs()
    .then((decals) => {
        console.log('\n✅ Scraping complete!');
        console.log(`Total decals collected: ${decals.length}`);
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Scraping failed:', error);
        process.exit(1);
    });
