import { NextResponse } from "next/server";
import { listFreeItems } from "@/lib/db";
import { normalizeSearchQuery, normalizeSortKey } from "@/lib/free-items-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

function normalizePage(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.floor(parsed);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = normalizePage(searchParams.get("page"));
    const search = normalizeSearchQuery(searchParams.get("q"));
    const sort = normalizeSortKey(searchParams.get("sort"));
    const category = searchParams.get("category")?.trim() || undefined;
    const subcategory = searchParams.get("subcategory")?.trim() || undefined;

    const { items, total } = await listFreeItems(page, PAGE_SIZE, {
      search,
      sort,
      category,
      subcategory
    });

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return NextResponse.json({
      ok: true,
      items,
      total,
      totalPages
    });
  } catch (error) {
    console.error("Failed to load free items", error);
    return NextResponse.json({ ok: false, error: "Failed to load free items" }, { status: 500 });
  }
}
