import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const GDPR_COUNTRIES = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "GI",
  "AX",
  "IC",
  "EA",
  "GF",
  "GP",
  "MQ",
  "RE",
  "YT",
  "MF",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
  "IS",
  "LI",
  "NO",
  "CH",
  "GB"
]);

const CONSENT_HEADER = "x-require-consent";
const CONSENT_COOKIE = "require-consent";
const CONSENT_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function middleware(req: NextRequest) {
  // Prefer Vercel geo (works when DNS is on Vercel), fall back to Cloudflare if proxied.
  const country =
    req.headers.get("x-vercel-ip-country")?.toUpperCase() ||
    req.geo?.country?.toUpperCase() ||
    req.headers.get("cf-ipcountry")?.toUpperCase() ||
    "";

  const requiresConsent = GDPR_COUNTRIES.has(country);

  // Pass a header downstream so layouts can decide whether to show consent UI.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(CONSENT_HEADER, requiresConsent ? "1" : "0");

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set(CONSENT_HEADER, requiresConsent ? "1" : "0");
  res.cookies.set({
    name: CONSENT_COOKIE,
    value: requiresConsent ? "1" : "0",
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CONSENT_MAX_AGE
  });

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|favicon-16x16\\.png|favicon-32x32\\.png|favicon-48x48\\.png|android-chrome-192x192\\.png|android-chrome-512x512\\.png|apple-touch-icon\\.png|robots\\.txt|sitemap\\.xml|site\\.webmanifest|og-image\\.png|Bloxodes-dark\\.png|Bloxodes-light\\.png|Bloxodes\\.png).*)"
  ]
};
