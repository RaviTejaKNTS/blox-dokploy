import "dotenv/config";

import { Readability } from "@mozilla/readability";
import OpenAI from "openai";
import { JSDOM } from "jsdom";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

import { slugify } from "@/lib/slug";

type QueueRow = {
  id: string;
  article_title: string | null;
  sources: string | null;
  universe_id: number | null;
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
  verification?: "Yes" | "No";
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
const SUPABASE_MEDIA_BUCKET = process.env.SUPABASE_MEDIA_BUCKET;

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

function parseQueueSources(raw: string | null): string[] {
  if (!raw) return [];
  const urls = raw
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => /^https?:\/\//i.test(entry));

  return Array.from(new Set(urls));
}

type RobloxUniverseMedia = {
  thumbnail_urls?: unknown;
  icon_url?: string | null;
  name?: string | null;
  display_name?: string | null;
};

function normalizeThumbnailUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry) return null;
      if (typeof entry === "string") return entry;
      if (typeof entry === "object" && "url" in entry) {
        const url = (entry as { url?: unknown }).url;
        return typeof url === "string" ? url : null;
      }
      return null;
    })
    .filter((url): url is string => typeof url === "string" && url.trim().length > 0);
}

async function pickUniverseThumbnail(universeId: number): Promise<{ url: string; gameName?: string } | null> {
  const { data, error } = await supabase
    .from("roblox_universes")
    .select("thumbnail_urls, icon_url, name, display_name")
    .eq("universe_id", universeId)
    .maybeSingle();

  if (error) {
    console.warn(`⚠️ Failed to load universe ${universeId} media:`, error.message);
    return null;
  }

  if (!data) return null;

  const media = data as RobloxUniverseMedia;
  const thumbs = normalizeThumbnailUrls(media.thumbnail_urls);
  const candidates = thumbs.length
    ? thumbs
    : media.icon_url && typeof media.icon_url === "string"
      ? [media.icon_url]
      : [];

  if (!candidates.length) return null;

  const selected = candidates[Math.floor(Math.random() * candidates.length)];
  const rawName = media.display_name ?? media.name ?? null;
  const gameName = rawName?.trim();
  return { url: selected, gameName: gameName && gameName.length ? gameName : undefined };
}

