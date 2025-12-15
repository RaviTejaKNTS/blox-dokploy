import "dotenv/config";

import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

const GOOGLE_SEARCH_KEY = process.env.GOOGLE_SEARCH_KEY!;
const GOOGLE_SEARCH_CX = process.env.GOOGLE_SEARCH_CX!;

type UniverseRow = {
  universe_id: number;
  slug: string;
  name: string | null;
  display_name: string | null;
  game_description_md: string | null;
  updated_at?: string | null;
  playing?: number | null;
};

type SearchEntry = { title: string; url: string };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function googleSearch(query: string, limit = 5): Promise<SearchEntry[]> {
  const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(
    query
  )}&num=${limit}&key=${GOOGLE_SEARCH_KEY}&cx=${GOOGLE_SEARCH_CX}`;

  console.log(`🔎 Searching: ${query}`);
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google Search failed: ${res.status} ${res.statusText} ${text ? `- ${text}` : ""}`);
  }

  const data = (await res.json()) as {
    items?: { title?: string; link?: string }[];
  };

  return (
    data.items
      ?.map((item) => ({
        title: item.title ?? "",
        url: item.link ?? "",
      }))
      .filter((item) => item.title && item.url) ?? []
  );
}

async function fetchReadableText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) return "";
    const html = await res.text();
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    const text = article?.textContent?.trim() ?? "";
    return text ? `\n[${url}]\n${text}` : "";
  } catch (error) {
    console.warn(`⚠️ Failed to fetch ${url}:`, error);
    return "";
  }
}

async function pickUniverse(input?: string | null): Promise<UniverseRow | null> {
  const baseSelect = "universe_id,slug,name,display_name,game_description_md,updated_at,playing";

  // If an explicit identifier is provided, resolve it directly.
  if (input) {
    const orFilters = [`slug.eq.${input}`, `name.eq.${input}`, `display_name.eq.${input}`];
    const numericId = Number(input);
    const baseQuery = supabase.from("roblox_universes").select(baseSelect).limit(1);
    const query = Number.isFinite(numericId)
      ? baseQuery.or(orFilters.join(",")).eq("universe_id", numericId)
      : baseQuery.or(orFilters.join(","));

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return (data as UniverseRow | null) ?? null;
  }

  // Otherwise, pick the oldest-updated universe missing a description.
  const { data, error } = await supabase
    .from("roblox_universes")
    .select(baseSelect)
    .or("game_description_md.is.null,game_description_md.eq.")
    .not("playing", "is", null)
    .order("playing", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: true, nullsFirst: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as UniverseRow | null) ?? null;
}

function truncateToWordLimit(text: string, maxWords = 90): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text.trim();
  return words.slice(0, maxWords).join(" ").trim();
}

async function buildDescription(gameName: string, sources: string): Promise<string> {
  const prompt = `
You are a Roblox games writer. Using only the facts from the sources below, write a concise 60–90 word paragraph that:
- Introduces what game is all about.
- Explains the core loop/objective and how to play (what to do, how to progress).
- Avoids speculation, filler, or unnecessary details.
- Uses plain text (no links, no placeholders, no code fences, no backticks) and one paragraph only.
- No generic sentences like "this is a fun game" or "this is a great game". Write something that is specific to the game and more detailed.
- Write in simple english and easy to understand style that everyone can easily understand. Talk like a friend talking to another friend.
- Write full sentences that feel complete and make sure every sentence adds value to the user.
- Do not start with generic sentences like "{game name} is a roblox game" or "this is a roblox game" or "In this game". Start with something hooking and unconventional. Always start with something that is unique and engaging. Don't repeat the same thing over and over again.
- Keep the writing engaging so the user gets a clear idea of what the game is about and how to play it.
- Still keep the tone professional enough to be a Roblox games writer.
- Complete the entire description. Do not leave in the middle of a sentence at the end.
- Do not use em-dashes.
- Return only the paragraph (no extra formatting, no code fences, no backticks).

Sources:
${sources}
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.2,
    max_tokens: 400,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? "";
  const cleaned = truncateToWordLimit(raw, 90);
  return cleaned;
}

async function main() {
  const input = process.argv[2];

  if (!GOOGLE_SEARCH_KEY || !GOOGLE_SEARCH_CX) {
    throw new Error("Missing GOOGLE_SEARCH_KEY or GOOGLE_SEARCH_CX in environment.");
  }

  const universe = await pickUniverse(input);
  if (!universe) {
    if (input) {
      console.error(`❌ Universe not found for "${input}".`);
    } else {
      console.error("❌ No universe available without a description. All caught up!");
    }
    process.exit(1);
  }

  const gameName = universe.display_name || universe.name || `Universe ${universe.universe_id}`;
  console.log(`🔍 Gathering context for "${gameName}" (${universe.slug})...`);

  const queries = [
    { q: `"${gameName}" Roblox "how to play"`, filter: (u: string) => true },
    { q: `"${gameName}" Roblox guide`, filter: (u: string) => true },
    { q: `"${gameName}" fandom`, filter: (u: string) => /fandom\.com/i.test(u) },
    { q: `"${gameName}" roblox wiki`, filter: (u: string) => true }
  ];

  const urls: string[] = [];
  const skipDomains = [/youtube\.com/i, /youtu\.be/i, /roblox\.com\/(home|discover|games)/i, /twitter\.com/i, /x\.com/i];

  const isUsable = (url: string) => !skipDomains.some((re) => re.test(url));

  for (const { q, filter } of queries) {
    const results = await googleSearch(q, 5);
    if (!results.length) {
      console.warn("⚠️ No search results for query:", q);
    }
    const picked = results.find(
      (r) => r.url && isUsable(r.url) && filter(r.url) && !urls.includes(r.url)
    );
    if (picked?.url) {
      console.log("🔗 Selected source:", picked.url);
      urls.push(picked.url);
    }
    await sleep(800);
  }

  if (!urls.length) {
    console.error("⚠️ No sources found from search. Check GOOGLE_SEARCH_KEY/CX, CSE config, or try a different query.");
    process.exit(1);
  }

  let sources = "";
  for (const url of urls) {
    const text = await fetchReadableText(url);
    if (text) {
      sources += `${text}\n`;
      const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
      console.log(`📄 Fetched ${wordCount} words from ${url}`);
    }
    await sleep(500);
  }

  const sourceWords = sources.trim().split(/\s+/).filter(Boolean);
  if (sourceWords.length < 20) {
    console.error("⚠️ Unable to extract enough readable text from sources (found too few words). Aborting.");
    process.exit(1);
  }

  console.log("🧠 Generating description...");
  const description = await buildDescription(gameName, sources);

  const descWords = description.trim().split(/\s+/).filter(Boolean);
  const badPatterns = [/couldn['’]t find/i, /could not find/i, /no information/i, /please share more details/i];
  const looksBad = badPatterns.some((re) => re.test(description)) || descWords.length < 30;
  if (looksBad) {
    console.error("❌ Generated description looks invalid (too short or fallback/apology text). Not updating.");
    process.exit(1);
  }

  const { error } = await supabase
    .from("roblox_universes")
    .update({ game_description_md: description })
    .eq("universe_id", universe.universe_id);

  if (error) {
    console.error("❌ Failed to update universe:", error.message);
    process.exit(1);
  }

  console.log(`✅ Updated ${gameName} (universe_id=${universe.universe_id}) with description:\n${description}`);
}

main().catch((error) => {
  console.error("❌ Error:", error instanceof Error ? error.message : error);
  process.exit(1);
});
