import "dotenv/config";

import { Readability } from "@mozilla/readability";
import OpenAI from "openai";
import { JSDOM } from "jsdom";
import { createClient } from "@supabase/supabase-js";

import { slugify } from "@/lib/slug";

type QueueRow = {
  id: string;
  article_title: string | null;
  status: "pending" | "completed" | "failed";
  attempts: number;
  last_attempted_at: string | null;
  last_error: string | null;
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

type DraftArticle = {
  title: string;
  content_md: string;
  meta_description: string;
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const AUTHOR_ID = process.env.ARTICLE_AUTHOR_ID ?? "4fc99a58-83da-46f6-9621-7816e36b4088";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE.");
}

if (!PERPLEXITY_API_KEY) {
  throw new Error("Missing PERPLEXITY_API_KEY.");
}

if (!OPENAI_KEY) {
  throw new Error("Missing OPENAI_API_KEY.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
const perplexity = new OpenAI({ apiKey: PERPLEXITY_API_KEY, baseURL: "https://api.perplexity.ai" });
const openai = new OpenAI({ apiKey: OPENAI_KEY });

const SOURCE_CHAR_LIMIT = 6500;
const MAX_RESULTS_PER_QUERY = 15;
const MAX_SOURCES = 6; // 3-5 primary, 1-2 fandom
const MIN_SOURCES = 1;
const MAX_FORUM_SOURCES = 2;
const MAX_PER_HOST_DEFAULT = 2;
const MAX_PER_HOST_HIGH_QUALITY = 3;
const BLOCKED_HOSTS_PRIMARY = ["fandom.com", "roblox.fandom.com"];

const QUALITY_DOMAINS = [
  "roblox.com",
  "fandom.com",
  "fandomwiki.com",
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
  "digitaltrends.com",
  "gamingonphone.com"
];

let cachedAuthorIds: string[] | null = null;

async function pickAuthorId(): Promise<string | null> {
  if (!cachedAuthorIds) {
    const { data, error } = await supabase.from("authors").select("id");
    if (error) {
      console.warn("⚠️ Unable to load authors:", error.message);
      cachedAuthorIds = [];
    } else {
      cachedAuthorIds = (data ?? [])
        .map((author) => author.id)
        .filter((id): id is string => typeof id === "string" && id.length > 0);
    }
  }

  if (!cachedAuthorIds || cachedAuthorIds.length === 0) {
    console.warn("⚠️ No authors available; falling back to default author.");
    return null;
  }

  const index = Math.floor(Math.random() * cachedAuthorIds.length);
  return cachedAuthorIds[index] ?? null;
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

function isVideoHost(hostname: string): boolean {
  const base = hostname.replace(/^www\./i, "").toLowerCase();
  return base.includes("youtube.com") || base.includes("youtu.be") || base.includes("vimeo.com") || base.includes("dailymotion.com");
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

async function ensureUniqueSlug(baseTitle: string): Promise<string> {
  const base = slugify(baseTitle);
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

async function getNextQueueItem(): Promise<QueueRow | null> {
  const { data, error } = await supabase
    .from("article_generation_queue")
    .select("id, article_title, status, attempts, last_attempted_at, last_error")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch queue: ${error.message}`);
  }

  if (!data) return null;

  return {
    ...data,
    attempts: data.attempts ?? 0,
    status: (data.status as QueueRow["status"]) ?? "pending",
    last_attempted_at: data.last_attempted_at ?? null,
    last_error: data.last_error ?? null
  };
}

async function markAttempt(queue: QueueRow): Promise<void> {
  const { error } = await supabase
    .from("article_generation_queue")
    .update({
      attempts: queue.attempts + 1,
      last_attempted_at: new Date().toISOString()
    })
    .eq("id", queue.id)
    .eq("status", "pending");

  if (error) {
    throw new Error(`Failed to record attempt: ${error.message}`);
  }
}

async function updateQueueStatus(
  queueId: string,
  status: "completed" | "failed",
  lastError?: string | null
): Promise<void> {
  const { error } = await supabase
    .from("article_generation_queue")
    .update({
      status,
      last_error: lastError ? lastError.slice(0, 500) : null,
      last_attempted_at: new Date().toISOString()
    })
    .eq("id", queueId);

  if (error) {
    throw new Error(`Failed to update queue status: ${error.message}`);
  }
}

async function perplexitySearch(query: string, limit: number): Promise<SearchResult[]> {
  const response = await fetch("https://api.perplexity.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PERPLEXITY_API_KEY}`
    },
    body: JSON.stringify({
      query,
      top_k: limit
    })
  });

  if (!response.ok) {
    throw new Error(`Perplexity search failed for "${query}" (${response.status} ${response.statusText})`);
  }

  const payload = (await response.json()) as { results?: { title?: string; url?: string; snippet?: string }[] };

  return (
    payload.results
      ?.map((item) => ({
        title: item.title ?? "",
        url: item.url ?? "",
        snippet: item.snippet
      }))
      .filter((entry) => entry.title && entry.url) ?? []
  );
}

type ParsedArticle = {
  content: string;
  title: string | null;
};

async function fetchArticleContent(url: string): Promise<ParsedArticle | null> {
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
    if (normalized.length < 250) {
      console.warn(`   • Content too short for ${url}`);
      return null;
    }

    const derivedTitle = article.title?.trim() || dom.window.document.title?.trim() || null;

    return {
      content: normalized.slice(0, SOURCE_CHAR_LIMIT),
      title: derivedTitle
    };
  } catch (error) {
    console.warn(`   • Failed to fetch ${url}:`, (error as Error).message);
    return null;
  }
}

async function collectFromResults(
  results: SearchResult[],
  collected: SourceDocument[],
  hostCounts: Map<string, number>,
  forumCount: { value: number },
  options: { blockFandom?: boolean; seenUrls: Set<string> }
): Promise<void> {
  for (const result of results) {
    if (collected.length >= MAX_SOURCES) break;
    if (!result.url || !result.title) continue;
    if (options.seenUrls.has(result.url)) continue;

    let parsed: URL;
    try {
      parsed = new URL(result.url);
    } catch {
      continue;
    }

    const host = parsed.hostname.toLowerCase();
    if (options?.blockFandom && BLOCKED_HOSTS_PRIMARY.some((blocked) => host === blocked || host.endsWith(`.${blocked}`))) {
      continue;
    }
    if (isVideoHost(host)) continue;

    const isForum = isForumHost(host);
    if (isForum && forumCount.value >= MAX_FORUM_SOURCES) continue;

    const highQuality = isHighQualityHost(host);
    const hostLimit = highQuality ? MAX_PER_HOST_HIGH_QUALITY : MAX_PER_HOST_DEFAULT;
    const hostCount = hostCounts.get(host) ?? 0;
    if (hostCount >= hostLimit) continue;

    const parsedContent = await fetchArticleContent(result.url);
    if (!parsedContent) continue;

    collected.push({
      title: result.title || parsedContent.title || result.url,
      url: result.url,
      content: parsedContent.content,
      host,
      isForum
    });

    options.seenUrls.add(result.url);
    hostCounts.set(host, hostCount + 1);
    if (isForum) forumCount.value += 1;
    console.log(`source_${collected.length}: ${host}${isForum ? " [forum]" : ""}`);
  }
}

async function sonarResearchNotes(topic: string): Promise<string> {
  const prompt = `
${topic} give me full details related to this — key facts, mechanics, requirements, steps, edge cases, and common questions. Keep it tight, bullet-style notes with no filler. Do not include URLs.
`.trim();

  const completion = await perplexity.chat.completions.create({
    model: "sonar",
    temperature: 0.25,
    max_tokens: 1000,
    messages: [
      { role: "system", content: "Return concise research notes. Do not include URLs." },
      { role: "user", content: prompt }
    ]
  });

  return completion.choices[0]?.message?.content?.trim() || "";
}

async function gatherSources(topic: string): Promise<SourceDocument[]> {
  const collected: SourceDocument[] = [];
  const hostCounts = new Map<string, number>();
  const forumCount = { value: 0 };
  const seenUrls = new Set<string>();

  // 1) Primary search (take first 3-5 sources, non-fandom)
  const primaryQuery = `${topic}`;
  try {
    console.log(`🔎 search → ${primaryQuery}`);
    const results = await perplexitySearch(primaryQuery, MAX_RESULTS_PER_QUERY);
    await collectFromResults(results, collected, hostCounts, forumCount, { blockFandom: true, seenUrls });
    if (collected.length > 5) {
      collected.splice(5);
    }
  } catch (error) {
    console.warn(`   • search_failed query="${primaryQuery}" reason="${(error as Error).message}"`);
  }

  // 2) Fandom-specific search (1-2 sources)
  try {
    const fandomQuery = `${topic} fandom`;
    console.log(`🔎 search → ${fandomQuery}`);
    const fandomResults = await perplexitySearch(fandomQuery, 10);
    const fandomOnly = fandomResults.filter((res) => res.url?.toLowerCase().includes("fandom.com"));
    await collectFromResults(fandomOnly, collected, hostCounts, forumCount, { seenUrls });
    if (collected.length > 6) {
      collected.splice(6);
    }
  } catch (error) {
    console.warn(`   • fandom_search_failed reason="${(error as Error).message}"`);
  }

  // Sonar research notes (non-URL) to supplement
  try {
    const notes = await sonarResearchNotes(topic);
    if (notes) {
      collected.push({
        title: "Sonar Research Notes",
        url: "perplexity:sonar-notes",
        content: notes.slice(0, SOURCE_CHAR_LIMIT),
        host: "perplexity.ai",
        isForum: false
      });
      console.log(`source_${collected.length}: perplexity.ai [sonar notes]`);
    }
  } catch (error) {
    console.warn(`   • sonar_notes_failed reason="${(error as Error).message}"`);
  }

  if (collected.length < MIN_SOURCES) {
    throw new Error(`Not enough sources collected (${collected.length}/${MIN_SOURCES}).`);
  }

  return collected.slice(0, MAX_SOURCES);
}

function formatSourcesForPrompt(sources: SourceDocument[]): string {
  return sources
    .map(
      (source, index) =>
        `SOURCE ${index + 1}\nTITLE: ${source.title}\nURL: ${source.url}\nHOST: ${source.host}\nCONTENT:\n${source.content}\n`
    )
    .join("\n");
}

function buildArticlePrompt(topic: string, sources: SourceDocument[]): string {
  const sourceBlock = formatSourcesForPrompt(sources);

  return `
Use the research below to write a Roblox article.

Write an article in simple English that is easy for anyone to understand. Use a conversational tone like a professional content writer who also plays Roblox. The article should feel like a friend talking to a friend while still being factual, helpful, and engaging.

Start with an small intro that's engaging and is not templated style. Don't start the intro with a generic template style opening. Don't start with "If you ever" or other clichéd phrases.

Right after the intro, give the main answer upfront in one short paragraph with no heading. Can start with something like "first things first" or "Here's a quick answer" or anything that flows naturally.

Use full sentences and explain things clearly without fluff or repetition. Keep the information dense but readable. Adjust depth based on the topic. If something is simple, keep it short. If something needs more explanation, expand it properly. 

Don't drag and explain things that are very obvious to the reader. Do not focus on generic stuff or repeat what's already clear.

Use only H2 headings for sections. Bullet points or tables are fine when they make information easier to scan. For step by step instructions, always use numbered steps. Before any bullets, tables, or steps, write a short paragraph that sets the context.

Keep the tone friendly and relatable, like a Roblox player sharing their knowledge. Do not use over technical language. Focus on solving the user’s intent completely so they leave with zero confusion. 

Sprinkle in some first hand experience where ever matters and needed. Do not blatently write like from my experience or when I player. Give experience instead like "It took 4 trials for me" or "I found this particularly helpful during my first week" to make it feel personal and relatable. Share these moments naturally to build connection with the reader. Also write things that only a player who played the game would know.

If the article is a listicle or has any lists that you can give, present them in clear, easy-to-scan formats like tables or bullet points.

Do not add emojis, sources, URLs, or reference numbers. No emdashes anywhere. End with a short friendly takeaway that leaves the reader feeling guided and confident. No need for any cringe ending words like "Happy fishing and defending out there!". Just keep it real and helpful.

Topic: "${topic}"

Sources:
${sourceBlock}

Return JSON:
{
  "title": "SEO-friendly simple title that's easy to scan and understand. Keep it short with keyword and conversational. Don't write like key-value pairs. No need to mention like guide or anything. Just a simple title that people search on Google is what we need",
  "meta_description": "150-160 character summary",
  "content_md": "Full Markdown article"
}
`.trim();
}

async function draftArticle(prompt: string): Promise<DraftArticle> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.35,
    max_tokens: 4000,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You are an expert Roblox writer. Always return valid JSON with title, content_md, and meta_description."
      },
      { role: "user", content: prompt }
    ]
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`OpenAI did not return valid JSON: ${(error as Error).message}`);
  }

  const { title, content_md, meta_description } = parsed as Partial<DraftArticle>;
  if (!title || !content_md || !meta_description) {
    throw new Error("Draft missing required fields.");
  }

  return {
    title: title.trim(),
    content_md: content_md.trim(),
    meta_description: meta_description.trim()
  };
}

