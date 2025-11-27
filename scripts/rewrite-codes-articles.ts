import "dotenv/config";

import { Readability } from "@mozilla/readability";
import OpenAI from "openai";
import { JSDOM } from "jsdom";
import { createClient } from "@supabase/supabase-js";

type GameRow = {
  id: string;
  name: string;
  slug: string;
  author_id: string | null;
  created_at: string | null;
  intro_md: string | null;
  redeem_md: string | null;
  troubleshoot_md: string | null;
  rewards_md: string | null;
  seo_description: string | null;
  description_md: string | null;
  roblox_link: string | null;
  source_url: string | null;
  source_url_2: string | null;
  source_url_3: string | null;
  re_rewritten_at: string | null;
  is_published: boolean;
};

type RewritePayload = {
  intro_md: string;
  rewards_md: string;
  troubleshoot_md: string;
  meta_description: string;
  game_display_name: string;
  redeem_md?: string;
};

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const ALLOWED_SOURCE_HOSTS = ["beebom.com", "destructoid.com"];
const MAX_SOURCE_CHARS = 4200;
const MAX_CONTEXT_ARTICLE = 4500;

type SectionType = "codeNotWorking" | "rewardsOverview";

type SectionConfig = {
  type: SectionType;
  variant?: number;
};

const SECTION_TITLE_VARIANTS: Record<SectionType, Array<(gameName: string) => string>> = {
  codeNotWorking: [
    () => "## Why Codes Might Not Work",
    (gameName) => `## Why ${gameName} Codes Might Not Work`,
    (gameName) => `## ${gameName} Codes Not Working?`,
    () => "## Trouble Redeeming Codes?",
    (gameName) => `## Why Is My ${gameName} Code Not Working?`
  ],
  rewardsOverview: [
    () => "## What Rewards You Normally Get?",
    () => "## Rewards You Can Usually Expect From These Codes",
    (gameName) => `## What Rewards You Get From ${gameName}`,
    () => "## What Rewards You Get From These Codes",
    () => "## Rewards You Get From These Codes"
  ]
};

type CliOptions = {
  slugs: string[];
  dryRun: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  const slugs: string[] = [];
  let dryRun = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--slug" || arg === "-s") {
      const next = argv[i + 1];
      if (next) {
        slugs.push(next.trim());
        i += 1;
      }
    } else if (arg.startsWith("--slug=")) {
      const value = arg.split("=")[1];
      if (value) slugs.push(value.trim());
    } else if (arg === "--dry-run") {
      dryRun = true;
    }
  }

  const uniqueSlugs = Array.from(new Set(slugs.filter(Boolean)));
  if (uniqueSlugs.length > 1) {
    console.log("ℹ️ Multiple slugs provided; only the first will be processed per run.");
  }

  return { slugs: uniqueSlugs.slice(0, 1), dryRun };
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, max: number): string {
  if (!value) return "";
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function buildExistingArticleContext(game: GameRow): string {
  const parts: string[] = [];
  if (game.intro_md) parts.push(`## Intro\n${game.intro_md}`);
  if (game.redeem_md) parts.push(`## Redeem\n${game.redeem_md}`);
  if (game.rewards_md) parts.push(`## Rewards\n${game.rewards_md}`);
  if (game.troubleshoot_md) parts.push(`## Troubleshoot\n${game.troubleshoot_md}`);
  if (!parts.length) return "No prior article content available.";

  const combined = parts.join("\n\n").trim();
  return truncate(combined, MAX_CONTEXT_ARTICLE);
}

function isAllowedSource(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    return ALLOWED_SOURCE_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

async function fetchSourceExcerpt(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      }
    });
    if (!response.ok) {
      console.warn(`⚠️ Failed to fetch ${url}: ${response.status}`);
      return null;
    }
    const html = await response.text();
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const parsed = reader.parse();
    const text = normalizeWhitespace(
      parsed?.textContent ||
        dom.window.document.body?.textContent ||
        ""
    );
    if (!text) return null;
    return `[${url}]\n${truncate(text, MAX_SOURCE_CHARS)}`;
  } catch (error) {
    console.warn(`⚠️ Error reading ${url}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

async function loadSourceExcerpts(game: GameRow): Promise<string> {
  const urls = [game.source_url, game.source_url_2, game.source_url_3]
    .filter((url): url is string => isAllowedSource(url));

  if (!urls.length) {
    return "No Beebom or Destructoid sources linked for this game.";
  }

  const unique = Array.from(new Set(urls));
  const excerpts: string[] = [];
  for (const url of unique) {
    const content = await fetchSourceExcerpt(url);
    if (content) {
      excerpts.push(content);
    }
  }

  if (!excerpts.length) {
    return "No readable content could be fetched from the linked sources.";
  }

  return excerpts.join("\n\n");
}

function stripUnsupportedPlaceholders(markdown: string): string {
  return markdown.replace(/\[\[(?!roblox_link)([a-z0-9_]+)\|([^\]]+)\]\]/gi, (_match, _key, label) =>
    normalizeWhitespace(label)
  );
}

function normalizeMetaDescription(value: string, gameName: string): string {
  const cleaned = normalizeWhitespace(value).replace(/^["']+|["']+$/g, "");
  const withName = cleaned || `${gameName} codes: how to redeem and what rewards you can expect.`;
  if (withName.length > 160) {
    return truncate(withName, 157);
  }
  return withName;
}

function resolveSectionTitle(type: SectionType, gameName: string, variant = 0): string {
  const variants = SECTION_TITLE_VARIANTS[type] ?? [() => "## Additional Details"];
  const resolver = variants[variant % variants.length] ?? variants[0];
  const raw = resolver(gameName).trim();
  return raw.startsWith("##") ? raw : `## ${raw.replace(/^#+\s*/, "")}`;
}

function ensureAllowedHeading(section: string, type: SectionType, gameName: string): string {
  const allowed =
    SECTION_TITLE_VARIANTS[type]?.map((resolver, index) => resolveSectionTitle(type, gameName, index)) ?? [];
  const trimmed = section.trim();
  if (!allowed.length) return trimmed;

  const lowerStart = trimmed.toLowerCase();
  if (allowed.some((heading) => lowerStart.startsWith(heading.toLowerCase()))) {
    return trimmed;
  }

  const lines = trimmed.split(/\r?\n/);
  if (lines[0]?.startsWith("##")) {
    lines[0] = allowed[0];
    return lines.join("\n");
  }

  return `${allowed[0]}\n\n${trimmed}`;
}

function isRewritePayload(value: unknown): value is RewritePayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  const requiredKeys: (keyof RewritePayload)[] = [
    "intro_md",
    "rewards_md",
    "troubleshoot_md",
    "meta_description"
  ];
  return requiredKeys.every((key) => typeof candidate[key] === "string" && (candidate[key] as string).trim().length > 0);
}

