import "dotenv/config";

import { Readability } from "@mozilla/readability";
import OpenAI from "openai";
import { JSDOM } from "jsdom";
import { createClient } from "@supabase/supabase-js";

import { slugify } from "@/lib/slug";

type QueueRow = {
  id: string;
  article_title: string;
  article_type: "listicle" | "how_to" | "explainer" | "opinion" | "news";
  category_id: string | null;
  status: "pending" | "completed" | "failed";
  attempts: number;
  last_attempted_at: string | null;
  last_error: string | null;
};

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
};

type SearchResult = {
  title: string;
  url: string;
  snippet?: string;
};

type SourceDocument = {
  title: string;
  url: string;
  content: string;
  host: string;
  isForum: boolean;
};

type SourceSummary = {
  title: string;
  url: string;
  key_points: string[];
  tone: string;
};

type DraftArticle = {
  title: string;
  content_md: string;
  meta_description: string;
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const GOOGLE_SEARCH_KEY = process.env.GOOGLE_SEARCH_KEY;
const GOOGLE_SEARCH_CX = process.env.GOOGLE_SEARCH_CX;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE || !GOOGLE_SEARCH_KEY || !GOOGLE_SEARCH_CX || !OPENAI_KEY) {
  throw new Error("Missing environment variables. Check Supabase, Google Search, and OpenAI credentials.");
}

const AUTHOR_ID = process.env.ARTICLE_AUTHOR_ID ?? "4fc99a58-83da-46f6-9621-7816e36b4088";
const MAX_RESULTS_PER_QUERY = 10;
const MAX_SOURCES = 4;
const MAX_FORUM_SOURCES = 1;
const SOURCE_CHAR_LIMIT = 5500;
const SUMMARY_MAX_TOKENS = 2000;
const ARTICLE_MAX_TOKENS = 6000;

const QUALITY_DOMAINS = [
  "roblox.com",
  "fandom.com",
  "pcgamesn.com",
  "pockettactics.com",
  "polygon.com",
  "ign.com",
  "gamespot.com",
  "thegamer.com",
  "screenrant.com",
  "dexerto.com",
  "beebom.com",
  "destructoid.com",
  "progameguides.com",
  "game8.co",
  "sportskeeda.com",
  "rockpapershotgun.com",
  "pcgamer.com",
  "in.ign.com",
  "digitaltrends.com"
];

const ARTICLE_STYLE: Record<QueueRow["article_type"], string> = {
  listicle: "Organise the article as a numbered list. Give each item a sharp sub-heading, explain why it matters, and close with a quick recap.",
  how_to:
    "Explain the process step by step. Include clear ordered lists, call out requirements, and add troubleshooting tips if sources cover them.",
  explainer:
    "Break the topic into short, focused sections. Unpack terminology, compare mechanics when helpful, and keep the language friendly but precise.",
  opinion:
    "Write in a conversational first-person voice anchored in facts. Acknowledge other viewpoints, explain yours with honest examples, and stay respectful.",
  news:
    "Lead with the headline update, add context from the sources, include timelines or quotes when they exist, and wrap with a 'Why it matters' section."
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
const openai = new OpenAI({ apiKey: OPENAI_KEY });

function parseArgs(): { queueId: string } {
  const args = process.argv.slice(2);
  const index = args.indexOf("--queue-id");
  if (index >= 0 && args[index + 1]) {
    return { queueId: args[index + 1] };
  }
  const inline = args.find((arg) => arg.startsWith("--queue-id="));
  if (inline) {
    return { queueId: inline.split("=")[1] };
  }
  if (args.length > 0) {
    return { queueId: args[0] };
  }
  throw new Error("Usage: tsx scripts/generate-article.ts --queue-id <uuid>");
}

async function fetchQueueEntry(queueId: string): Promise<QueueRow> {
  const { data, error } = await supabase
    .from("article_generation_queue")
    .select("*")
    .eq("id", queueId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load queue entry: ${error.message}`);
  if (!data) throw new Error(`Queue entry ${queueId} not found.`);
  return data as QueueRow;
}

async function fetchCategory(categoryId: string | null): Promise<CategoryRow | null> {
  if (!categoryId) return null;
  const { data, error } = await supabase
    .from("article_categories")
    .select("id, name, slug")
    .eq("id", categoryId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load category ${categoryId}: ${error.message}`);
  return (data as CategoryRow | null) ?? null;
}

async function updateQueueAttempt(queue: QueueRow): Promise<void> {
  const { error } = await supabase
    .from("article_generation_queue")
    .update({
      attempts: queue.attempts + 1,
      last_attempted_at: new Date().toISOString()
    })
    .eq("id", queue.id);
  if (error) {
    console.warn("⚠️ Could not bump queue attempts:", error.message);
  }
}

async function updateQueueStatus(queueId: string, status: "completed" | "failed", lastError?: string | null) {
  const { error } = await supabase
    .from("article_generation_queue")
    .update({
      status,
      last_error: lastError ? lastError.slice(0, 500) : null,
      last_attempted_at: new Date().toISOString()
    })
    .eq("id", queueId);

  if (error) {
    console.error("⚠️ Failed to update queue status:", error.message);
  }
}

async function googleSearch(query: string, limit: number): Promise<SearchResult[]> {
  const endpoint = new URL("https://www.googleapis.com/customsearch/v1");
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("num", String(limit));
  endpoint.searchParams.set("key", GOOGLE_SEARCH_KEY!);
  endpoint.searchParams.set("cx", GOOGLE_SEARCH_CX!);

  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`Google search failed for "${query}" (${response.status} ${response.statusText})`);
  }

  const payload = (await response.json()) as {
    items?: { title?: string; link?: string; snippet?: string }[];
  };

  return (
    payload.items
      ?.map((item) => ({
        title: item.title ?? "",
        url: item.link ?? "",
        snippet: item.snippet
      }))
      .filter((entry) => entry.title && entry.url) ?? []
  );
}

