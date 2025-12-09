import { NextResponse } from "next/server";
import {
  listGamesWithActiveCounts,
  listPublishedArticles,
  listPublishedChecklists,
  listPublishedGameLists
} from "@/lib/db";
import { listPublishedTools } from "@/lib/tools";

export async function GET() {
  try {
    const [games, articles, checklists, lists, tools] = await Promise.all([
      listGamesWithActiveCounts(),
      listPublishedArticles(200),
      listPublishedChecklists(),
      listPublishedGameLists(),
      listPublishedTools()
    ]);

    const items = [
      ...(games ?? []).map((game) => ({
        id: `game-${game.id}`,
        title: game.name,
        subtitle: "Codes",
        url: `/codes/${game.slug}`,
        type: "codes",
        updatedAt: game.content_updated_at ?? game.updated_at ?? null,
        badge: `${game.active_count ?? 0} active`
      })),
      ...(articles ?? []).map((article) => ({
        id: `article-${article.id}`,
        title: article.title,
        subtitle: "Article",
        url: `/articles/${article.slug}`,
        type: "article",
        updatedAt: article.updated_at ?? article.published_at ?? null
      })),
      ...(checklists ?? []).map((checklist) => ({
        id: `checklist-${checklist.id}`,
        title: checklist.title,
        subtitle: "Checklist",
        url: `/checklists/${checklist.slug}`,
        type: "checklist",
        updatedAt: checklist.content_updated_at ?? checklist.updated_at ?? null
      })),
      ...(lists ?? []).map((list) => ({
        id: `list-${list.id}`,
        title: list.display_name || list.title,
        subtitle: "List",
        url: `/lists/${list.slug}`,
        type: "list",
        updatedAt: list.updated_at ?? list.refreshed_at ?? null
      })),
      ...(tools ?? []).map((tool) => ({
        id: `tool-${tool.id ?? tool.code}`,
        title: tool.title,
        subtitle: "Tool",
        url: `/tools/${tool.code}`,
        type: "tool",
        updatedAt: tool.content_updated_at ?? tool.updated_at ?? tool.published_at ?? null
      }))
    ];

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Failed to load search data", error);
    return NextResponse.json({ error: "Failed to load search data" }, { status: 500 });
  }
}
