import { unstable_cache } from "next/cache";
import { renderMarkdown } from "@/lib/markdown";
import { supabaseAdmin } from "@/lib/supabase";

export type CommentAuthor = {
  id: string;
  display_name: string | null;
  roblox_avatar_url: string | null;
  roblox_display_name: string | null;
  roblox_username: string | null;
  role: "admin" | "user" | null;
};

export type CommentEntry = {
  id: string;
  parent_id: string | null;
  body_md: string;
  body_html: string;
  status: "pending" | "approved" | "rejected" | "deleted";
  created_at: string;
  created_label: string;
  author: CommentAuthor;
};

export type CommentRow = {
  id: string;
  parent_id: string | null;
  body_md: string | null;
  status: CommentEntry["status"];
  created_at: string;
  author_id: string | null;
  guest_name: string | null;
  author: {
    display_name: string | null;
    roblox_avatar_url: string | null;
    roblox_display_name: string | null;
    roblox_username: string | null;
    role: "admin" | "user" | null;
  } | null;
};

const COMMENTS_REVALIDATE_SECONDS = 3600;
const COMMENT_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric"
});

export function getCommentsTag(entityType: string, entityId: string) {
  return `comments:${entityType}:${entityId}`;
}

function formatCommentDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return COMMENT_DATE_FORMATTER.format(date);
}

function normalizeAuthor(row: CommentRow): CommentAuthor {
  return {
    id: row.author_id ?? `guest:${row.id}`,
    display_name: row.author?.display_name ?? row.guest_name ?? "Guest",
    roblox_avatar_url: row.author?.roblox_avatar_url ?? null,
    roblox_display_name: row.author?.roblox_display_name ?? null,
    roblox_username: row.author?.roblox_username ?? null,
    role: row.author?.role ?? null
  };
}

export async function toCommentEntry(row: CommentRow): Promise<CommentEntry> {
  const body_md = row.body_md ?? "";
  const body_html = await renderMarkdown(body_md);
  return {
    id: row.id,
    parent_id: row.parent_id ?? null,
    body_md,
    body_html,
    status: row.status,
    created_at: row.created_at,
    created_label: formatCommentDate(row.created_at),
    author: normalizeAuthor(row)
  };
}

async function fetchApprovedComments(entityType: string, entityId: string): Promise<CommentEntry[]> {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("comments")
      .select(
        "id, parent_id, body_md, status, created_at, author_id, guest_name, author:app_users(display_name, roblox_avatar_url, roblox_display_name, roblox_username, role)"
      )
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .eq("status", "approved")
      .order("created_at", { ascending: true })
      .limit(200);

    if (error || !data?.length) {
      if (error) {
        console.error("Error fetching comments", error);
      }
      return [];
    }

    const rows = (data ?? []) as unknown as Array<
      CommentRow & { author?: CommentRow["author"] | CommentRow["author"][] | null }
    >;
    const normalizedRows = rows.map((row) => ({
      ...row,
      author: Array.isArray(row.author) ? (row.author[0] ?? null) : (row.author ?? null)
    })) as CommentRow[];

    return Promise.all(normalizedRows.map((row) => toCommentEntry(row)));
  } catch (error) {
    console.error("Error fetching comments", error);
    return [];
  }
}

export async function getApprovedComments(entityType: string, entityId: string): Promise<CommentEntry[]> {
  const cached = unstable_cache(
    async () => fetchApprovedComments(entityType, entityId),
    [`comments:${entityType}:${entityId}`],
    {
      revalidate: COMMENTS_REVALIDATE_SECONDS,
      tags: [getCommentsTag(entityType, entityId)]
    }
  );

  return cached();
}
