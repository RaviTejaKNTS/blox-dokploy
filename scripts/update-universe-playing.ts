import "dotenv/config";
import { supabaseAdmin } from "@/lib/supabase-admin";

const GAME_DETAILS_API = "https://games.roblox.com/v1/games";
const BATCH_SIZE = Number(process.env.UNIVERSE_PLAYING_BATCH_SIZE ?? "50");

type RobloxGameDetail = {
  id: number;
  playing?: number;
  playerCount?: number;
};

type UniverseRow = { universe_id: number; root_place_id: number | null };

async function fetchUniverses(): Promise<UniverseRow[]> {
  const sb = supabaseAdmin();
  const rows: UniverseRow[] = [];
  let from = 0;
  while (true) {
    const to = from + BATCH_SIZE - 1;
    const { data, error } = await sb
      .from("roblox_universes")
      .select("universe_id, root_place_id")
      .not("root_place_id", "is", null)
      .order("universe_id", { ascending: true })
      .range(from, to);
    if (error) throw error;
    const chunk = (data ?? []) as UniverseRow[];
    rows.push(...chunk);
    if (chunk.length < BATCH_SIZE) break;
    from += BATCH_SIZE;
  }
  return rows;
}

async function fetchPlaying(universeIds: number[]): Promise<Record<number, number | null>> {
  const result: Record<number, number | null> = {};
  if (!universeIds.length) return result;
  const params = new URLSearchParams({ universeIds: universeIds.join(",") });
  const res = await fetch(`${GAME_DETAILS_API}?${params.toString()}`, {
    headers: { "user-agent": "BloxodesBot/1.0" }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch game details (${res.status})`);
  }
  const data = await res.json();
  const entries: RobloxGameDetail[] = Array.isArray(data?.data) ? data.data : [];
  for (const entry of entries) {
    if (typeof entry?.id !== "number") continue;
    const playing = entry.playing ?? entry.playerCount ?? null;
    result[entry.id] = typeof playing === "number" ? playing : null;
  }
  return result;
}

async function updatePlaying(chunk: UniverseRow[], values: Record<number, number | null>) {
  const sb = supabaseAdmin();
  for (const row of chunk) {
    const playing = values[row.universe_id] ?? null;
    const { error } = await sb
      .from("roblox_universes")
      .update({ playing })
      .eq("universe_id", row.universe_id)
      .limit(1);
    if (error) {
      throw new Error(`Failed to update playing for ${row.universe_id}: ${error.message}`);
    }
  }
}

async function main() {
  const universes = (await fetchUniverses()).filter(
    (row) => typeof row.universe_id === "number" && row.root_place_id !== null
  );
  if (!universes.length) {
    console.log("No universes found.");
    return;
  }

  console.log(`Updating playing for ${universes.length} universes...`);
  for (let i = 0; i < universes.length; i += BATCH_SIZE) {
    const chunk = universes.slice(i, i + BATCH_SIZE);
    const ids = chunk.map((row) => row.universe_id);
    try {
      const playingMap = await fetchPlaying(ids);
      await updatePlaying(chunk, playingMap);
      console.log(`  • Updated chunk ${i / BATCH_SIZE + 1} (${chunk.length} universes)`);
    } catch (error) {
      console.error(`Chunk ${i / BATCH_SIZE + 1} failed:`, (error as Error).message);
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
