import type { NextRequest } from "next/server";
import { proxy } from "./src/proxy";

export function middleware(req: NextRequest) {
  return proxy(req);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|favicon-16x16\\.png|favicon-32x32\\.png|favicon-48x48\\.png|android-chrome-192x192\\.png|android-chrome-512x512\\.png|apple-touch-icon\\.png|site\\.webmanifest|og-image\\.png|Bloxodes-dark\\.png|Bloxodes-light\\.png|Bloxodes\\.png).*)"
  ]
};
