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

type SearchEntry = {
  title: string;
  url: string;
  snippet?: string;
};

type SourceDocument = {
  title: string;
  url: string;
  content: string;
};

type GeneratedArticle = {
  title: string;
  content_md: string;
  meta_description: string;
};

const AUTHOR_ID = "4fc99a58-83da-46f6-9621-7816e36b4088";
const DESIRED_SOURCE_COUNT = 3;
const SEARCH_RESULTS_PER_QUERY = 8;
const MAX_SOURCES_TO_FETCH = 10;
const QUALITY_DOMAINS = [
  "roblox.com",
  "fandom.com",
  "pcgamesn.com",
  "pockettactics.com",
  "gamerant.com",
  "polygon.com",
  "ign.com",
  "gamespot.com",
  "rockpapershotgun.com",
  "screenrant.com",
  "sportskeeda.com",
  "dexerto.com",
  "dotgg.gg",
  "vg247.com",
  "progameguides.com",
  "destructoid.com",
  "beebom.com",
  "techwiser.com",
  "game8.co",
  "androidcentral.com",
  "digitaltrends.com",
  "wired.com",
  "thegamer.com"
];

const ARTICLE_TYPE_GUIDANCE: Record<QueueRow["article_type"], string> = {
  listicle:
    "Structure the article around a clearly numbered list. Each item should include a bolded subheading, a friendly explanation, and why it matters. Summaries and quick takeaways at the end help reinforce the value.",
  how_to:
    "Lay out the steps in chronological order with detailed explanations, prerequisites, and troubleshooting tips. Wherever possible, use ordered lists, tables for controls, and clear callouts for important details.",
  explainer:
    "Break down complex ideas into approachable sections. Use subsections, comparisons to make the topic crystal clear while keeping the tone relaxed and conversational.",
  opinion:
    "Write in first person, weaving credible facts with personal perspective. Acknowledge opposing views, then explain your stance with anecdotes and evidence gathered from the sources.",
  news:
    "Lead with the biggest update, then provide context, timelines, and quotes or references from the sources. Include a 'What this means' section that helps readers understand the impact."
};

