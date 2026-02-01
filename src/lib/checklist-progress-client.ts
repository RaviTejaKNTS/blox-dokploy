"use client";

import { useEffect, useState } from "react";

type ChecklistSessionState = {
  status: "loading" | "ready";
  userId: string | null;
};

type ProgressIndexState = {
  status: "idle" | "loading" | "ready";
  userId: string | null;
  counts: Record<string, number>;
};

const SESSION_ENDPOINT = "/api/checklists/session";
const PROGRESS_ENDPOINT = "/api/checklists/progress";

let sessionState: ChecklistSessionState = { status: "loading", userId: null };
let sessionPromise: Promise<void> | null = null;
const sessionListeners = new Set<(state: ChecklistSessionState) => void>();
let sessionCheckedAt = 0;

let progressState: ProgressIndexState = { status: "idle", userId: null, counts: {} };
let progressPromise: Promise<void> | null = null;
const progressListeners = new Set<(state: ProgressIndexState) => void>();

function notifySession() {
  sessionListeners.forEach((listener) => listener(sessionState));
}

function notifyProgress() {
  progressListeners.forEach((listener) => listener(progressState));
}

async function fetchSession(force = false) {
  if (sessionPromise) return sessionPromise;
  const now = Date.now();
  if (!force && sessionState.status === "ready" && now - sessionCheckedAt < 15000) {
    return Promise.resolve();
  }
  const keepReady = sessionState.status === "ready";
  if (!keepReady) {
    sessionState = { ...sessionState, status: "loading" };
    notifySession();
  }

  sessionPromise = (async () => {
    try {
      const res = await fetch(SESSION_ENDPOINT, { credentials: "include" });
      const payload = await res.json().catch(() => ({}));
      const userId = typeof payload?.userId === "string" ? payload.userId : null;
      sessionState = { status: "ready", userId };
      sessionCheckedAt = Date.now();
    } catch {
      sessionState = { status: "ready", userId: null };
      sessionCheckedAt = Date.now();
    } finally {
      sessionPromise = null;
      notifySession();
    }
  })();

  return sessionPromise;
}

async function fetchProgressIndex(userId: string) {
  if (!userId) return;
  if (progressPromise) return progressPromise;
  if (progressState.status === "ready" && progressState.userId === userId) return Promise.resolve();

  progressState = {
    status: "loading",
    userId,
    counts: progressState.userId === userId ? progressState.counts : {}
  };
  notifyProgress();

  progressPromise = (async () => {
    try {
      const res = await fetch(PROGRESS_ENDPOINT, { credentials: "include" });
      if (!res.ok) {
        progressState = { status: "ready", userId, counts: {} };
        return;
      }
      const payload = await res.json().catch(() => ({}));
      const entries = Array.isArray(payload?.progress) ? payload.progress : [];
      const counts: Record<string, number> = {};

      for (const entry of entries) {
        const slug = typeof entry?.slug === "string" ? entry.slug.trim() : "";
        if (!slug) continue;
        const checkedCount = typeof entry?.checkedCount === "number" ? entry.checkedCount : 0;
        counts[slug] = Math.max(0, Math.floor(checkedCount));
      }

      progressState = { status: "ready", userId, counts };
    } catch {
      progressState = { status: "ready", userId, counts: {} };
    } finally {
      progressPromise = null;
      notifyProgress();
    }
  })();

  return progressPromise;
}

function normalizeCheckedIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

export function useChecklistSession(): ChecklistSessionState {
  const [state, setState] = useState(sessionState);

  useEffect(() => {
    sessionListeners.add(setState);
    void fetchSession(true);
    return () => {
      sessionListeners.delete(setState);
    };
  }, []);

  return state;
}

export function useChecklistProgressIndex(userId: string | null): ProgressIndexState {
  const [state, setState] = useState(progressState);

  useEffect(() => {
    progressListeners.add(setState);

    if (!userId) {
      if (progressState.userId !== null || progressState.status !== "idle") {
        progressState = { status: "idle", userId: null, counts: {} };
        progressPromise = null;
        notifyProgress();
      }
    } else {
      if (progressState.userId !== userId) {
        progressState = { status: "idle", userId, counts: {} };
        progressPromise = null;
        notifyProgress();
      }
      void fetchProgressIndex(userId);
    }

    return () => {
      progressListeners.delete(setState);
    };
  }, [userId]);

  if (userId && state.userId !== userId) {
    return { status: "loading", userId, counts: {} };
  }

  return state;
}

export function updateChecklistProgressCount(userId: string | null, slug: string, count: number) {
  if (!userId) return;
  if (progressState.status !== "ready" || progressState.userId !== userId) return;
  const safeSlug = slug.trim();
  if (!safeSlug) return;
  const nextCount = Math.max(0, Math.floor(count));
  if (progressState.counts[safeSlug] === nextCount) return;

  progressState = {
    ...progressState,
    counts: {
      ...progressState.counts,
      [safeSlug]: nextCount
    }
  };
  notifyProgress();
}

export function getChecklistStorageKey(slug: string) {
  return `checklist:${slug}`;
}

export function readLocalChecklistProgress(slug: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getChecklistStorageKey(slug));
    if (!raw) return [];
    return normalizeCheckedIds(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function writeLocalChecklistProgress(slug: string, checkedIds: string[]) {
  if (typeof window === "undefined") return;
  try {
    const normalized = normalizeCheckedIds(checkedIds);
    localStorage.setItem(getChecklistStorageKey(slug), JSON.stringify(normalized));
  } catch {
    // ignore storage errors
  }
}

export async function loadAccountChecklistProgress(slug: string): Promise<string[]> {
  const trimmed = slug.trim();
  if (!trimmed) return [];
  try {
    const res = await fetch(`${PROGRESS_ENDPOINT}?slug=${encodeURIComponent(trimmed)}`, {
      credentials: "include"
    });
    if (!res.ok) return [];
    const payload = await res.json().catch(() => ({}));
    return normalizeCheckedIds(payload?.checkedIds);
  } catch {
    return [];
  }
}

export async function saveAccountChecklistProgress(slug: string, checkedIds: string[]): Promise<boolean> {
  const trimmed = slug.trim();
  if (!trimmed) return false;
  try {
    const res = await fetch(PROGRESS_ENDPOINT, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        slug: trimmed,
        checkedIds: normalizeCheckedIds(checkedIds)
      })
    });
    return res.ok;
  } catch {
    return false;
  }
}
