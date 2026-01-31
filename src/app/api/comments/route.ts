import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { getCommentsTag, toCommentEntry, type CommentRow } from "@/lib/comments";

export const dynamic = "force-dynamic";

const ALLOWED_ENTITY_TYPES = new Set(["code", "article", "catalog", "event", "list", "tool"]);
const MAX_BODY_LENGTH = 1000;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ModerationResult = {
  flagged?: boolean;
  categories?: Record<string, boolean>;
  category_scores?: Record<string, number>;
};

type ModerationResponse = {
  results?: ModerationResult[];
};

const CATEGORY_SCORE_THRESHOLDS: Record<string, number> = {
  sexual: 0.2,
  "sexual/minors": 0.01,
  harassment: 0.5,
  "harassment/threatening": 0.2,
  hate: 0.5,
  "hate/threatening": 0.2,
  violence: 0.5,
  "violence/graphic": 0.2,
  "self-harm": 0.5,
  "self-harm/intent": 0.2,
  "self-harm/instructions": 0.2,
  illicit: 0.5,
  "illicit/violent": 0.2
};

function isCategoryHit(categories?: Record<string, boolean>): boolean {
  if (!categories) return false;
  return Object.values(categories).some(Boolean);
}

function isScoreHit(scores?: Record<string, number>): boolean {
  if (!scores) return false;
  for (const [key, threshold] of Object.entries(CATEGORY_SCORE_THRESHOLDS)) {
    const score = scores[key];
    if (typeof score === "number" && score >= threshold) {
      return true;
    }
  }
  return false;
}

function shouldApproveComment(moderation: ModerationResponse | null): boolean {
  if (!moderation) return false;
  const result = moderation.results?.[0];
  if (!result) return false;
  const flagged = result.flagged === true;
  const categoryHit = isCategoryHit(result.categories);
  const scoreHit = isScoreHit(result.category_scores);
  return !(flagged || categoryHit || scoreHit);
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function runModeration(input: string): Promise<ModerationResponse | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const model = process.env.OPENAI_MODERATION_MODEL ?? "omni-moderation-latest";
  const res = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ model, input })
  });

  if (!res.ok) {
    const message = await res.text().catch(() => "");
    console.error("Moderation request failed", { status: res.status, message });
    return null;
  }

  return (await res.json()) as ModerationResponse;
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const entityType = normalizeString(payload?.entityType);
    const entityId = normalizeString(payload?.entityId);
    const parentId = normalizeString(payload?.parentId || "");
    const body = normalizeString(payload?.body);

    if (!ALLOWED_ENTITY_TYPES.has(entityType)) {
      return NextResponse.json({ error: "Invalid comment target." }, { status: 400 });
    }

    if (!UUID_REGEX.test(entityId)) {
      return NextResponse.json({ error: "Invalid comment target." }, { status: 400 });
    }

    if (!body) {
      return NextResponse.json({ error: "Comment cannot be empty." }, { status: 400 });
    }

    if (body.length > MAX_BODY_LENGTH) {
      return NextResponse.json({ error: `Comments must be ${MAX_BODY_LENGTH} characters or less.` }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "You must be logged in to comment." }, { status: 401 });
    }

    if (parentId) {
      const { data: parentRow } = await supabaseAdmin()
        .from("comments")
        .select("id, entity_type, entity_id")
        .eq("id", parentId)
        .maybeSingle();
      if (!parentRow || parentRow.entity_type !== entityType || parentRow.entity_id !== entityId) {
        return NextResponse.json({ error: "Invalid reply target." }, { status: 400 });
      }
    }

    const { data: inserted, error: insertError } = await supabase
      .from("comments")
      .insert({
        entity_type: entityType,
        entity_id: entityId,
        parent_id: parentId || null,
        author_id: user.id,
        body_md: body,
        status: "pending"
      })
      .select("id")
      .maybeSingle();

    if (insertError || !inserted?.id) {
      console.error("Failed to insert comment", insertError);
      return NextResponse.json({ error: "Unable to submit comment." }, { status: 500 });
    }

    const moderation = await runModeration(body);
    const moderationPayload = moderation ?? { error: "unavailable" };
    const approved = shouldApproveComment(moderation);
    const nextStatus = approved ? "approved" : "pending";

    const admin = supabaseAdmin();
    await admin
      .from("comments")
      .update({ status: nextStatus, moderation: moderationPayload })
      .eq("id", inserted.id);

    const { data: commentRow, error: commentError } = await admin
      .from("comments")
      .select(
        "id, parent_id, body_md, status, created_at, author_id, author:app_users(display_name, roblox_avatar_url, roblox_display_name, roblox_username, role)"
      )
      .eq("id", inserted.id)
      .maybeSingle();

    if (commentError || !commentRow) {
      console.error("Failed to load comment", commentError);
      return NextResponse.json({ error: "Unable to load comment." }, { status: 500 });
    }

    const normalizedRow = {
      ...commentRow,
      author: Array.isArray(commentRow.author) ? (commentRow.author[0] ?? null) : (commentRow.author ?? null)
    } as unknown as CommentRow;

    const comment = await toCommentEntry(normalizedRow);

    if (approved) {
      revalidateTag(getCommentsTag(entityType, entityId), { expire: 0 });
    }

    return NextResponse.json({ comment });
  } catch (error) {
    console.error("Unhandled comment error", error);
    return NextResponse.json({ error: "Unable to submit comment." }, { status: 500 });
  }
}
