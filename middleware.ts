import { NextResponse } from "next/server";

export function middleware() {
  // Admin panel moved to separate repo; no middleware routing needed here.
  return NextResponse.next();
}

export const config = {
  matcher: []
};
