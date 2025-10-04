import { NextResponse } from "next/server";
import { listGamesWithActiveCounts } from "@/lib/db";

export async function GET() {
  try {
    const games = await listGamesWithActiveCounts();
    const payload = games.map((game) => ({
      id: game.id,
      name: game.name,
      slug: game.slug,
      activeCount: game.active_count ?? 0,
      lastUpdated: game.latest_code_first_seen_at ?? game.updated_at
    }));

    return NextResponse.json({ games: payload });
  } catch (error) {
    console.error("Failed to load games for search", error);
    return NextResponse.json({ error: "Failed to load search data" }, { status: 500 });
  }
}