async function downloadResizeAndUploadCover(params: {
  imageUrl: string;
  slug: string;
  fileBase?: string;
}): Promise<string | null> {
  if (!SUPABASE_MEDIA_BUCKET) {
    console.log("⚠️ SUPABASE_MEDIA_BUCKET not configured. Skipping cover image upload.");
    return null;
  }

  try {
    const response = await fetch(params.imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8"
      }
    });

    if (!response.ok) {
      console.warn("⚠️ Failed to download universe thumbnail:", response.statusText);
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    const resized = await sharp(buffer)
      .resize(1200, 675, { fit: "cover", position: "attention" })
      .webp({ quality: 90, effort: 4 })
      .toBuffer();

    const fileBase =
      (params.fileBase ?? params.slug)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-{2,}/g, "-")
        .replace(/(^-|-$)/g, "") || params.slug;

    const path = `articles/${params.slug}/${fileBase}-cover.webp`;
    const storageClient = supabase.storage.from(SUPABASE_MEDIA_BUCKET);

    const { error } = await storageClient.upload(path, resized, {
      contentType: "image/webp",
      upsert: true
    });

    if (error) {
      console.warn("⚠️ Failed to upload article cover image:", error.message);
      return null;
    }

    const publicUrl = storageClient.getPublicUrl(path);
    return publicUrl.data.publicUrl ?? null;
  } catch (error) {
    console.warn("⚠️ Could not process cover image:", error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function uploadUniverseCoverImage(universeId: number, slug: string): Promise<string | null> {
  if (!SUPABASE_MEDIA_BUCKET) {
    console.log("⚠️ SUPABASE_MEDIA_BUCKET not configured. Skipping cover image upload.");
    return null;
  }

  const pick = await pickUniverseThumbnail(universeId);
  if (!pick) return null;
  return downloadResizeAndUploadCover({
    imageUrl: pick.url,
    slug,
    fileBase: pick.gameName ?? `universe-${universeId}`
  });
}

async function getNextQueueItem(): Promise<QueueRow | null> {
  const { data, error } = await supabase
    .from("article_generation_queue")
    .select("id, article_title, sources, status, attempts, last_attempted_at, last_error, universe_id")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch queue: ${error.message}`);
  }

  if (!data) return null;

  const rawUniverseId = (data as { universe_id?: unknown }).universe_id;
  const universeId =
    typeof rawUniverseId === "number"
      ? rawUniverseId
      : rawUniverseId !== null && rawUniverseId !== undefined && !Number.isNaN(Number(rawUniverseId))
        ? Number(rawUniverseId)
        : null;

  return {
    ...data,
    attempts: data.attempts ?? 0,
    status: (data.status as QueueRow["status"]) ?? "pending",
    last_attempted_at: data.last_attempted_at ?? null,
    last_error: data.last_error ?? null,
    sources: (data as { sources?: string | null }).sources ?? null,
    universe_id: Number.isFinite(universeId) ? universeId : null
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

async function gatherSources(topic: string, queueSources?: string | null): Promise<SourceDocument[]> {
  const collected: SourceDocument[] = [];
  const hostCounts = new Map<string, number>();
  const forumCount = { value: 0 };
  const seenUrls = new Set<string>();

  const manualUrls = parseQueueSources(queueSources ?? null);
  for (const url of manualUrls) {
    if (collected.length >= MAX_SOURCES) break;
    if (seenUrls.has(url)) continue;

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      continue;
    }

    const host = parsed.hostname.toLowerCase();
    if (isVideoHost(host)) continue;

    const isForum = isForumHost(host);
    if (isForum && forumCount.value >= MAX_FORUM_SOURCES) continue;

    const highQuality = isHighQualityHost(host);
    const hostLimit = highQuality ? MAX_PER_HOST_HIGH_QUALITY : MAX_PER_HOST_DEFAULT;
    const hostCount = hostCounts.get(host) ?? 0;
    if (hostCount >= hostLimit) continue;

    const parsedContent = await fetchArticleContent(url);
    if (!parsedContent) continue;

    collected.push({
      title: parsedContent.title || url,
      url,
      content: parsedContent.content,
      host,
      isForum
    });

    seenUrls.add(url);
    hostCounts.set(host, hostCount + 1);
    if (isForum) forumCount.value += 1;
    console.log(`source_${collected.length}: ${host} [queue]${isForum ? " [forum]" : ""}`);
  }

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

async function verifySourceWithPerplexity(topic: string, source: SourceDocument): Promise<"Yes" | "No"> {
  const prompt = `
For the Roblox topic "${topic}", is the following source accurate and suitable to use? Minor mistakes or slightly outdated details are acceptable if the overall source is relevant and accurate. Respond with exactly "Yes" if the source is acceptable, or "No" if it should not be used. No other words.

Title: ${source.title}
URL: ${source.url}
Host: ${source.host}
Content:
${source.content}
`.trim();

  const completion = await perplexity.chat.completions.create({
    model: "sonar",
    temperature: 0,
    max_tokens: 10,
    messages: [
      {
        role: "system",
        content:
          'You judge whether a source is acceptable for the topic. Reply with exactly "Yes" to approve or "No" to reject. Minor outdated details are fine if the overall source is accurate and relevant.'
      },
      { role: "user", content: prompt }
    ]
  });

  const verdict = completion.choices[0]?.message?.content?.trim().toLowerCase();
  return verdict && verdict.startsWith("yes") ? "Yes" : "No";
}

async function verifySources(topic: string, sources: SourceDocument[]): Promise<SourceDocument[]> {
  const verified: SourceDocument[] = [];

  for (const source of sources) {
    const decision = await verifySourceWithPerplexity(topic, source);
    source.verification = decision;
    console.log(`verify_source host=${source.host} verdict=${decision}`);
    if (decision === "Yes") {
      verified.push(source);
    }
  }

  if (verified.length < MIN_SOURCES) {
    throw new Error(`Not enough verified sources (${verified.length}/${MIN_SOURCES}).`);
  }

  return verified;
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

Right after the intro, give the main answer upfront with no heading. Can start with something like "first things first" or "Here's a quick answer" or anything that flows naturally. This should be just a small para only covering the most important aspect that like 2-3 lines long. Can use bullet points here if you think that will make it easier to scan.

Use full sentences and explain things clearly without fluff or repetition. Keep the article information dense but readable. Adjust depth based on the topic. If something is simple, keep it short. If something needs more explanation, expand it properly. 

Make sure you are covering everything related to the topic and not missing any important points. Don't drag and explain things that are very obvious to the reader. Do not focus on generic stuff or repeat what's already clear. The structure of article should be clean, focused and easy to scan. Structure itself should have a story like flow from one to other. Even keep the headings very casual and conversation-like.

Use only H2 headings for sections. Bullet points or tables are fine when they make information easier to scan. For step by step instructions, always use numbered steps. Before any bullets, tables, or steps, write a short paragraph that sets the context.

Keep the tone friendly and relatable, like a Roblox player sharing their knowledge. Do not use over technical language. Focus on solving the user’s intent completely so they leave with zero confusion. 

Sprinkle in some first hand experience where ever matters and needed. Do not blatently write like "from my experience" or "when I played". Give experience instead like "It took 4 trials for me" or "I found this particularly helpful during my first week" to make it feel personal and relatable. Share these moments naturally to build connection with the reader. Also write things that only a player who played the game would know.

If the article is a listicle or has any lists that you can give, present them in clear, easy-to-scan formats like tables or bullet points.

Do not add emojis, sources, URLs, or reference numbers. No emdashes anywhere. End with a short friendly takeaway that leaves the reader feeling guided and confident. No need for any cringe ending words like "Happy fishing and defending out there!". Just keep it real and helpful.

Topic: "${topic}"

Sources:
${sourceBlock}

Return JSON:
{
  "title": "A simple title that's easy to scan and understand. Keep it short with keyword and conversational. Don't write like key-value pairs. Just a simple title that people search on Google is what we need",
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

async function checkArticleCoverage(topic: string, article: DraftArticle): Promise<string> {
  const prompt = `
Does this Roblox article fully cover the topic with the right level of detail and no off-topic filler? If it is complete, reply exactly: Yes
If anything is missing, reply starting with: No
Then list the information that needs to be added and where to add it (e.g., which section or after which paragraph).

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
          "You evaluate completeness. Reply exactly 'Yes' if the article is detailed enough and fully on-topic. Otherwise start with 'No' and describe what to add and where to add it."
      },
      { role: "user", content: prompt }
    ]
  });

  const feedback = completion.choices[0]?.message?.content?.trim();
  if (!feedback) {
    throw new Error("Coverage check returned empty feedback.");
  }

  return feedback;
}

