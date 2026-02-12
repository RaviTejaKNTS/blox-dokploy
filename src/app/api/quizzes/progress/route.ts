import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session-user";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const MAX_QUESTION_IDS = 5000;

function normalizeCode(value: string | null): string {
  if (!value) return "";
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed.length > 200) return "";
  return trimmed;
}

function normalizeQuestionIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
    if (result.length >= MAX_QUESTION_IDS) break;
  }
  return result;
}

function normalizeScore(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.floor(value));
}

function normalizeBreakdown(value: unknown): Record<string, { correct: number; total: number }> {
  if (!value || typeof value !== "object") return {};
  const result: Record<string, { correct: number; total: number }> = {};
  const levels = ["easy", "medium", "hard"] as const;
  for (const level of levels) {
    const entry = (value as Record<string, unknown>)[level];
    if (!entry || typeof entry !== "object") continue;
    const correctRaw = (entry as { correct?: unknown }).correct;
    const totalRaw = (entry as { total?: unknown }).total;
    const correct = typeof correctRaw === "number" && Number.isFinite(correctRaw) ? Math.max(0, Math.floor(correctRaw)) : 0;
    const total = typeof totalRaw === "number" && Number.isFinite(totalRaw) ? Math.max(0, Math.floor(totalRaw)) : 0;
    result[level] = { correct, total };
  }
  return result;
}

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = supabaseAdmin();
    const url = new URL(request.url);
    const code = normalizeCode(url.searchParams.get("code"));

    if (code) {
      const { data, error } = await admin
        .from("user_quiz_progress")
        .select("seen_question_ids, last_score, last_total, last_breakdown, last_attempt_at")
        .eq("user_id", user.id)
        .eq("quiz_code", code)
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: "Unable to load quiz progress." }, { status: 500 });
      }

      const row = data as {
        seen_question_ids?: unknown;
        last_score?: number | null;
        last_total?: number | null;
        last_breakdown?: unknown;
        last_attempt_at?: string | null;
      } | null;

      const seenQuestionIds = normalizeQuestionIds(row?.seen_question_ids);
      const lastScore = typeof row?.last_score === "number" ? row.last_score : null;
      const lastTotal = typeof row?.last_total === "number" ? row.last_total : null;
      const lastBreakdown = normalizeBreakdown(row?.last_breakdown);
      const lastAttemptAt = typeof row?.last_attempt_at === "string" ? row.last_attempt_at : null;

      return NextResponse.json(
        { seenQuestionIds, lastScore, lastTotal, lastBreakdown, lastAttemptAt },
        { headers: { "Cache-Control": "private, no-store, max-age=0" } }
      );
    }

    const { data, error } = await admin
      .from("user_quiz_progress")
      .select("quiz_code, seen_question_ids, last_score, last_total")
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: "Unable to load quiz progress." }, { status: 500 });
    }

    const progress = (data ?? [])
      .map((row) => {
        const seenQuestionIds = normalizeQuestionIds((row as { seen_question_ids?: unknown } | null)?.seen_question_ids);
        const quizCode = typeof (row as { quiz_code?: unknown } | null)?.quiz_code === "string"
          ? String((row as { quiz_code?: unknown } | null)?.quiz_code).trim()
          : "";
        if (!quizCode) return null;
        return {
          code: quizCode,
          seenCount: seenQuestionIds.length,
          lastScore: typeof (row as { last_score?: unknown }).last_score === "number" ? (row as { last_score?: number }).last_score : null,
          lastTotal: typeof (row as { last_total?: unknown }).last_total === "number" ? (row as { last_total?: number }).last_total : null
        };
      })
      .filter(Boolean);

    return NextResponse.json(
      { progress },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("Failed to load quiz progress", error);
    return NextResponse.json({ error: "Unable to load quiz progress." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = supabaseAdmin();
    const payload = await request.json().catch(() => ({}));
    const code = normalizeCode(payload?.code ?? null);
    const seenQuestionIds = normalizeQuestionIds(payload?.questionIds);
    const score = normalizeScore(payload?.score);
    const total = normalizeScore(payload?.total);
    const breakdown = normalizeBreakdown(payload?.breakdown);

    if (!code) {
      return NextResponse.json({ error: "Quiz code is required." }, { status: 400 });
    }

    if (seenQuestionIds.length === 0) {
      const { error } = await admin
        .from("user_quiz_progress")
        .delete()
        .eq("user_id", user.id)
        .eq("quiz_code", code);

      if (error) {
        return NextResponse.json({ error: "Unable to clear quiz progress." }, { status: 500 });
      }

      return NextResponse.json({ seenQuestionIds: [] });
    }

    const { error } = await admin
      .from("user_quiz_progress")
      .upsert(
        {
          user_id: user.id,
          quiz_code: code,
          seen_question_ids: seenQuestionIds,
          last_score: score,
          last_total: total,
          last_breakdown: breakdown,
          last_attempt_at: new Date().toISOString()
        },
        { onConflict: "user_id,quiz_code" }
      );

    if (error) {
      return NextResponse.json({ error: "Unable to save quiz progress." }, { status: 500 });
    }

    return NextResponse.json({ seenQuestionIds });
  } catch (error) {
    console.error("Failed to save quiz progress", error);
    return NextResponse.json({ error: "Unable to save quiz progress." }, { status: 500 });
  }
}