function isHighQualityHost(hostname: string): boolean {
  const base = hostname.replace(/^www\./i, "").toLowerCase();
  return QUALITY_DOMAINS.some((domain) => base === domain || base.endsWith(`.${domain}`));
}

function isForumHost(hostname: string): boolean {
  const base = hostname.replace(/^www\./i, "").toLowerCase();
  return (
    base.includes("reddit.com") ||
    base.includes("devforum.roblox.com") ||
    base.includes("forum") ||
    base.includes("stackexchange") ||
    base.includes("quora.com")
  );
}

async function fetchArticleContent(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
      },
      redirect: "follow"
    });

    if (!response.ok) {
      console.warn(`   • Skipping ${url}: HTTP ${response.status}`);
      return null;
    }

    const html = await response.text();
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article?.textContent) {
      console.warn(`   • Readability could not parse ${url}`);
      return null;
    }

    const normalized = article.textContent.replace(/\s+/g, " ").trim();
    if (normalized.length < 400) {
      console.warn(`   • Content too short for ${url}`);
      return null;
    }

    return normalized.slice(0, SOURCE_CHAR_LIMIT);
  } catch (error) {
    console.warn(`   • Failed to fetch ${url}:`, (error as Error).message);
    return null;
  }
}

async function gatherSources(topic: string): Promise<SourceDocument[]> {
  const primaryQuery = `${topic} Roblox`;
  const fallbackQuery = `${topic} Roblox -site:reddit.com -site:devforum.roblox.com -site:quora.com -site:forum`;

  const seenHosts = new Set<string>();
  const seenUrls = new Set<string>();
  const collected: SourceDocument[] = [];
  let forumCount = 0;

  const queries: { label: string; query: string }[] = [
    { label: "primary", query: primaryQuery },
    { label: "fallback", query: fallbackQuery }
  ];

  for (const { label, query } of queries) {
    if (collected.length >= MAX_SOURCES) break;
    console.log(`🔎 search:${label} → ${query}`);
    const results = await googleSearch(query, MAX_RESULTS_PER_QUERY);

    for (const result of results) {
      if (collected.length >= MAX_SOURCES) break;
      if (!result.url || seenUrls.has(result.url)) continue;

      let parsed: URL;
      try {
        parsed = new URL(result.url);
      } catch {
        continue;
      }

      const host = parsed.hostname.toLowerCase();
      if (seenHosts.has(host)) continue;

      const isForum = isForumHost(host);
      if (isForum && forumCount >= MAX_FORUM_SOURCES) {
        continue;
      }

      const highQuality = isHighQualityHost(host);
      if (!highQuality && !isForum && collected.length >= Math.floor(MAX_SOURCES / 2)) {
        continue;
      }

      const content = await fetchArticleContent(result.url);
      if (!content) continue;

      seenHosts.add(host);
      seenUrls.add(result.url);
      collected.push({
        title: result.title,
        url: result.url,
        content,
        host,
        isForum
      });

      if (isForum) {
        forumCount += 1;
      }

      console.log(`source_${collected.length}: ${host}${isForum ? " [forum]" : ""}`);
    }
  }

  if (collected.length === 0) {
    throw new Error("No useful sources found. Check the topic or Google configuration.");
  }

  return collected;
}

