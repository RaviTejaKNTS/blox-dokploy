import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
);

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers });

    const body = await req.json().catch(() => ({}));
    const rawPlaceId = body?.robloxPlaceId;
    const placeId =
        typeof rawPlaceId === 'string' || typeof rawPlaceId === 'number'
            ? String(rawPlaceId).match(/\d+/)?.[0] ?? null
            : null;

    if (!placeId) return emptyPayload();

    const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('id,name,slug,updated_at')
        .ilike('roblox_link', `%${placeId}%`)
        .maybeSingle();

    if (gameError || !gameData) {
        if (gameError) console.error('game lookup failed', { placeId, gameError });
        return emptyPayload();
    }

    const { data: codesData, error: codesError } = await supabase
        .from('codes')
        .select('code,status,rewards_text,is_new,level_requirement,first_seen_at,last_seen_at')
        .eq('game_id', gameData.id)
        .eq('status', 'active')
        .order('first_seen_at', { ascending: false })
        .limit(9);

    if (codesError) {
        console.error('codes lookup failed', { gameId: gameData.id, codesError });
    }

    const { count: activeCountAll, error: activeCountError } = await supabase
        .from('codes')
        .select('id', { count: 'exact', head: true })
        .eq('game_id', gameData.id)
        .eq('status', 'active');

    if (activeCountError) {
        console.error('active count lookup failed', { gameId: gameData.id, activeCountError });
    }

    const codes = Array.isArray(codesData) ? codesData : [];
    const activeCount = typeof activeCountAll === 'number' ? activeCountAll : countActiveCodes(codes);
    const totalCodes = typeof activeCountAll === 'number' ? activeCountAll : codes.length;
    const activeCountDisplay = activeCount;

    return new Response(
        JSON.stringify({
            game: { name: gameData.name, slug: gameData.slug, updated_at: gameData.updated_at },
            codes: codes,
            totalCodes,
            activeCount: activeCountDisplay,
            siteBaseUrl: 'https://bloxodes.com'
        }),
        { status: 200, headers }
    );
});

function countActiveCodes(codes) {
    const normalize = (s) => (typeof s === 'string' ? s.trim().toLowerCase() : '');
    return codes.filter((c) => normalize(c.status) === 'active').length;
}

function emptyPayload() {
    return new Response(
        JSON.stringify({
            game: null,
            codes: [],
            totalCodes: 0,
            activeCount: 0,
            siteBaseUrl: 'https://bloxodes.com'
        }),
        { status: 200, headers }
    );
}
