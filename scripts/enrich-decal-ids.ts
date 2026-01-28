import * as fs from 'fs/promises';
import * as path from 'path';

const USER_AGENT = 'BloxodesDecalEnricher/1.0';
const REQUEST_DELAY_MS = 800; // Time between requests
const BATCH_SAVE_SIZE = 25; // Save to disk after this many

interface DecalData {
    id: string;
    page: number;
}

interface EnrichedDecalData extends DecalData {
    name?: string;
    description?: string;
    creator?: {
        id: number;
        name: string;
        type: string;
    };
    assetType?: string;
    created?: string;
    updated?: string;
    isForSale?: boolean;
    priceInRobux?: number;
    sales?: number;
    productId?: number;
    isPublicDomain?: boolean;
    isLimited?: boolean;
    isLimitedUnique?: boolean;
    remaining?: number;
    minimumMembershipLevel?: number;
    contentRatingTypeId?: number;
    thumbnail?: string;
    error?: string;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url: string, maxRetries = 5): Promise<Response | null> {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });

            if (response.status === 429) {
                // Rate limited - wait progressively longer
                const waitTime = 3000 * Math.pow(1.5, i);
                console.log(`    ⚠️  Rate limited (attempt ${i + 1}/${maxRetries}), waiting ${Math.round(waitTime / 1000)}s...`);
                await sleep(waitTime);
                continue;
            }

            return response;
        } catch (err) {
            if (i === maxRetries - 1) {
                console.log(`    ❌ Network error after ${maxRetries} attempts`);
                return null;
            }
            await sleep(2000);
        }
    }
    return null;
}

async function fetchAssetInfo(assetId: string) {
    const res = await fetchWithRetry(`https://economy.roblox.com/v2/assets/${assetId}/details`);
    if (!res) return undefined;
    if (!res.ok) return res.status === 404 ? null : undefined;
    try {
        return await res.json();
    } catch {
        return undefined;
    }
}

async function fetchThumbnail(assetId: string) {
    const res = await fetchWithRetry(`https://thumbnails.roblox.com/v1/assets?assetIds=${assetId}&size=420x420&format=Png`);
    if (!res || !res.ok) return null;
    try {
        const data = await res.json();
        return data?.data?.[0]?.imageUrl || null;
    } catch {
        return null;
    }
}

async function processItem(decal: DecalData): Promise<EnrichedDecalData> {
    const result: EnrichedDecalData = { ...decal };

    // Fetch asset info first
    const info = await fetchAssetInfo(decal.id);

    if (info) {
        result.name = info.Name;
        result.description = info.Description;
        result.creator = info.Creator ? {
            id: info.Creator.Id,
            name: info.Creator.Name,
            type: info.Creator.CreatorType,
        } : undefined;
        result.assetType = info.AssetTypeId?.toString();
        result.created = info.Created;
        result.updated = info.Updated;
        result.isForSale = info.IsForSale;
        result.priceInRobux = info.PriceInRobux ?? undefined;
        result.sales = info.Sales;
        result.productId = info.ProductId;

        // Small delay before thumbnail
        await sleep(200);
        const thumbUrl = await fetchThumbnail(decal.id);
        if (thumbUrl) result.thumbnail = thumbUrl;

    } else if (info === null) {
        result.error = "Deleted/Private";
    } else {
        result.error = "Fetch Error";
    }

    return result;
}

async function main() {
    const dataDir = path.join(process.cwd(), 'data', 'decal-ids');
    await fs.mkdir(dataDir, { recursive: true });

    const enrichedPath = path.join(dataDir, 'enriched-decal-ids.json');
    const inputPath = path.join(dataDir, 'decal-ids.json');

    // Load input
    const allDecals: DecalData[] = JSON.parse(await fs.readFile(inputPath, 'utf-8'));

    // Load existing (Resume logic)
    let enrichedData: EnrichedDecalData[] = [];
    try {
        const existing = await fs.readFile(enrichedPath, 'utf-8');
        enrichedData = JSON.parse(existing);
        console.log(`📂 Loaded ${enrichedData.length} previously enriched decals.`);
    } catch {
        console.log("📂 No previous data found. Starting fresh.");
    }

    // Determine what's left
    const processedIds = new Set(enrichedData.map(d => d.id));
    const remaining = allDecals.filter(d => !processedIds.has(d.id));

    console.log(`\n📊 Total: ${allDecals.length} | Processed: ${enrichedData.length} | Remaining: ${remaining.length}\n`);

    if (remaining.length === 0) {
        console.log("✅ All done! No items left to process.");
        return;
    }

    // Save helper
    const save = async () => {
        await fs.writeFile(enrichedPath, JSON.stringify(enrichedData, null, 2));

        // CSV
        const csvPath = path.join(dataDir, 'enriched-decal-ids.csv');
        const header = 'id,name,creator,sales,price,created,error\n';
        const rows = enrichedData.map(d => {
            const clean = (s?: string) => `"${(s || '').replace(/"/g, '""')}"`;
            return `${d.id},${clean(d.name)},${clean(d.creator?.name)},${d.sales || 0},${d.priceInRobux || 0},${d.created || ''},${clean(d.error)}`;
        }).join('\n');
        await fs.writeFile(csvPath, header + rows);
    };

    console.log(`🚀 Processing sequentially with ${REQUEST_DELAY_MS}ms delay between requests...\n`);

    // Process ONE AT A TIME to avoid rate limits
    for (let i = 0; i < remaining.length; i++) {
        const decal = remaining[i];

        const enriched = await processItem(decal);
        enrichedData.push(enriched);

        const status = enriched.error
            ? `❌ ${enriched.error}`
            : `✓ ${enriched.name?.substring(0, 30)}...`;
        console.log(`[${i + 1}/${remaining.length}] ${decal.id} ${status}`);

        // Save periodically
        if ((i + 1) % BATCH_SAVE_SIZE === 0) {
            await save();
            console.log(`💾 Saved progress (${enrichedData.length} total)\n`);
        }

        // Wait before next request
        if (i < remaining.length - 1) {
            await sleep(REQUEST_DELAY_MS);
        }
    }

    await save();

    const successful = enrichedData.filter(d => !d.error).length;
    const failed = enrichedData.filter(d => d.error).length;

    console.log("\n✅ Enrichment Complete!");
    console.log(`   Total: ${enrichedData.length}`);
    console.log(`   Successful: ${successful}`);
    console.log(`   Failed: ${failed}`);
}

main().catch(console.error);
