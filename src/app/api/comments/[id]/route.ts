import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { getCommentsTag, toCommentEntry, type CommentRow } from "@/lib/comments";

export const dynamic = "force-dynamic";

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

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

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

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await context.params;
    const id = normalizeString(rawId);
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: "Invalid comment id." }, { status: 400 });
    }

    const payload = await request.json();
    const body = normalizeString(payload?.body);
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
      return NextResponse.json({ error: "You must be logged in to edit comments." }, { status: 401 });
    }

    const { data: updatedRow, error: updateError } = await supabase
      .from("comments")
      .update({
        body_md: body,
        status: "pending",
        moderation: null
      })
      .eq("id", id)
      .eq("author_id", user.id)
      .select("id, entity_type, entity_id")
      .maybeSingle();

    if (updateError || !updatedRow) {
      return NextResponse.json({ error: "Unable to update comment." }, { status: 403 });
    }

    const moderation = await runModeration(body);
    const moderationPayload = moderation ?? { error: "unavailable" };
    const approved = shouldApproveComment(moderation);
    const nextStatus = approved ? "approved" : "pending";

    const admin = supabaseAdmin();
    await admin.from("comments").update({ status: nextStatus, moderation: moderationPayload }).eq("id", id);

    const { data: commentRow, error: commentError } = await admin
      .from("comments")
      .select(
        "id, parent_id, body_md, status, created_at, author_id, guest_name, author:app_users(display_name, roblox_avatar_url, roblox_display_name, roblox_username, role)"
      )
      .eq("id", id)
      .maybeSingle();

    if (commentError || !commentRow) {
      return NextResponse.json({ error: "Unable to load comment." }, { status: 500 });
    }

    const normalizedRow = {
      ...commentRow,
      author: Array.isArray(commentRow.author) ? (commentRow.author[0] ?? null) : (commentRow.author ?? null)
    } as unknown as CommentRow;

    const comment = await toCommentEntry(normalizedRow);

    revalidateTag(getCommentsTag(updatedRow.entity_type, updatedRow.entity_id), { expire: 0 });

    return NextResponse.json({ comment });
  } catch (error) {
    console.error("Unhandled comment update error", error);
    return NextResponse.json({ error: "Unable to update comment." }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await context.params;
    const id = normalizeString(rawId);
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: "Invalid comment id." }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "You must be logged in to delete comments." }, { status: 401 });
    }

    const { data: commentRow } = await supabase
      .from("comments")
      .select("id, entity_type, entity_id, status")
      .eq("id", id)
      .eq("author_id", user.id)
      .maybeSingle();

    if (!commentRow) {
      return NextResponse.json({ error: "Comment not found." }, { status: 404 });
    }

    const { error: deleteError } = await supabase.from("comments").delete().eq("id", id).eq("author_id", user.id);
    if (deleteError) {
      return NextResponse.json({ error: "Unable to delete comment." }, { status: 500 });
    }

    revalidateTag(getCommentsTag(commentRow.entity_type, commentRow.entity_id), { expire: 0 });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Unhandled comment delete error", error);
    return NextResponse.json({ error: "Unable to delete comment." }, { status: 500 });
  }
}
