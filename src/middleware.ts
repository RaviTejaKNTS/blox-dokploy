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

  return res;
}

export const config = {
  matcher: ["/:path*"]
};
