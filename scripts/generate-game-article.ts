import "dotenv/config";

import OpenAI from "openai";

import { createClient } from "@supabase/supabase-js";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import sharp from "sharp";

import { refreshGameCodesWithSupabase } from "@/lib/admin/game-refresh";
import { getSupabaseConfig } from "@/lib/supabase-config";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

const GOOGLE_SEARCH_KEY = process.env.GOOGLE_SEARCH_KEY!;
const GOOGLE_SEARCH_CX = process.env.GOOGLE_SEARCH_CX!;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const normalizeForMatch = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

type SearchEntry = {
  title: string;
  url: string;
  snippet?: string;
};

type ArticleResponse = {
  intro_md: string;
  redeem_md: string;
  description_md: string;
};

function isArticleResponse(value: unknown): value is ArticleResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return ["intro_md", "redeem_md", "description_md"].every(
    (key) => typeof candidate[key] === "string" && Boolean(candidate[key])
  );
}

async function googleSearch(query: string, limit = 5): Promise<SearchEntry[]> {
  const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(
    query
  )}&num=${limit}&key=${GOOGLE_SEARCH_KEY}&cx=${GOOGLE_SEARCH_CX}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Google Search failed: ${res.statusText}`);
  }

  const data = (await res.json()) as {
    items?: { title?: string; link?: string; snippet?: string }[];
  };

  return (
    data.items
      ?.map((item) => ({
        title: item.title ?? "",
        url: item.link ?? "",
        snippet: item.snippet,
      }))
      .filter((item) => item.title && item.url) ?? []
  );
}

async function findGameCodeArticle(gameName: string, siteSpecifier: string) {
  const query = `"${gameName}" codes site:${siteSpecifier}`;
  const results = await googleSearch(query, 5);
  const normalizedGame = normalizeForMatch(gameName);

  for (const entry of results) {
    const normalizedTitle = normalizeForMatch(entry.title);
    if (!normalizedTitle.includes(normalizedGame)) continue;
    if (!/\bcodes?\b/i.test(entry.title)) continue;
    return entry.url;
  }

  return null;
}

async function fetchArticleText(url: string): Promise<string> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await res.text();
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    const readableText = article?.textContent?.trim();

    if (readableText) {
      return `\n[${url}]\n${readableText}`;
    }

    if (article?.content) {
      const fragment = JSDOM.fragment(article.content);
      const fallbackText = fragment.textContent?.trim();
      if (fallbackText) {
        return `\n[${url}]\n${fallbackText}`;
      }
    }

    return `\n[${url}]\n`;
  } catch {
    console.warn(`⚠️ Failed to fetch ${url}`);
    return "";
  }
}

function buildArticlePrompt(gameName: string, sources: string) {
  return `
You are a professional Roblox journalist.
Use ONLY the information from these trusted sources below to write an accurate, detailed, and structured article.
Do NOT invent or guess anything. If something isn't in the sources, skip it.

=== SOURCES START ===
${sources}
=== SOURCES END ===

Write in clean markdown, no em-dashes, no placeholders, no speculation. The entire article should be between 600–800 words long in average. Keep the language simple, full sentences and like friend talking to another friend. 

Sections required:
1. intro_md – 1–2 paragraphs. Start with something that hook the readers in simple on-point and grounded way. Introduce the ${gameName} in a line or two and tell users how these codes can be helpful in engaging, relatable, crisp and on-point way. Keep it grounded and talk like friend explaining things to a friend.
2. redeem_md – "## How to Redeem ${gameName} Codes" with numbered steps.
   - If any requirements, conditions, or level limits appear anywhere in the sources, summarize them clearly before listing steps.
   - If in the requirements, there's a link to follow any community or anything, include that link when mentioning requirements.
   - If there are no requirements, write a line or teo before the steps, to give cue to the actual steps. 
   - Write step-by-step in numbered list and keep the sentences simple and easy to scan. Do not use : and write like key value pairs, just write simple sentences.
   - Link the line “Launch ${gameName}” to its actual Roblox page (from the sources if available). Link to the anchor text of ${gameName}
   - If the game does not have codes system yet, no need for step-by-step instructions, just convey the information in clear detail. 
3. description_md – include all these sections:
   - ## Why Is My ${gameName} Code Not Working?
     Bullet list of real reasons from sources. Be very detailed and include all the reasons for why any code could fail. Before the bullet points, write at least a line or two to give cue to the actual points.
     Also, after the points have mentioned, write a line or two to talk to the user to give more context about this if you have or skip.
   - ## Where to Find More ${gameName} Codes
     1–2 paragraphs. Use the sources to locate the official Roblox page plus any verified social channels (Discord, Twitter/X, Trello, Roblox Group, etc.).
     Mention each channel by exact name (Discord server title, channel names, Twitter @handle, Roblox group title, etc.) and explain what players can find there.
     Include direct Markdown links to those pages using the exact URLs from the sources. 
     Those links should also be inside the paras seamlessly when mentioned, no bullet-points in this section at all. Link to the correct anchor text like Discord channel name or twitter account name. Else link to works like Discord, Twitter, Community, etc. Don't link to words like here. 
     Also suggest users to bookmark our page with ctrl + D on Windows (CMD + D on mac). Tell them that we will update the article with new working active codes as soon as they dropped.
   - ## What Rewards You Normally Get?
     Bullet list or table of typical rewards (from the sources). Include all the reward types we get for this game with clear details, description of each reward, and all the info that makes sense to include in this section. The section should be detailed, in-depth, and everything should be cleanly explained. Write at least a line or two before jumping into the points or table to give cue to the audience.
   - ## How to Play ${gameName} and What It's All About
     200–300 words explaining the game and how codes benefit players. Talk like a friend explaining the game to another friend and explain everything like a story.