async function reviseArticleWithFeedback(
  topic: string,
  article: DraftArticle,
  sources: SourceDocument[],
  feedback: string,
  feedbackLabel: string
): Promise<DraftArticle> {
  const sourceBlock = formatSourcesForPrompt(sources);
  const label = feedbackLabel || "feedback";
  const prompt = `
You are updating a Roblox article after ${label}. Keep the same friendly, conversational tone and overall structure.
- If feedback starts with "Yes", return the original article unchanged.
- If feedback starts with "No", only adjust the parts that were flagged. Keep everything else as close as possible to the original voice.
- Use the ${label} plus the provided sources; do not invent new information.
- Make only the changes required by the feedback—no extra rewrites.

Topic: "${topic}"

${label}:
${feedback}

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

async function insertArticleDraft(
  article: DraftArticle,
  options: { slug?: string; universeId?: number | null; coverImage?: string | null } = {}
): Promise<{ id: string; slug: string }> {
  const slug = options.slug ?? (await ensureUniqueSlug(article.title));
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
      universe_id: options.universeId ?? null,
      cover_image: options.coverImage ?? null,
      is_published: false,
      word_count: wordCount
    })
    .select("id, slug")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to insert article draft: ${error.message}`);
  }

  if (!data?.id || !data.slug) {
    throw new Error("Article insert did not return expected data.");
  }

  return { id: data.id as string, slug: data.slug as string };
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

    const collectedSources = await gatherSources(topic, queueEntry.sources);
    console.log(`sources_collected=${collectedSources.length}`);

    const verifiedSources = await verifySources(topic, collectedSources);
    console.log(`sources_verified=${verifiedSources.length}`);

    const prompt = buildArticlePrompt(topic, verifiedSources);
    const draft = await draftArticle(prompt);
    console.log(`draft_title="${draft.title}" word_count=${estimateWordCount(draft.content_md)}`);

    const factCheckFeedback = await factCheckArticle(topic, draft, verifiedSources);
    const factCheckLog = factCheckFeedback.replace(/\s+/g, " ").slice(0, 200);
    console.log(`fact_check="${factCheckLog}${factCheckFeedback.length > 200 ? "..." : ""}"`);

    const factCheckedDraft = await reviseArticleWithFeedback(topic, draft, verifiedSources, factCheckFeedback, "fact-check feedback");
    console.log(`fact_checked_title="${factCheckedDraft.title}" word_count=${estimateWordCount(factCheckedDraft.content_md)}`);

    const coverageFeedback = await checkArticleCoverage(topic, factCheckedDraft);
    const coverageLog = coverageFeedback.replace(/\s+/g, " ").slice(0, 200);
    console.log(`coverage_check="${coverageLog}${coverageFeedback.length > 200 ? "..." : ""}"`);

    const coverageDraft = await reviseArticleWithFeedback(topic, factCheckedDraft, verifiedSources, coverageFeedback, "coverage feedback");
    console.log(`coverage_title="${coverageDraft.title}" word_count=${estimateWordCount(coverageDraft.content_md)}`);

    const finalFactCheckFeedback = await factCheckArticle(topic, coverageDraft, verifiedSources);
    const finalFactCheckLog = finalFactCheckFeedback.replace(/\s+/g, " ").slice(0, 200);
    console.log(`final_fact_check="${finalFactCheckLog}${finalFactCheckFeedback.length > 200 ? "..." : ""}"`);

    const finalDraft = await reviseArticleWithFeedback(
      topic,
      coverageDraft,
      verifiedSources,
      finalFactCheckFeedback,
      "final fact-check feedback"
    );
    console.log(`final_title="${finalDraft.title}" word_count=${estimateWordCount(finalDraft.content_md)}`);

    if (finalDraft.content_md.length < 400) {
      throw new Error("Draft content is too short after revision.");
    }

    const slug = await ensureUniqueSlug(finalDraft.title);

    let coverImage: string | null = null;
    if (queueEntry.universe_id) {
      console.log(`🖼️ Attaching universe cover from ${queueEntry.universe_id}...`);
      coverImage = await uploadUniverseCoverImage(queueEntry.universe_id, slug);
    }

    const article = await insertArticleDraft(finalDraft, {
      slug,
      universeId: queueEntry.universe_id,
      coverImage
    });

    console.log(`article_saved id=${article.id} slug=${article.slug} cover=${coverImage ?? "none"}`);

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