async function pickAuthorId(): Promise<string | null> {
  const { data, error } = await supabase.from("authors").select("id").order("name", { ascending: true });
  if (error) {
    console.warn("⚠️ Unable to load authors:", error.message);
    return null;
  }
  const ids = (data ?? [])
    .map((row) => row.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  if (!ids.length) return null;
  const index = Math.floor(Math.random() * ids.length);
  return ids[index] ?? null;
}

function buildPrompt(game: GameRow, existingArticle: string, sources: string): string {
  const gameName = game.name;
  const createdAt = game.created_at ? new Date(game.created_at).toISOString() : "unknown date";
  const troubleshootHeading = resolveSectionTitle("codeNotWorking", gameName, 0);
  const rewardsHeading = resolveSectionTitle("rewardsOverview", gameName, 0);
  return `
You are a Roblox player and a good friendly writer who is writing an article on ${gameName} Codes. Write the article in simple english,m easy to understand style and most importantly information rich. Use only the details from the provided script and write only the section asked. Make the article engaging and story like that hook the audience right from the start and keep the engagement flowing throughout. 

Rules:
- Keep the structure to just intro_md, rewards_md, troubleshoot_md, and meta_description.
- no generic words like This is a existing game or you will love this game is needed. Focus on the game and make sure every sentence adds more value to use who already plays the game.
- If something is missing from sources, leave it out instead of guessing.
- Meta description must be 150-160 characters, no generic claims, write unconvetional and very human and unique meta descriptions for each game.
- All the sections should have full sentences, info rich sentences that are engaging.
- Start troubleshoot_md with "${troubleshootHeading}".
- Start rewards_md with "${rewardsHeading}".
- Should leave out anything that is generic in nature and common for all codes, focus on the unique game specific aspect and keep everything cleanly readbale, informational. 
- Write full sentences and easy to read and understand style, but write in as less words as possible.
- Do not hype up things, keep it informational, friendly and engaging.
- Do not include any generic or templated writing.
- Keep things engaging and flow the information in a way that is easy to consume for the users.
- Write with a story like flow, hook the audience right from the start and keep the engagement flowing throughout.

Existing article (for context):
${existingArticle}

Source excerpts:
${sources}

Return valid JSON with these keys:
{
  "intro_md": "Just a small intro that explains the reader what is the game, what rewards they get from codes and what benefit we get from these. No generic or filler sentences like "This is a good roblox game", "You will love this game, if", "definitely a game you want to check out". Keep it detailed and make it very easy for the reader the understand the game and the rewards.  Write like a Roblox ${gameName} player that is writing for another player who plays the game. Keep everything grounded and simple, do not hype up things, keep it informational, friendly and engaging. Write the info in full sentences, but in as less words as possible.  Include the keyword ${gameName} codes in the intro natually. Do not force the keyword, just make it arrive natually. Only use the keyword one time, never ever use the keyword two times",
  "rewards_md": "Start with ${JSON.stringify(rewardsHeading)} then Create a table of typical rewards (from the sources). Include all the reward types we get for this game with clear details,and a small description of each reward. Keep it very informational, full sentences, clean to understand, but write in as less words as possible. Before the table, write a line or two to give cue to the users. Do not include any generic or templated writing. Always write things that are unique to the game and leave out everything that is generic in nature like rewards help you progress faster. Leave out the ovbious and focus on the depth and information.",
  "troubleshoot_md": "Start with ${JSON.stringify(troubleshootHeading)} and write why codes might fail and how to fix it. Anything that is generic in nature should be just covered in para style and in one word. But if there are any game specific issues like reaching a specific level or something like that, only then it needs to include them in the bullet list. Even if the list only has 1, include only the unique ones and do not repeat anything. Always keep things direct and try to tell in as less words as possible. (No generic reasons should get into bullet points"
  "meta_description": "150-160 character, plain sentence mentioning ${gameName} codes and the value players get. No generic claims, write unconvetional and very human and unique meta descriptions for each game.",
}
`;
}

async function rewriteGame(game: GameRow, dryRun: boolean): Promise<void> {
  const existingArticle = buildExistingArticleContext(game);
  const sources = await loadSourceExcerpts(game);
  const hasSources = !sources.startsWith("No Beebom") && !sources.startsWith("No readable");
  console.log(`🧠 Rewriting ${game.name} using ${hasSources ? "linked sources" : "article context only"}...`);

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.3,
    max_tokens: 4800,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: buildPrompt(game, existingArticle, sources) }]
  });

  const raw = completion.choices[0].message?.content ?? "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.error("⚠️ Could not parse JSON from model output:", raw);
    throw error instanceof Error ? error : new Error("Model returned invalid JSON.");
  }

  if (!isRewritePayload(parsed)) {
    console.error("⚠️ Missing required fields in model output:", raw);
    throw new Error("Rewrite payload invalid.");
  }

  const displayName = normalizeWhitespace(game.name) || game.name;
  const intro = parsed.intro_md.trim();
  const rewards = ensureAllowedHeading(
    stripUnsupportedPlaceholders(parsed.rewards_md.trim()),
    "rewardsOverview",
    displayName
  );
  const troubleshoot = ensureAllowedHeading(
    stripUnsupportedPlaceholders(parsed.troubleshoot_md.trim()),
    "codeNotWorking",
    displayName
  );
  const metaDescription = normalizeMetaDescription(parsed.meta_description, displayName);

  const updatePayload: Record<string, unknown> = {
    intro_md: intro,
    rewards_md: rewards,
    troubleshoot_md: troubleshoot,
    seo_description: metaDescription,
    re_rewritten_at: new Date().toISOString()
  };

  if (!game.author_id) {
    const authorId = await pickAuthorId();
    if (authorId) {
      updatePayload.author_id = authorId;
    }
  }

  if (dryRun) {
    console.log(`📝 Dry run only for ${game.slug}. Payload:`, JSON.stringify(updatePayload, null, 2));
    return;
  }

  const { error } = await supabase
    .from("games")
    .update(updatePayload)
    .eq("id", game.id);

  if (error) {
    throw new Error(`Failed to update ${game.slug}: ${error.message}`);
  }

  console.log(`✅ Rewrote ${game.slug} (${displayName})`);
}

async function fetchGames({ slugs }: CliOptions): Promise<GameRow[]> {
  let query = supabase
    .from("games")
    .select(
      "id, name, slug, author_id, created_at, intro_md, redeem_md, troubleshoot_md, rewards_md, seo_description, description_md, roblox_link, source_url, source_url_2, source_url_3, re_rewritten_at, is_published"
    )
    .order("created_at", { ascending: true });

  if (slugs.length) {
    query = query.in("slug", slugs);
  } else {
    query = query
      .eq("is_published", true)
      .is("re_rewritten_at", null);
  }

  const { data, error } = await query.limit(1);
  if (error) throw new Error(`Failed to load games: ${error.message}`);

  return (data as GameRow[]) ?? [];
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  const games = await fetchGames(options);
  if (!games.length) {
    console.log("No games to rewrite.");
    return;
  }

  for (const game of games) {
    try {
      await rewriteGame(game, options.dryRun);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to rewrite ${game.slug}: ${message}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