function normalizeTopic(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

const STOP_WORDS = new Set([
  "the",
  "this",
  "that",
  "with",
  "from",
  "here",
  "there",
  "have",
  "about",
  "when",
  "where",
  "which",
  "would",
  "could",
  "should",
  "these",
  "those",
  "into",
  "after",
  "before",
  "their",
  "while",
  "being",
  "using",
  "around",
  "among",
  "through",
  "under",
  "over",
  "again",
  "still",
  "every",
  "therefore",
  "however",
  "because",
  "toward",
  "towards",
  "having",
  "within",
  "amongst",
  "between",
  "without",
  "across",
  "along",
  "among",
  "against"
]);

function isSourceRelevant(docTitle: string, docContent: string, topic: string): boolean {
  const normalizedTopic = normalizeTopic(topic);
  if (!normalizedTopic) return false;

  const titleLower = docTitle.toLowerCase();
  if (titleLower.includes(normalizedTopic)) {
    return true;
  }

  const contentLower = docContent.toLowerCase();
  const topicWords = Array.from(
    new Set(
      normalizedTopic
        .split(" ")
        .filter((word) => word.length > 3 && !STOP_WORDS.has(word))
    )
  );
  if (topicWords.length === 0) {
    return contentLower.includes(normalizedTopic);
  }

  let matchCount = 0;
  for (const word of topicWords) {
    if (titleLower.includes(word) || contentLower.includes(word)) {
      matchCount += 1;
    }
  }

  const requiredMatches = Math.max(1, Math.ceil(topicWords.length * 0.8));
  return matchCount >= requiredMatches;
}

function parseArgs(): { queueId: string } {
  const args = process.argv.slice(2);
  const queueIdIndex = args.indexOf("--queue-id");
  if (queueIdIndex !== -1 && args[queueIdIndex + 1]) {
    return { queueId: args[queueIdIndex + 1] };
  }

  const eqArg = args.find((arg) => arg.startsWith("--queue-id="));
  if (eqArg) {
    return { queueId: eqArg.split("=")[1] };
  }

  if (args[0]) {
    return { queueId: args[0] };
  }

  throw new Error("Please provide a queue id via --queue-id <uuid>.");
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

const GOOGLE_SEARCH_KEY = process.env.GOOGLE_SEARCH_KEY!;
const GOOGLE_SEARCH_CX = process.env.GOOGLE_SEARCH_CX!;

async function fetchQueueEntry(queueId: string): Promise<QueueRow> {
  const { data, error } = await supabase
    .from("article_generation_queue")
    .select("id, article_title, article_type, category_id, status, attempts, last_attempted_at, last_error")
    .eq("id", queueId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load queue entry: ${error.message}`);
  }

  if (!data) {
    throw new Error("Queue entry not found.");
  }

  return data as QueueRow;
}

async function fetchCategory(categoryId: string | null): Promise<CategoryRow | null> {
  if (!categoryId || categoryId.trim().toLowerCase() === "null") {
    return null;
  }

  const { data, error } = await supabase
    .from("article_categories")
    .select("id, name, slug")
    .eq("id", categoryId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load category: ${error.message}`);
  }

  if (!data) {
    console.warn(`⚠️ Category ${categoryId} not found. Proceeding without assigning a category.`);
    return null;
  }

  return data as CategoryRow;
}

function buildSearchQueries(title: string, articleType: QueueRow["article_type"]): string[] {
  const sanitized = title.replace(/\s+/g, " ").trim();
  const baseQueries = [
    `"${sanitized}"`,
    `"${sanitized}" Roblox`,
    `"${sanitized}" release date`
  ];

  switch (articleType) {
    case "listicle":
      baseQueries.push(`"${sanitized}" best tips`, `"${sanitized}" top features`);
      break;
    case "how_to":
      baseQueries.push(`"how to" "${sanitized}"`, `"${sanitized}" guide step by step`);
      break;
    case "explainer":
      baseQueries.push(`"${sanitized}" explained`, `"${sanitized}" overview`);
      break;
    case "opinion":
      baseQueries.push(`"${sanitized}" review`, `"${sanitized}" impressions`);
      break;
    case "news":
      baseQueries.push(`"${sanitized}" update news`, `"${sanitized}" announcement`);
      break;
    default:
      break;
  }

  return Array.from(new Set(baseQueries));
}

async function googleSearch(query: string, limit = SEARCH_RESULTS_PER_QUERY): Promise<SearchEntry[]> {
  console.log(`🔎 Searching Google for: ${query}`);
  const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&num=${limit}&key=${GOOGLE_SEARCH_KEY}&cx=${GOOGLE_SEARCH_CX}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Google Search failed (${response.status} ${response.statusText}) for query: ${query}`);
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

function isPreferredDomain(host: string): boolean {
  const normalized = host.replace(/^www\./i, "").toLowerCase();
  return QUALITY_DOMAINS.some((domain) => normalized === domain || normalized.endsWith(`.${domain}`));
}

async function fetchArticleText(url: string): Promise<string | null> {
  try {
    console.log(`🌐 Fetching source: ${url}`);
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    if (!res.ok) {
      console.warn(`Skipping ${url}: HTTP ${res.status}`);
      return null;
    }

    const html = await res.text();
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article?.textContent) {
      console.warn(`Readability could not parse ${url}`);
      return null;
    }

    return article.textContent.replace(/\s+/g, " ").trim();
  } catch (error) {
    console.warn(`Failed to fetch ${url}:`, error);
    return null;
  }
}

async function gatherSourceDocuments(title: string, articleType: QueueRow["article_type"]): Promise<SourceDocument[]> {
  const queries = buildSearchQueries(title, articleType);
  const collected: SourceDocument[] = [];
  const seenHosts = new Set<string>();
  const seenUrls = new Set<string>();
  const topic = title;

  for (const query of queries) {
    if (collected.length >= DESIRED_SOURCE_COUNT) break;
    const results = await googleSearch(query, SEARCH_RESULTS_PER_QUERY);
    console.log(`   ↳ ${results.length} results returned for query.`);

    for (const result of results) {
      if (collected.length >= MAX_SOURCES_TO_FETCH) break;

      if (seenUrls.has(result.url)) continue;

      let parsed: URL;
      try {
        parsed = new URL(result.url);
      } catch {
        continue;
      }

      const host = parsed.hostname.toLowerCase();
      if (seenHosts.has(host)) {
        continue;
      }

      const preferred = isPreferredDomain(host);
      if (!preferred && collected.length < DESIRED_SOURCE_COUNT) {
        seenHosts.add(host);
      } else if (!preferred) {
        continue;
      } else {
        seenHosts.add(host);
      }

      const content = await fetchArticleText(result.url);
      if (!content) {
        continue;
      }

      if (!isSourceRelevant(result.title, content, topic)) {
        console.log(`   ⚠️ Skipping ${host} — content not focused on topic.`);
        continue;
      }

      seenUrls.add(result.url);
      console.log(`   ✅ Accepted source from ${host}`);
      collected.push({
        title: result.title,
        url: result.url,
        content
      });

      if (collected.length >= DESIRED_SOURCE_COUNT) {
        break;
      }
    }
  }

  if (collected.length < DESIRED_SOURCE_COUNT) {
    console.log(`⚠️ Only collected ${collected.length} preferred sources; attempting broader search.`);

    for (const query of queries) {
      if (collected.length >= DESIRED_SOURCE_COUNT) break;
      const results = await googleSearch(`${query} roblox game`, SEARCH_RESULTS_PER_QUERY);
      console.log(`   ↳ Fallback search returned ${results.length} results.`);

      for (const result of results) {
        if (collected.length >= DESIRED_SOURCE_COUNT) break;

        if (seenUrls.has(result.url)) continue;

        let parsed: URL;
        try {
          parsed = new URL(result.url);
        } catch {
          continue;
        }

        const host = parsed.hostname.toLowerCase();
        if (seenHosts.has(host)) continue;

        const content = await fetchArticleText(result.url);
        if (!content) continue;

        if (!isSourceRelevant(result.title, content, topic)) {
          console.log(`   ⚠️ Fallback skip ${host} — not aligned with topic.`);
          continue;
        }

        seenHosts.add(host);
        seenUrls.add(result.url);
        console.log(`   ✅ (Fallback) accepted source from ${host}`);
        collected.push({
          title: result.title,
          url: result.url,
          content
        });
      }
    }
  }

  if (collected.length === 0) {
    throw new Error("No reliable sources were found for this topic.");
  }

  if (collected.length < DESIRED_SOURCE_COUNT) {
    console.log(
      `⚠️ Proceeding with ${collected.length} vetted source${collected.length === 1 ? "" : "s"} due to limited coverage.`
    );
  }

  return collected.slice(0, DESIRED_SOURCE_COUNT);
}

function buildPrompt(
  queue: QueueRow,
  category: CategoryRow | null,
  sources: SourceDocument[]
): string {
  const sourceBlocks = sources
    .map(
      (src, index) =>
        `=== SOURCE ${index + 1} ===\nTitle: ${src.title}\nURL: ${src.url}\nCONTENT:\n${src.content}\n`
    )
    .join("\n");

  return `
You are a seasoned Roblox journalist who writes in a warm, friendly tone—like a friend guiding another friend through the game.

Important context:
- Original requested title (do NOT reuse verbatim): "${queue.article_title}"
- Article type: ${queue.article_type}
- Category: ${category ? category.name : "Unassigned"}

Your job:
1. Absorb every detail from the sources (they represent the top of Google's results, read them thoroughly).
2. Produce a new, SEO-friendly title that is different from the requested title but still relevant and catchy.
3. Write a comprehensive, reader-first article that brings every important detail together. Hook readers fast and keep a grounded, plain-english style—avoid generic greetings like “Hey there, fellow Roblox adventurers!”.
4. When the topic benefits from tables, bullet points, or step-by-step guides, include them and make sure nothing is glossed over. Never skip data that appears in the sources.
5. Keep the tone factual yet friendly. Light personal touches are okay only when they reinforce real information.
6. Maintain clarity and usefulness; every paragraph should deliver value or concrete insight.

Article type guidance:
${ARTICLE_TYPE_GUIDANCE[queue.article_type]}

Formatting rules:
- Deliver the body in Markdown.
- Make headings scannable, use subheadings generously, and keep paragraphs tight.
- Any lists or tables mentioned in the sources should be reconstructed with full detail.
- Cite sources inline in a natural way (e.g., “According to Polygon...”) but no need for footnotes.

Output requirements:
Return valid JSON with the following shape:
{
  "title": "SEO-friendly title here (different from the requested one)",
  "content_md": "Full Markdown article here",
  "meta_description": "150–160 character friendly summary that mentions the topic naturally."
}

SOURCES:
${sourceBlocks}
`.trim();
}

async function callOpenAi(prompt: string): Promise<GeneratedArticle> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.4,
    max_tokens: 6000,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You are an experienced games journalist focused on Roblox coverage. You always return valid JSON."
      },
      {
        role: "user",
        content: prompt
      }
    ]
  });

  const raw = completion.choices[0].message?.content ?? "";
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Model response was not valid JSON:\n${raw}\n${(error as Error).message}`);
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof (parsed as any).title !== "string" ||
    typeof (parsed as any).content_md !== "string" ||
    typeof (parsed as any).meta_description !== "string"
  ) {
    throw new Error(`Model response missing fields:\n${raw}`);
  }

  return parsed as GeneratedArticle;
}