Return valid JSON:
{
  "intro_md": "...",
  "redeem_md": "...",
  "description_md": "..."
}
`;
}

async function main() {
  const gameName = process.argv[2];

  if (!gameName) {
    console.error("❌ Please provide a game name.\nExample: npm run generate \"Anime Defenders\"");
    process.exit(1);
  }

  console.log(`🔍 Collecting Google data for "${gameName}"...`);

  const mainQuery = `"${gameName}" Roblox codes (site:beebom.com OR site:destructoid.com OR site:progameguides.com OR site:roblox.com OR site:pcgamesn.com OR site:pockettactics.com OR site:fandom.com OR site:tryhardguides.com OR site:techwiser.com)`;
  const mainResults = await googleSearch(mainQuery, 5);

  const topLinks = mainResults.slice(0, 3).map((entry) => entry.url);
  let fullText = "";
  for (const url of topLinks) {
    console.log(`📖 Reading full page: ${url}`);
    fullText += await fetchArticleText(url);
    await sleep(1500);
  }

  const extraQueries = [
    `how to redeem "${gameName}" Roblox codes (site:beebom.com OR site:destructoid.com OR site:progameguides.com OR site:roblox.com OR site:pcgamesn.com OR site:pockettactics.com OR site:gamerant.com OR site:fandom.com OR site:tryhardguides.com OR site:techwiser.com)`,
    `"${gameName}" Roblox code rewards OR bonuses`,
    `how to play "${gameName}" Roblox guide OR wiki site:fandom.com OR site:roblox.com`,
  ];

  let snippetText = "";
  for (const q of extraQueries) {
    console.log(`🌐 Searching: ${q}`);
    const entries = await googleSearch(q);
    if (!entries.length) continue;

    const formatted = entries
      .map((entry) => {
        const snippetSuffix = entry.snippet ? `\nSnippet: ${entry.snippet}` : "";
        return `Title: ${entry.title}\nURL: ${entry.url}${snippetSuffix}`;
      })
      .join("\n\n");

    snippetText += `\n\n${formatted}`;
    await sleep(1000);
  }

  const combinedSources = `${fullText}\n\n${snippetText}`;

  const [robloxDenSource, beebomSource] = await Promise.all([
    findGameCodeArticle(gameName, "robloxden.com/game-codes"),
    findGameCodeArticle(gameName, "beebom.com"),
  ]);

  if (robloxDenSource) {
    console.log(`🔗 Roblox Den source found: ${robloxDenSource}`);
  } else {
    console.log("⚠️ No matching Roblox Den codes article found.");
  }

  if (beebomSource) {
    console.log(`🔗 Beebom source found: ${beebomSource}`);
  } else {
    console.log("⚠️ No matching Beebom codes article found.");
  }

  console.log("🧠 Writing detailed article using GPT-4.1-mini...");
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.3,
    max_tokens: 5000,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: buildArticlePrompt(gameName, combinedSources) }],
  });

  const raw = completion.choices[0].message?.content ?? "";

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.error("⚠️ Could not parse JSON. Raw output:\n", raw);
    throw new Error((error as Error).message || "Model returned invalid JSON.");
  }

  if (!isArticleResponse(parsed)) {
    console.error("⚠️ Missing sections. Raw output:\n", raw);
    throw new Error("Article generation incomplete.");
  }

  const article = parsed;

  const name = gameName.trim();
  let slug = gameName.toLowerCase().replace(/\s+/g, "-") + "-codes";

  const { data: existing } = await supabase
    .from("games")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (existing) {
    slug = `roblox-${slug}`;
    console.log(`⚠️ Duplicate slug detected, using "${slug}" instead.`);
  }

  console.log(`📦 Inserting article for "${name}"...`);
  const insertPayload: Record<string, unknown> = {
    name,
    slug,
    intro_md: article.intro_md,
    redeem_md: article.redeem_md,
    description_md: article.description_md,
    is_published: true,
  };

  if (robloxDenSource) insertPayload.source_url = robloxDenSource;
  if (beebomSource) insertPayload.source_url_2 = beebomSource;

  const { error } = await supabase.from("games").insert(insertPayload);

  if (error) throw error;
  console.log(`✅ "${name}" inserted successfully as draft (${slug})`);

  await maybeAttachCoverImage({ slug, name });
  await refreshCodesForGame(slug);
}

main().catch((error) => {
  console.error("❌ Error:", error instanceof Error ? error.message : error);
  process.exit(1);
});
async function refreshCodesForGame(slug: string) {
  if (!slug) {
    console.log("⚠️ Missing slug, skipping post-insert refresh.");
    return;
  }

  const { data: gameRecord, error: fetchError } = await supabase
    .from("games")
    .select("id, slug, source_url, source_url_2, source_url_3")
    .eq("slug", slug)
    .maybeSingle();

  if (fetchError) {
    console.error(`⚠️ Unable to load game for ${slug}:`, fetchError.message);
    return;
  }

  if (!gameRecord) {
    console.log(`⚠️ No game found for slug ${slug}. Skipping refresh.`);
    return;
  }

  console.log(`🔁 Syncing codes for ${slug}...`);
  const refreshResult = await refreshGameCodesWithSupabase(supabase, gameRecord);

  if (!refreshResult.success) {
    console.error(`⚠️ Failed to sync codes for ${slug}: ${refreshResult.error}`);
    return;
  }

  const removedNote = refreshResult.removed ? `, removed ${refreshResult.removed}` : "";
  console.log(
    `✔ ${slug} — ${refreshResult.upserted} codes upserted (found ${refreshResult.found}${removedNote}, expired ${refreshResult.expired})`
  );
}

async function maybeAttachCoverImage(game: { slug: string; name: string }) {
  if (!process.env.SUPABASE_MEDIA_BUCKET) {
    console.log("⚠️ SUPABASE_MEDIA_BUCKET not configured. Skipping cover image upload.");
    return;
  }

  const existing = await supabase
    .from("games")
    .select("id, cover_image")
    .eq("slug", game.slug)
    .maybeSingle();

  if (existing.error) {
    console.error("⚠️ Failed to check existing cover image:", existing.error.message);
    return;
  }

  if (!existing.data?.id) {
    console.error("⚠️ Game record not found when preparing cover image.");
    return;
  }

  if (existing.data.cover_image) {
    console.log("ℹ️ Cover image already exists. Skipping upload.");
    return;
  }

  console.log("🖼️ Searching for cover image...");
  const imageUrl = await findRobloxImageUrl(game.name);

  if (!imageUrl) {
    console.log("⚠️ No suitable image found.");
    return;
  }

  try {
    const uploadedUrl = await downloadResizeAndUploadImage({
      imageUrl,
      slug: game.slug,
      gameName: game.name,
    });

    if (!uploadedUrl) {
      console.log("⚠️ Upload failed or no URL returned.");
      return;
    }

    const { error: updateError } = await supabase
      .from("games")
      .update({ cover_image: uploadedUrl })
      .eq("id", existing.data.id);

    if (updateError) {
      console.error("⚠️ Failed to store cover image URL:", updateError.message);
      return;
    }

    console.log("✅ Cover image uploaded and stored.");
  } catch (err) {
    console.error("⚠️ Could not attach cover image:", err instanceof Error ? err.message : err);
  }
}

async function findRobloxImageUrl(gameName: string): Promise<string | null> {
  const query = `site:roblox.com ${gameName} game`;
  const results = await googleSearch(query, 4);

  for (const entry of results) {
    if (!entry.url) continue;
    if (!/roblox\.com\//i.test(entry.url)) continue;

    const image = await fetchPrimaryImageFromPage(entry.url);
    if (image) return image;
    await sleep(1000);
  }

  return null;
}

async function fetchPrimaryImageFromPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return null;

    const html = await res.text();
    const dom = new JSDOM(html);
    const document = dom.window.document;

    const metaOg = document.querySelector('meta[property="og:image"]') as HTMLMetaElement | null;
    if (metaOg?.content) return metaOg.content;

    const metaTwitter = document.querySelector('meta[name="twitter:image"]') as HTMLMetaElement | null;
    if (metaTwitter?.content) return metaTwitter.content;

    const img = document.querySelector("img") as HTMLImageElement | null;
    if (img?.src) return img.src;
  } catch (error) {
    console.warn("⚠️ Failed to extract image from page", url, error);
  }

  return null;
}

async function downloadResizeAndUploadImage(params: {
  imageUrl: string;
  slug: string;
  gameName: string;
}): Promise<string | null> {
  const response = await fetch(params.imageUrl);
  if (!response.ok) {
    console.warn("⚠️ Failed to download image:", response.statusText);
    return null;
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  const resized = await sharp(buffer)
    .resize(1200, 675, { fit: "cover", position: "attention" })
    .webp({ quality: 90, effort: 4 })
    .toBuffer();

  const fileBase = params.gameName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/(^-|-$)/g, "") || params.slug;

  const fileName = `${fileBase}-codes.webp`;
  const path = `games/${params.slug}/${fileName}`;

  const bucket = process.env.SUPABASE_MEDIA_BUCKET!;
  const { supabaseUrl } = getSupabaseConfig();
  const storageClient = supabase.storage.from(bucket);

  const { error } = await storageClient.upload(path, resized, {
    contentType: "image/webp",
    upsert: true,
  });

  if (error) {
    console.error("⚠️ Failed to upload cover image:", error.message);
    return null;
  }

  const publicUrl = storageClient.getPublicUrl(path);
  return publicUrl.data.publicUrl;
}
