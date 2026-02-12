import { NextResponse, type NextRequest } from "next/server";
import { sanitizeNextPath } from "@/lib/auth/navigation";
import {
  buildRobloxAuthorizeUrl,
  createRobloxCodeChallenge,
  createRobloxCodeVerifier,
  createRobloxOauthState,
  resolveRobloxLoginRedirectUri,
  setRobloxLoginOauthCookies
} from "@/lib/auth/roblox-login";

const LOGIN_PATH = "/login";

function buildLoginRedirect(origin: string, status: "success" | "error", message: string, nextPath?: string) {
  const params = new URLSearchParams({ [status]: message });
  if (nextPath) {
    params.set("next", sanitizeNextPath(nextPath));
  }
  return `${origin}${LOGIN_PATH}?${params.toString()}`;
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const requestedNext = request.nextUrl.searchParams.get("next");
  const nextPath = sanitizeNextPath(requestedNext);
  const clientId = process.env.ROBLOX_OAUTH_CLIENT_ID?.trim();

  if (!clientId) {
    return NextResponse.redirect(buildLoginRedirect(origin, "error", "Roblox OAuth is not configured.", nextPath));
  }

  const state = createRobloxOauthState();
  const verifier = createRobloxCodeVerifier();
  const challenge = createRobloxCodeChallenge(verifier);
  const redirectUri = resolveRobloxLoginRedirectUri(origin);

  const authUrl = buildRobloxAuthorizeUrl({
    clientId,
    redirectUri,
    state,
    codeChallenge: challenge
  });

  const response = NextResponse.redirect(authUrl);
  setRobloxLoginOauthCookies(response, { state, verifier, nextPath });
  return response;
}
