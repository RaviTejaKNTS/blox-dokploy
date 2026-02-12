"use server";

import { redirect } from "next/navigation";
import { revokeCurrentAppSession } from "@/lib/auth/app-session";
import { DEFAULT_AUTH_NEXT_PATH, sanitizeNextPath } from "@/lib/auth/navigation";

const AUTH_PATH = "/login";
const DEFAULT_NEXT_PATH = DEFAULT_AUTH_NEXT_PATH;

function getNextPath(formData?: FormData) {
  if (!formData) return DEFAULT_NEXT_PATH;
  const rawNext = normalizeField(formData.get("next"));
  const nextPath = sanitizeNextPath(rawNext || null, DEFAULT_NEXT_PATH);
  if (nextPath.startsWith("/login")) return DEFAULT_NEXT_PATH;
  return nextPath;
}

function buildRedirect(status: "success" | "error", message: string, nextPath?: string) {
  const params = new URLSearchParams({ [status]: message });
  if (nextPath) {
    params.set("next", nextPath);
  }
  return `${AUTH_PATH}?${params.toString()}`;
}

function normalizeField(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return "";
  return value.trim();
}

export async function signInWithRoblox(formData: FormData) {
  const nextPath = getNextPath(formData);
  redirect(`/auth/roblox/login?next=${encodeURIComponent(nextPath)}`);
}

export async function signOut() {
  await revokeCurrentAppSession();
  redirect(buildRedirect("success", "Signed out."));
}
