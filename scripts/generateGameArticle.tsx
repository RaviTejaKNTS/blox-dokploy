 /**
 * generateGameArticle.tsx
 * Uses Google Search + GPT-5 to write accurate Roblox codes articles.
 * Reads 2–3 full pages for deeper context and uses your detailed structure.
 */

import 'dotenv/config';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

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
  value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

function parseSearchItem(entry: string) {
  const title = entry.match(/^Title: (.*)$/m)?.[1];
  const url = entry.match(/^URL: (.*)$/m)?.[1];
  if (!title || !url) return null;
  return { title, url };
}

async function findGameCodeArticle(gameName: string, siteSpecifier: string) {
  const query = `"${gameName}" codes site:${siteSpecifier}`;
  const results = await googleSearch(query, 5);
  const normalizedGame = normalizeForMatch(gameName);

  for (const entry of results) {
    const parsed = parseSearchItem(entry);
    if (!parsed) continue;
    const normalizedTitle = normalizeForMatch(parsed.title);
    if (!normalizedTitle.includes(normalizedGame)) continue;
    if (!/\bcodes?\b/i.test(parsed.title)) continue;
    return parsed.url;
  }

  return null;
}

// ---------------- Google Search Helper ----------------
async function googleSearch(query: string, limit = 5) {
  const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(
    query
  )}&num=${limit}&key=${GOOGLE_SEARCH_KEY}&cx=${GOOGLE_SEARCH_CX}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Search failed: ${res.statusText}`);
  const data = await res.json();
  const items =
    data.items?.map(
      (i: any) => `Title: ${i.title}\nURL: ${i.link}\nSnippet: ${i.snippet}`
    ) || [];
  return items;
}

// ---------------- Full-Page Reader ----------------
async function fetchArticleText(url: string): Promise<string> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
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
    return '';
  }
}

// ---------------- Main Prompt Builder ----------------
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
   - Link the line “Launch ${gameName}” to its actual Roblox page (from the sources if available).
   - If the game does not have codes system yet, no need for step-by-step instructions, just convey the information in clear detail. 
3. description_md – include all these sections:
   - ## Why Is My ${gameName} Code Not Working?
     Bullet list of real reasons from sources. Be very detailed and include all the reasons for why any code could fail. Before the bullet points, write at least a line or two to give cue to the actual points.
     Also, after the points have mentioned, write a line or two to talk to the user to give more context about this if you have or skip.
   - ## Where to Find More ${gameName} Codes
     1–2 paragraphs. Use the sources to locate the official Roblox page plus any verified social channels (Discord, Twitter/X, Trello, Roblox Group, etc.).
     Mention each channel by exact name (Discord server title, channel names, Twitter @handle, Roblox group title, etc.) and explain what players can find there.
     Include direct Markdown links to those pages using the exact URLs from the sources. 
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

// ---------------- Main ----------------
(async () => {
  const gameName = process.argv[2];
  if (!gameName) {
    console.error('❌ Please provide a game name.\nExample: npm run generate "Anime Defenders"');
    process.exit(1);
  }

  try {
    console.log(`🔍 Collecting Google data for "${gameName}"...`);

    // Main query – open top 3 pages fully
    const mainQuery = `"${gameName}" Roblox codes (site:beebom.com OR site:destructoid.com OR site:progameguides.com OR site:roblox.com OR site:pcgamesn.com OR site:pockettactics.com OR site:gamerant.com OR site:fandom.com OR site:tryhardguides.com OR site:techwiser.com)`;
    const mainResults = await googleSearch(mainQuery, 5);

    const topLinks = mainResults.slice(0, 3).map((r: any) => r.match(/URL:\s(.*)/)?.[1]).filter(Boolean);
    let fullText = '';
    for (const url of topLinks) {
      console.log(`📖 Reading full page: ${url}`);
      fullText += await fetchArticleText(url!);
      await sleep(1500);
    }

    // Supplementary searches
    const extraQueries = [
      `how to redeem "${gameName}" Roblox codes (site:beebom.com OR site:destructoid.com OR site:progameguides.com OR site:roblox.com OR site:pcgamesn.com OR site:pockettactics.com OR site:gamerant.com OR site:fandom.com OR site:tryhardguides.com OR site:techwiser.com)`,
      `"${gameName}" Roblox code rewards OR bonuses`,
      `how to play "${gameName}" Roblox guide OR wiki site:fandom.com OR site:roblox.com`,
    ];

    let snippetText = '';
    for (const q of extraQueries) {
      console.log(`🌐 Searching: ${q}`);
      snippetText += '\n\n' + (await googleSearch(q)).join('\n\n');
      await sleep(1000);
    }

    const combinedSources = `${fullText}\n\n${snippetText}`;

    const [robloxDenSource, beebomSource] = await Promise.all([
      findGameCodeArticle(gameName, 'robloxden.com/game-codes'),
      findGameCodeArticle(gameName, 'beebom.com'),
    ]);

    if (robloxDenSource) {
      console.log(`🔗 Roblox Den source found: ${robloxDenSource}`);
    } else {
      console.log('⚠️ No matching Roblox Den codes article found.');
    }

    if (beebomSource) {
      console.log(`🔗 Beebom source found: ${beebomSource}`);
    } else {
      console.log('⚠️ No matching Beebom codes article found.');
    }

    console.log(`🧠 Writing detailed article using GPT-4.1-mini...`);
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.3,
      max_tokens: 5000,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: buildArticlePrompt(gameName, combinedSources) }],
    });

    let raw = completion.choices[0].message?.content || '';
    let article: any = {};
    try {
      article = JSON.parse(raw);
    } catch {
      console.error('⚠️ Could not parse JSON. Raw output:\n', raw);
      throw new Error('Model returned invalid JSON.');
    }

    if (!article.intro_md || !article.redeem_md || !article.description_md) {
      console.error('⚠️ Missing sections. Raw output:\n', raw);
      throw new Error('Article generation incomplete.');
    }

    const name = gameName.trim();
    let slug = gameName.toLowerCase().replace(/\s+/g, '-') + '-codes';

    // check if slug already exists
    const { data: existing } = await supabase
      .from('games')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (existing) {
      slug = `roblox-${slug}`;
      console.log(`⚠️ Duplicate slug detected, using "${slug}" instead.`);
    }

    console.log(`📦 Inserting article for "${name}"...`);
    const insertPayload: Record<string, any> = {
      name,
      slug,
      intro_md: article.intro_md,
      redeem_md: article.redeem_md,
      description_md: article.description_md,
      is_published: false,
    };

    if (robloxDenSource) insertPayload.source_url = robloxDenSource;
    if (beebomSource) insertPayload.source_url_2 = beebomSource;

    const { error } = await supabase.from('games').insert(insertPayload);

    if (error) throw error;
    console.log(`✅ "${name}" inserted successfully as draft (${slug})`);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
})();
