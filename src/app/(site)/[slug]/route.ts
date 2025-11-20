import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

async function resolveLegacySlug(slug: string | undefined): Promise<string | null> {
  const normalizedSlug = slug?.trim().toLowerCase();
  if (!normalizedSlug) return null;

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("games")
    .select("slug")
    .contains("old_slugs", [normalizedSlug])
    .maybeSingle();

  if (error) throw error;
  if (!data?.slug || data.slug === normalizedSlug) return null;
  return data.slug;
}

async function handleLegacyRedirect(request: Request, context: { params: { slug?: string } }) {
  const canonicalSlug = await resolveLegacySlug(context.params.slug);
  if (!canonicalSlug) {
    return NextResponse.next();
  }

  const targetUrl = new URL(request.url);
  targetUrl.pathname = `/codes/${canonicalSlug}`;

  return NextResponse.redirect(targetUrl, { status: 301 });
}

export async function GET(request: Request, context: { params: { slug?: string } }) {
  return handleLegacyRedirect(request, context);
}

export async function HEAD(request: Request, context: { params: { slug?: string } }) {
  return handleLegacyRedirect(request, context);
}
