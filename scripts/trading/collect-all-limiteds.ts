/**
 * Collect ALL Limited Items (Classic + UGC)
 * 
 * Part A: Classic Limiteds from Rolimons (~2,500 items)
 * Part B: UGC Limiteds from Roblox Catalog (~100K items)
 */

import "dotenv/config";
import { supabaseAdmin } from "@/lib/supabase";

const REQUEST_DELAY_MS = 400;
const MAX_UGC_PAGES = parseInt(process.env.MAX_UGC_PAGES || "10000"); // ~300K items (30 per page)

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function collectClassicLimiteds() {
    console.log('\n📦 Part A: Collecting Classic Limiteds from Rolimons...');

    const response = await fetch('https://www.rolimons.com/itemapi/itemdetails');
    const data = await response.json();

    if (!data.success || !data.items) {
        throw new Error('Failed to fetch from Rolimons');
    }

    console.log(`   Found ${data.item_count} classic Limited items`);

    const items = Object.entries(data.items).map(([id, info]: [string, any]) => ({
        asset_id: parseInt(id),
        name: info[0],
        item_type: 'Asset',
        is_limited: true,
        limited_type: 'classic', // Flag for classic vs UGC
        last_seen_at: new Date().toISOString(),
        is_deleted: false,
        raw_catalog_json: {}
    }));

    const sb = supabaseAdmin();
    const { error } = await sb
        .from('roblox_catalog_items')
        .upsert(items, {
            onConflict: 'asset_id',
            ignoreDuplicates: false
        });

    if (error) throw error;

    console.log(`   ✅ Inserted ${items.length} classic Limiteds\n`);
    return items.length;
}

async function collectUGCLimiteds() {
    console.log('📦 Part B: Collecting UGC Limiteds from Roblox...');

    const sb = supabaseAdmin();
    let cursor: string | null = null;
    let page = 0;
    let totalCollected = 0;

    do {
        page++;
        console.log(`   Page ${page}...`);

        const params = new URLSearchParams({
            limit: '30', // Valid: 10, 28, 30
            salesTypeFilter: '3' // UGC Limiteds
        });
        if (cursor) params.set('cursor', cursor);

        const response = await fetch(
            `https://catalog.roblox.com/v1/search/items/details?${params.toString()}`
        );

        if (!response.ok) {
            console.error(`   ❌ Error: ${response.status}`);
            break;
        }

        const data = await response.json();

        if (!data.data || data.data.length === 0) {
            console.log('   No more items');
            break;
        }

        // Save ALL UGC items (not just tradeable - for free items catalog, etc.)
        const itemsToSave = data.data
            .filter((item: any) =>
                item.collectibleItemId &&
                item.itemType === 'Asset' && // Only assets, not bundles
                typeof item.id === 'number' // Must have numeric asset ID
            )
            .map((item: any) => ({
                asset_id: item.id,
                name: item.name || null,
                item_type: item.itemType || 'Asset',
                asset_type_id: item.assetType || null,
                description: item.description || null,
                is_limited: false, // Not necessarily tradeable Limited
                limited_type: 'ugc', // Flag as UGC collectible
                collectible_item_id: item.collectibleItemId,
                price_robux: item.price || null,
                lowest_resale_price_robux: item.lowestResalePrice || null,
                has_resellers: item.hasResellers || false,
                creator_name: item.creatorName || null,
                creator_type: item.creatorType || null,
                creator_target_id: item.creatorTargetId || null,
                favorite_count: item.favoriteCount || null,
                last_seen_at: new Date().toISOString(),
                is_deleted: false,
                raw_catalog_json: item
            }));

        if (itemsToSave.length > 0) {
            const { error } = await sb
                .from('roblox_catalog_items')
                .upsert(itemsToSave, {
                    onConflict: 'asset_id',
                    ignoreDuplicates: false
                });

            if (error) {
                console.error(`   ❌ Error saving: ${error.message}`);
            } else {
                totalCollected += itemsToSave.length;
                const tradeableCount = itemsToSave.filter((i: any) => i.has_resellers).length;
                console.log(`   ✅ Saved ${itemsToSave.length} items (${tradeableCount} tradeable) - Total: ${totalCollected.toLocaleString()}`);
            }
        }

        cursor = data.nextPageCursor;

        if (page >= MAX_UGC_PAGES) {
            console.log(`\n   ⏹️  Reached max pages (${MAX_UGC_PAGES})`);
            break;
        }

        if (cursor) {
            await sleep(REQUEST_DELAY_MS);
        }

    } while (cursor);

    console.log(`   ✅ Collected ${totalCollected} UGC Limiteds\n`);
    return totalCollected;
}

async function main() {
    console.log('🎯 Collecting ALL Limited Items\n');
    console.log('='.repeat(60));

    try {
        const classicCount = await collectClassicLimiteds();
        const ugcCount = await collectUGCLimiteds();

        console.log('='.repeat(60));
        console.log('✅ COLLECTION COMPLETE');
        console.log('='.repeat(60));
        console.log(`Classic Limiteds: ${classicCount.toLocaleString()}`);
        console.log(`UGC Limiteds: ${ugcCount.toLocaleString()}`);
        console.log(`Total: ${(classicCount + ugcCount).toLocaleString()}`);
        console.log('\n💡 Next: Run npm run trading:fetch-rap');

    } catch (error) {
        console.error('\n❌ Error:', error instanceof Error ? error.message : String(error));
        throw error;
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