async function factCheckArticle(topic: string, article: DraftArticle, sources: SourceDocument[]): Promise<string> {
  const prompt = `
Fact check this Roblox article. Search broadly. If everything is accurate, reply exactly: Yes
If anything is incorrect, missing, or misleading, reply starting with: No
Then give clear details of what is wrong and how to change it, including the correct information needed. Be explicit about what to fix. Make sure to provide all the correct and upto date details. 

Topic: "${topic}"

Article Title: ${article.title}
Meta Description: ${article.meta_description}
Article Markdown:
${article.content_md}
`.trim();

  const completion = await perplexity.chat.completions.create({
    model: "sonar",
    temperature: 0,
    max_tokens: 1200,
    messages: [
      {
        role: "system",
        content:
          "You are a strict fact checker. Always reply exactly 'Yes' if the article is accurate. Otherwise start with 'No' and provide detailed, actionable corrections with the right information."
      },
      { role: "user", content: prompt }
    ]
  });

  const feedback = completion.choices[0]?.message?.content?.trim();
  if (!feedback) {
    throw new Error("Fact check returned empty feedback.");
  }

  return feedback;
}

async function reviseArticleWithFeedback(
  topic: string,
  article: DraftArticle,
  sources: SourceDocument[],
  factCheckFeedback: string
): Promise<DraftArticle> {
  const sourceBlock = formatSourcesForPrompt(sources);
  const prompt = `
You are updating a Roblox article after fact-check feedback. Keep the same friendly, conversational tone and overall structure.
- If feedback starts with "Yes", return the original article unchanged.
- If feedback starts with "No", only adjust the parts that were flagged. Keep everything else as close as possible to the original voice.
- Use the fact-check feedback plus the provided sources; do not invent new information.
- Make only the changes required by the feedback—no extra rewrites.

Topic: "${topic}"

Fact-check feedback:
${factCheckFeedback}

Sources:
${sourceBlock}

Original article:
Title: ${article.title}
Meta Description: ${article.meta_description}
Content:
${article.content_md}

Return JSON:
{
  "title": "Keep this close to the original title unless feedback requires a correction",
  "meta_description": "150-160 character summary",
  "content_md": "Updated Markdown article with only the necessary corrections"
}
`.trim();

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.35,
    max_tokens: 4000,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You are an expert Roblox writer. Always return valid JSON with title, content_md, and meta_description."
      },
      { role: "user", content: prompt }
    ]
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Revision step did not return valid JSON: ${(error as Error).message}`);
  }

  const { title, content_md, meta_description } = parsed as Partial<DraftArticle>;
  if (!title || !content_md || !meta_description) {
    throw new Error("Revision missing required fields.");
  }

  return {
    title: title.trim(),
    content_md: content_md.trim(),
    meta_description: meta_description.trim()
  };
}

async function insertArticleDraft(article: DraftArticle): Promise<string> {
  const slug = await ensureUniqueSlug(article.title);
  const wordCount = estimateWordCount(article.content_md);
  const authorId = (await pickAuthorId()) ?? AUTHOR_ID;

  const { data, error } = await supabase
    .from("articles")
    .insert({
      title: article.title,
      slug,
      content_md: article.content_md,
      meta_description: article.meta_description,
      author_id: authorId,
      is_published: false,
      word_count: wordCount
    })
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to insert article draft: ${error.message}`);
  }

  return data?.id as string;
}