async function summariseSources(topic: string, articleType: QueueRow["article_type"], sources: SourceDocument[]): Promise<SourceSummary[]> {
  if (sources.length === 0) {
    return [];
  }

  const excerptBlocks = sources
    .map(
      (source, index) =>
        `=== SOURCE ${index + 1} ===\nTitle: ${source.title}\nURL: ${source.url}\nCONTENT:\n${source.content}\n`
    )
    .join("\n");

  const summaryPrompt = `
You are a research assistant gathering notes for a Roblox article.
Topic: "${topic}"
Article type: ${articleType}

Extract the most important facts, mechanics, dates, and quotes from each source without adding fluff.
Return JSON with this format:
[
  {
    "title": "...",
    "url": "...",
    "key_points": ["fact 1", "fact 2", ...],
    "tone": "One short sentence describing the tone or approach of the source."
  }
]
Include at least 3 bullet points per source. Keep key points concise and factual.

SOURCES:
${excerptBlocks}
`.trim();

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.2,
    max_tokens: SUMMARY_MAX_TOKENS,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You summarise sources accurately and always return valid JSON with the requested structure."
      },
      { role: "user", content: summaryPrompt }
    ]
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse source summary JSON: ${(error as Error).message}\n${raw}`);
  }

  if (parsed && typeof parsed === "object" && "error" in (parsed as Record<string, unknown>)) {
    console.warn(`summaries_skipped reason="${String((parsed as any).error)}"`);
    return [];
  }

  let entries: unknown;
  if (Array.isArray(parsed)) {
    entries = parsed;
  } else if (parsed && typeof parsed === "object") {
    const maybeSources = (parsed as any).sources ?? (parsed as any).result;
    if (Array.isArray(maybeSources)) {
      entries = maybeSources;
    } else if ((parsed as any).title || (parsed as any).key_points) {
      entries = [parsed];
    }
  }

  if (!Array.isArray(entries)) {
    throw new Error(`Source summary response is not an array:\n${raw}`);
  }

  return (entries as any[]).map((entry) => ({
    title: String(entry?.title ?? ""),
    url: String(entry?.url ?? ""),
    key_points: Array.isArray(entry?.key_points)
      ? entry.key_points.map((point: unknown) => String(point))
      : [],
    tone: String(entry?.tone ?? "")
  }));
}

function buildArticlePrompt(
  queue: QueueRow,
  category: CategoryRow | null,
  blogSources: SourceDocument[],
  forumSummaries: SourceSummary[]
): string {
  const blogBlock = blogSources
    .map(
      (source, index) =>
        `BLOG SOURCE ${index + 1} — ${source.title}\nURL: ${source.url}\nHOST: ${source.host}\nCONTENT:\n${source.content}\n`
    )
    .join("\n");

  const forumBlock = forumSummaries
    .map(
      (summary, index) =>
        `FORUM SOURCE ${index + 1} — ${summary.title}\nURL: ${summary.url}\nTone: ${summary.tone}\nKey points:\n${summary.key_points
          .map((point) => `- ${point}`)
          .join("\n")}\n`
    )
    .join("\n");

  return `
You are an experienced Roblox journalist. Write in simple English that feels like a friendly conversation, yet stays professional and SEO-aware. Cover the topic in depth, keep the flow like a story from start to finish, and leave no key detail behind. Be concise—say everything needed in as few words as possible. Open with a short hook paragraph (no heading) pulled straight from the research (a standout stat, a sharp question, a player scenario); never start with generic lines like "Roblox is a massive platform" or "Roblox is a huge online game." Keep momentum throughout so every section leads naturally into the next. Use only H2 headings, and H3s only when absolutely necessary—skip H4 entirely and rely on a small set of purposeful headings that push the narrative forward. Before any list or table, add a sentence or two to cue the reader. When explaining steps, write in conversational sentences using numbered lists (not key/value snippets). Keep the structure easy to scan, avoid clutter, and weave in first-hand style commentary only when it clearly adds insight or builds trust. Do not mention or reference the source names or URLs—retell the information in your own words.

Requested topic: "${queue.article_title}"
Article type: ${queue.article_type}
Category: ${category ? category.name : "Unassigned"}