async function ensureUniqueSlug(base: string): Promise<string> {
  let slug = base || slugify(Date.now().toString());
  let counter = 2;

  while (true) {
    const { data, error } = await supabase
      .from("articles")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to check slug uniqueness: ${error.message}`);
    }

    if (!data) {
      return slug;
    }

    slug = `${base}-${counter}`;
    counter += 1;
  }
}

function computeWordCount(markdown: string): number {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/[#>*_\-\[\]\(\)]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return 0;
  return text.split(" ").length;
}

async function insertArticle(
  generated: GeneratedArticle,
  category: CategoryRow | null,
  queue: QueueRow
): Promise<string> {
  const requestedTitle = queue.article_title.trim().toLowerCase();
  let finalTitle = generated.title.trim();

  if (!finalTitle) {
    throw new Error("Generated article title is empty.");
  }

  if (finalTitle.toLowerCase() === requestedTitle) {
    finalTitle = `${finalTitle} – A Fresh Perspective`;
  }

  const slugBase = slugify(finalTitle);
  const slug = await ensureUniqueSlug(slugBase);
  const wordCount = computeWordCount(generated.content_md);

  const { data, error } = await supabase
    .from("articles")
    .insert({
      title: finalTitle,
      slug,
      content_md: generated.content_md,
      category_id: category ? category.id : null,
      author_id: AUTHOR_ID,
      is_published: false,
      meta_description: generated.meta_description,
      word_count: wordCount
    })
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to insert article: ${error.message}`);
  }

  if (!data) {
    throw new Error("Article insertion returned no data.");
  }

  return data.id as string;
}

