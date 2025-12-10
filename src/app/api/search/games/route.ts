import { NextResponse } from "next/server";
import { listGamesWithActiveCounts } from "@/lib/db";

export const revalidate = 600;

export async function GET() {
  try {
    const games = await listGamesWithActiveCounts();
    const payload = games.map((game) => ({
      id: game.id,
      name: game.name,
      slug: game.slug,
      activeCount: game.active_count ?? 0,
      articleUpdated: game.content_updated_at ?? game.updated_at
    }));

    return NextResponse.json({ games: payload });
  } catch (error) {
    console.error("Failed to load games for search", error);
    return NextResponse.json({ error: "Failed to load search data" }, { status: 500 });
  }
}
