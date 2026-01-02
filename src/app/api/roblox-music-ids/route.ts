import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { normalizeSearchQuery, normalizeSortKey, type MusicSortKey } from "@/lib/music-ids-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;
const MUSIC_SOURCE_VIEW = "roblox_music_ids_ranked_view";
const SELECT_FIELDS =
  "asset_id, title, artist, album, genre, duration_seconds, album_art_asset_id, thumbnail_url, rank, source, last_seen_at";

type MusicQuery = ReturnType<ReturnType<typeof supabaseAdmin>["from"]>;

function buildLoosePattern(value: string): string {
  const cleaned = value.replace(/[%_]/g, " ").trim();
  const pattern = cleaned.replace(/[^a-z0-9]+/gi, "%").replace(/%{2,}/g, "%");
  return `%${pattern}%`;
}

function normalizePage(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.floor(parsed);
}

function applySort(query: MusicQuery, sort: MusicSortKey) {
  switch (sort) {
    case "popular":
      return query
        .order("popularity_score", { ascending: false, nullsFirst: false })
        .order("last_seen_at", { ascending: false, nullsFirst: false });
    case "newest":
      return query.order("last_seen_at", { ascending: false, nullsFirst: false });
    case "duration_desc":
      return query
        .order("duration_seconds", { ascending: false, nullsFirst: false })
        .order("popularity_score", { ascending: false, nullsFirst: false });
    case "duration_asc":
      return query
        .order("duration_seconds", { ascending: true, nullsFirst: false })
        .order("popularity_score", { ascending: false, nullsFirst: false });
    case "title_asc":
      return query.order("title", { ascending: true, nullsFirst: false });
    case "artist_asc":
      return query.order("artist", { ascending: true, nullsFirst: false });
    case "recommended":
    default:
      return query
        .order("duration_bucket", { ascending: true, nullsFirst: false })
        .order("popularity_score", { ascending: false, nullsFirst: false })
        .order("duration_seconds", { ascending: false, nullsFirst: false })
        .order("rank", { ascending: true, nullsFirst: false })
        .order("last_seen_at", { ascending: false, nullsFirst: false });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = normalizePage(searchParams.get("page"));
  const search = normalizeSearchQuery(searchParams.get("q"));
  const sort = normalizeSortKey(searchParams.get("sort"));
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = supabaseAdmin();
  let query = supabase.from(MUSIC_SOURCE_VIEW).select(SELECT_FIELDS, { count: "exact" });

  if (search) {
    const pattern = buildLoosePattern(search);
    const orParts = [
      `title.ilike.${pattern}`,
      `artist.ilike.${pattern}`,
      `album.ilike.${pattern}`,
      `genre.ilike.${pattern}`
    ];
    if (/^\d+$/.test(search)) {
      orParts.unshift(`asset_id.eq.${search}`);
    }
    query = query.or(orParts.join(","));
  }

  query = applySort(query, sort);

  const { data, error, count } = await query.range(offset, offset + PAGE_SIZE - 1);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const total = count ?? data?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return NextResponse.json({
    ok: true,
    songs: data ?? [],
    total,
    totalPages
  });
}
