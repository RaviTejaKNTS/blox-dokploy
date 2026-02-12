import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const APP_SESSION_COOKIE = "app_session";
const SESSION_VERSION = 1;
const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const MAX_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const MIN_SESSION_TTL_SECONDS = 60 * 60; // 1 hour
const FOREVER_SESSION_TTL_SECONDS = 0;
const FOREVER_SESSION_EXPIRES_AT = "9999-12-31T23:59:59.999Z";
const FOREVER_SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 20; // 20 years

type SessionTokenPayload = {
  v: number;
  sid: string;
  uid: string;
  iat: number;
  exp: number;
};

type AppSessionRow = {
  id: string;
  user_id: string;
  expires_at: string;
  revoked_at: string | null;
};

export type AppSession = {
  sessionId: string;
  userId: string;
  expiresAt: string;
};

export type CurrentAppUser = {
  user_id: string;
  role: "admin" | "user";
  display_name: string | null;
  roblox_user_id: number | null;
  roblox_username: string | null;
  roblox_display_name: string | null;
  roblox_avatar_url: string | null;
  roblox_profile_url: string | null;
};

function getSessionSecret(): string | null {
  const secret = process.env.AUTH_SESSION_SECRET?.trim();
  return secret && secret.length > 0 ? secret : null;
}

function getSessionLifetime() {
  const raw = process.env.AUTH_SESSION_TTL_SECONDS?.trim();
  if (raw === String(FOREVER_SESSION_TTL_SECONDS)) {
    const foreverEpoch = Math.floor(Date.parse(FOREVER_SESSION_EXPIRES_AT) / 1000);
    return {
      expiresAt: FOREVER_SESSION_EXPIRES_AT,
      expiresAtEpoch: foreverEpoch,
      cookieMaxAge: FOREVER_SESSION_COOKIE_MAX_AGE_SECONDS
    };
  }

  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  const ttlSeconds =
    Number.isFinite(parsed) && parsed >= MIN_SESSION_TTL_SECONDS && parsed <= MAX_SESSION_TTL_SECONDS
      ? parsed
      : DEFAULT_SESSION_TTL_SECONDS;
  const expiresAtEpoch = Math.floor(Date.now() / 1000) + ttlSeconds;

  return {
    expiresAt: new Date(expiresAtEpoch * 1000).toISOString(),
    expiresAtEpoch,
    cookieMaxAge: ttlSeconds
  }
}

function getSessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge
  };
}

function signPayload(payloadPart: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payloadPart).digest("base64url");
}

function issueSessionToken(payload: SessionTokenPayload): string {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error("AUTH_SESSION_SECRET is required for Roblox-only sessions.");
  }
  const payloadJson = JSON.stringify(payload);
  const payloadPart = Buffer.from(payloadJson).toString("base64url");
  const signaturePart = signPayload(payloadPart, secret);
  return `${payloadPart}.${signaturePart}`;
}

function parseSessionToken(token: string | null | undefined): SessionTokenPayload | null {
  if (!token) return null;
  const [payloadPart, signaturePart] = token.split(".");
  if (!payloadPart || !signaturePart) return null;

  const secret = getSessionSecret();
  if (!secret) return null;
  const expectedSignature = signPayload(payloadPart, secret);

  let providedSignatureBuf: Buffer;
  let expectedSignatureBuf: Buffer;
  try {
    providedSignatureBuf = Buffer.from(signaturePart, "base64url");
    expectedSignatureBuf = Buffer.from(expectedSignature, "base64url");
  } catch {
    return null;
  }

  if (
    providedSignatureBuf.length !== expectedSignatureBuf.length ||
    !crypto.timingSafeEqual(providedSignatureBuf, expectedSignatureBuf)
  ) {
    return null;
  }

  let decodedPayload: unknown;
  try {
    decodedPayload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (!decodedPayload || typeof decodedPayload !== "object") {
    return null;
  }

  const candidate = decodedPayload as Partial<SessionTokenPayload>;
  if (
    candidate.v !== SESSION_VERSION ||
    typeof candidate.sid !== "string" ||
    typeof candidate.uid !== "string" ||
    typeof candidate.iat !== "number" ||
    typeof candidate.exp !== "number"
  ) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (candidate.exp <= now) {
    return null;
  }

  return candidate as SessionTokenPayload;
}

async function loadValidSession(token: string | null | undefined): Promise<AppSession | null> {
  const payload = parseSessionToken(token);
  if (!payload) return null;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("app_sessions")
    .select("id, user_id, expires_at, revoked_at")
    .eq("id", payload.sid)
    .maybeSingle<AppSessionRow>();

  if (error || !data) {
    return null;
  }

  if (data.user_id !== payload.uid) {
    return null;
  }

  if (data.revoked_at) {
    return null;
  }

  const expiresAtMs = Date.parse(data.expires_at);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    return null;
  }

  return {
    sessionId: data.id,
    userId: data.user_id,
    expiresAt: data.expires_at
  };
}

export async function createAppSession(userId: string, userAgent?: string | null) {
  const sessionLifetime = getSessionLifetime();
  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("app_sessions")
    .insert({
      user_id: userId,
      user_agent: userAgent?.slice(0, 512) ?? null,
      expires_at: sessionLifetime.expiresAt
    })
    .select("id, user_id, expires_at")
    .single<{ id: string; user_id: string; expires_at: string }>();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create app session.");
  }

  const issuedAt = Math.floor(Date.now() / 1000);

  return {
    token: issueSessionToken({
      v: SESSION_VERSION,
      sid: data.id,
      uid: data.user_id,
      iat: issuedAt,
      exp: sessionLifetime.expiresAtEpoch
    }),
    maxAge: sessionLifetime.cookieMaxAge,
    sessionId: data.id,
    userId: data.user_id,
    expiresAt: data.expires_at
  };
}

export function setAppSessionCookieOnResponse(response: NextResponse, token: string, maxAge: number) {
  response.cookies.set(APP_SESSION_COOKIE, token, getSessionCookieOptions(maxAge));
}

export function clearAppSessionCookieOnResponse(response: NextResponse) {
  response.cookies.set(APP_SESSION_COOKIE, "", getSessionCookieOptions(0));
}

export async function getAppSessionFromRequest(request: NextRequest): Promise<AppSession | null> {
  const token = request.cookies.get(APP_SESSION_COOKIE)?.value ?? null;
  return loadValidSession(token);
}

export async function getCurrentAppSession(): Promise<AppSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(APP_SESSION_COOKIE)?.value ?? null;
  return loadValidSession(token);
}

export async function clearCurrentAppSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(APP_SESSION_COOKIE, "", getSessionCookieOptions(0));
}

export async function revokeAppSessionById(sessionId: string) {
  const supabase = supabaseAdmin();
  await supabase
    .from("app_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", sessionId)
    .is("revoked_at", null);
}

export async function revokeCurrentAppSession() {
  const session = await getCurrentAppSession();
  if (session) {
    await revokeAppSessionById(session.sessionId);
  }
  await clearCurrentAppSessionCookie();
}

export async function getCurrentAppUser(): Promise<CurrentAppUser | null> {
  const session = await getCurrentAppSession();
  if (!session) return null;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("app_users")
    .select(
      "user_id, role, display_name, roblox_user_id, roblox_username, roblox_display_name, roblox_avatar_url, roblox_profile_url"
    )
    .eq("user_id", session.userId)
    .maybeSingle<CurrentAppUser>();

  if (error || !data) {
    return null;
  }

  return data;
}