async function main() {
  let queueEntry: QueueRow | null = null;

  try {
    queueEntry = await getNextQueueItem();
    if (!queueEntry) {
      console.log("No pending article tasks found.");
      return;
    }

    const topic = queueEntry.article_title?.trim();
    if (!topic) {
      throw new Error("Queue item missing article_title.");
    }

    console.log(`✏️  Generating article for "${topic}" (${queueEntry.id})`);
    await markAttempt(queueEntry);

    const sources = await gatherSources(topic);
    console.log(`sources_collected=${sources.length}`);

    const prompt = buildArticlePrompt(topic, sources);
    const draft = await draftArticle(prompt);
    console.log(`draft_title="${draft.title}" word_count=${estimateWordCount(draft.content_md)}`);

    const factCheckFeedback = await factCheckArticle(topic, draft, sources);
    const factCheckLog = factCheckFeedback.replace(/\s+/g, " ").slice(0, 200);
    console.log(`fact_check="${factCheckLog}${factCheckFeedback.length > 200 ? "..." : ""}"`);

    const revisedDraft = await reviseArticleWithFeedback(topic, draft, sources, factCheckFeedback);
    console.log(`revised_title="${revisedDraft.title}" word_count=${estimateWordCount(revisedDraft.content_md)}`);

    if (revisedDraft.content_md.length < 400) {
      throw new Error("Draft content is too short after revision.");
    }

    const articleId = await insertArticleDraft(revisedDraft);
    console.log(`article_saved id=${articleId}`);

    await updateQueueStatus(queueEntry.id, "completed", null);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("❌ Article generation failed:", message);
    if (queueEntry) {
      try {
        await updateQueueStatus(queueEntry.id, "failed", message);
      } catch (innerError) {
        console.error("⚠️ Additionally failed to update queue status:", innerError);
      }
    }
    process.exitCode = 1;
  }
}

main();