Article style guidance: ${ARTICLE_STYLE[queue.article_type]}

Use the material below. Cite sources naturally in the prose (e.g., "Beebom explains..."). Blend overlapping facts, clarify differences, and keep the narrative smooth.

BLOG ARTICLES:
${blogBlock || "None"}

FORUM NOTES:
${forumBlock || "None"}

Return JSON with:
{
  "title": "SEO-friendly H1 (different from the request)",
  "content_md": "Full Markdown article",
  "meta_description": "150-160 character summary"
}
`.trim();
}

async function draftArticle(prompt: string): Promise<DraftArticle> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1",
    temperature: 0.45,
    max_tokens: ARTICLE_MAX_TOKENS,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You are an experienced Roblox journalist. You always return valid JSON with title, content_md, and meta_description."
      },
      { role: "user", content: prompt }
    ]
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Article draft was not valid JSON: ${(error as Error).message}\n${raw}`);
  }

  const { title, content_md, meta_description } = parsed as Partial<DraftArticle>;
  if (!title || !content_md || !meta_description) {
    throw new Error("Article draft missing required fields.");
  }

  return {
    title: title.trim(),
    content_md: content_md.trim(),
    meta_description: meta_description.trim()
  };
}

async function ensureUniqueSlug(base: string): Promise<string> {
  let slug = base || slugify(Date.now().toString());
  let counter = 2;

  while (true) {
    const { data, error } = await supabase.from("articles").select("id").eq("slug", slug).maybeSingle();
    if (error) throw new Error(`Slug check failed: ${error.message}`);
    if (!data) return slug;
    slug = `${base}-${counter}`;
    counter += 1;
  }
}

function estimateWordCount(markdown: string): number {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/[#>*_\-\[\]\(\)]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return 0;
  return text.split(" ").length;
}

async function insertArticleDraft(article: DraftArticle, queue: QueueRow, category: CategoryRow | null): Promise<string> {
  const requested = queue.article_title.trim().toLowerCase();
  let finalTitle = article.title;

  if (!finalTitle) {
    throw new Error("Generated article title is empty.");
  }
  if (finalTitle.toLowerCase() === requested) {
    finalTitle = `${finalTitle} – Updated Insights`;
  }

  const slug = await ensureUniqueSlug(slugify(finalTitle));
  const wordCount = estimateWordCount(article.content_md);

  const { data, error } = await supabase
    .from("articles")
    .insert({
      title: finalTitle,
      slug,
      content_md: article.content_md,
      category_id: category ? category.id : null,
      author_id: AUTHOR_ID,
      is_published: false,
      meta_description: article.meta_description,
      word_count: wordCount
    })
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to insert article: ${error.message}`);
  }

  return data?.id as string;
}

async function main() {
  const { queueId } = parseArgs();
  let queueEntry: QueueRow | null = null;

  try {
    console.log(`queue ${queueId} start`);
    queueEntry = await fetchQueueEntry(queueId);

    if (queueEntry.status !== "pending") {
      throw new Error(`Queue entry is ${queueEntry.status}; expected pending.`);
    }

    await updateQueueAttempt(queueEntry);

    const category = await fetchCategory(queueEntry.category_id);
    console.log(`topic: ${queueEntry.article_title}`);
    console.log(`type: ${queueEntry.article_type}`);
    console.log(`category: ${category ? category.name : "Unassigned"}`);

    const sources = await gatherSources(queueEntry.article_title);
    console.log(`sources_collected=${sources.length}`);

    const forumSources = sources.filter((source) => source.isForum);
    const blogSources = sources.filter((source) => !source.isForum);
    const summaries = await summariseSources(queueEntry.article_title, queueEntry.article_type, forumSources);
    if (summaries.length) {
      console.log("summaries_ready");
    }

    const prompt = buildArticlePrompt(queueEntry, category, blogSources, summaries);
    const draft = await draftArticle(prompt);
    console.log(`draft_title="${draft.title}" word_count=${estimateWordCount(draft.content_md)}`);

    if (draft.content_md.length < 400) {
      throw new Error("Generated article is too short.");
    }

    await insertArticleDraft(draft, queueEntry, category);
    await updateQueueStatus(queueEntry.id, "completed");

    console.log("article_saved status=draft");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("❌ Article generation failed:", message);
    if (queueEntry) {
      await updateQueueStatus(queueEntry.id, "failed", message);
    }
    process.exitCode = 1;
  }
}

main();
