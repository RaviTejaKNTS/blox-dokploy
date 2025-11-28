import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

type Payload =
  | { type: "code"; slug: string }
  | { type: "article"; slug: string }
  | { type: "list"; slug: string }
  | { type: "author"; slug: string };

function assertSecret(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return "REVALIDATE_SECRET env is not set";
  }
  const header = request.headers.get("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (token !== secret) {
    return "Unauthorized";
  }
  return null;
}

function revalidateForCode(slug: string) {
  revalidatePath(`/codes/${slug}`);
  revalidatePath("/codes");
  revalidatePath("/"); // home shows featured codes
  revalidatePath("/sitemap.xml");
  revalidateTag(`code:${slug}`);
  revalidateTag("codes");
  revalidateTag("codes-index");
  revalidateTag("home");
}

function revalidateForArticle(slug: string) {
  revalidatePath(`/articles/${slug}`);
  revalidatePath("/articles");
  revalidatePath("/"); // home shows latest articles
  revalidatePath("/sitemap.xml");
  revalidateTag(`article:${slug}`);
  revalidateTag("articles");
  revalidateTag("articles-index");
}

function revalidateForList(slug: string) {
  revalidatePath(`/lists/${slug}`);
  // Revalidate all paginated list pages (dynamic [page] segment)
  revalidatePath(`/lists/${slug}/page/[page]`);
  revalidatePath("/lists");
  revalidatePath("/sitemap.xml");
  revalidateTag(`list:${slug}`);
  revalidateTag("lists");
  revalidateTag("lists-index");
}

function revalidateForAuthor(slug: string) {
  revalidatePath(`/authors/${slug}`);
  revalidatePath("/authors");
  revalidateTag(`author:${slug}`);
  revalidateTag("authors");
  revalidateTag("authors-index");
}

export async function POST(request: Request) {
  const authError = assertSecret(request);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload || typeof payload !== "object" || typeof (payload as any).slug !== "string") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const slug = payload.slug.trim().toLowerCase();
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  switch (payload.type) {
    case "code":
      revalidateForCode(slug);
      break;
    case "article":
      revalidateForArticle(slug);
      break;
    case "list":
      revalidateForList(slug);
      break;
    case "author":
      revalidateForAuthor(slug);
      break;
    default:
      return NextResponse.json({ error: "Unknown type" }, { status: 400 });
  }

  return NextResponse.json({ revalidated: true, type: payload.type, slug });
}