async function updateQueueStatus(id: string, status: "completed" | "failed", message?: string | null) {
  const payload: Record<string, unknown> = {
    status,
    last_attempted_at: new Date().toISOString(),
    last_error: message ? message.slice(0, 500) : null
  };

  const { error } = await supabase
    .from("article_generation_queue")
    .update(payload)
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to update queue status: ${error.message}`);
  }
}

async function main() {
  const { queueId } = parseArgs();
  let queueEntry: QueueRow | null = null;

  try {
    console.log(`📥 Starting article generation for queue id ${queueId}`);
    queueEntry = await fetchQueueEntry(queueId);

    if (queueEntry.status !== "pending") {
      throw new Error(`Queue entry is ${queueEntry.status}; expected pending.`);
    }

    console.log(`   • Requested topic: ${queueEntry.article_title}`);
    console.log(`   • Article type: ${queueEntry.article_type}`);
    const category = await fetchCategory(queueEntry.category_id);
    if (category) {
      console.log(`   • Category: ${category.name}`);
    }
    const sources = await gatherSourceDocuments(queueEntry.article_title, queueEntry.article_type);
    console.log(`📚 Collected ${sources.length} source documents.`);
    const prompt = buildPrompt(queueEntry, category, sources);

    const generated = await callOpenAi(prompt);
    console.log(`✍️  Model returned content with length ${generated.content_md.length} characters.`);

    if (!generated.content_md || generated.content_md.trim().length < 200) {
      throw new Error("Generated content appears empty or too short.");
    }

  console.log("📝 Inserting article into Supabase …");
  await insertArticle(generated, category, queueEntry);
  await updateQueueStatus(queueEntry.id, "completed", null);

  console.log(`✅ Article generated and stored for queue item "${queueEntry.article_title}".`);
} catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Article generation failed: ${message}`);
    if (queueEntry) {
      try {
        await updateQueueStatus(queueEntry.id, "failed", message);
      } catch (updateError) {
        console.error("⚠️ Failed to update queue status after error:", updateError);
      }
    }
    process.exitCode = 1;
  }
}

main();
