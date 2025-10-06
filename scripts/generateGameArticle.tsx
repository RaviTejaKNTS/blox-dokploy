/**
 * generateGameArticle.tsx
 * Works in CommonJS projects — no ESM change required.
 */

import 'dotenv/config';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

(async () => {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
  });

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE!
  );

  // --- Prompt Builders ---
  const buildMainPrompt = (gameName: string) => `
You are a professional Roblox content writer. Search online (using your latest knowledge)
for accurate, up-to-date information on the Roblox game "${gameName}" and its in-game codes.

When writing, make sure to:
- Write in a relaxed, conversational tone with full sentences.
- Avoid fluff or repetition.
- Include one or two lines before bullet points or tables so sections feel natural.
- Markdown only — no HTML.

### Structure
Write and return a JSON object with:
{
  "intro_md": "2–3 paragraphs hooking readers and explaining why codes are useful for ${gameName}. Make it relatable to players and focused on how codes help progression.",
  "redeem_md": "## How to Redeem ${gameName} Codes\\n\\nInclude friendly, clear numbered steps. When you mention 'Launch ${gameName}', link it to the official Roblox game URL (from roblox.com). Example: [${gameName}](https://www.roblox.com/games/...).",
  "description_md": "Include these sections:\\n\\n\
## Why Is My ${gameName} Code Not Working?\\n\
Short intro, then bullet list of reasons.\\n\\n\
## Where to Find More ${gameName} Codes\\n\
Paragraph style only — mention official Roblox page, developer’s Discord, Twitter/X, or Trello.\
Also include this line naturally:\
'To make things easier, bookmark our website so you never miss a new code drop. Just press Ctrl + D (or CMD + D on Mac) to save this page for quick access.'\
When mentioning sources, include them as markdown links to the official channels.\
\\n\\n\
## What Rewards You Normally Get?\\n\
[leave placeholder text: '[TO BE ENRICHED]']\\n\\n\
## How to Play ${gameName} and How These Codes Will Help You\\n\
[leave placeholder text: '[TO BE ENRICHED]']"
}

Ensure:
- Do not include the game name or slug fields in the JSON.
- Remove any empty or duplicate sections (for example, if 'What Rewards...' or 'How to Play...' are already replaced later, they shouldn’t appear twice).
`;

  const buildExtraPrompt = (gameName: string) => `
Search online for more detailed, game-specific info about:
1. What rewards players usually get from codes in "${gameName}" (accurate and current).
2. How to play "${gameName}" and how these codes help players progress.

Write 2 markdown sections and return JSON like this:
{
  "rewards_section": "## What Rewards You Normally Get?\\n[short intro + bullet list or markdown table as needed]",
  "play_section": "## How to Play ${gameName} and How These Codes Will Help You\\n[200–300 words, conversational explanation]"
}

Rules:
- No repetition of empty sections.
- Keep tone casual and friendly.
- Write as if talking directly to the player.
`;

  const gameName = process.argv[2];
  if (!gameName) {
    console.error('❌ Please provide a game name.\nExample: npm run generate "Tennis Zero"');
    process.exit(1);
  }

  try {
    console.log(`🧠 Generating main article for: ${gameName}...`);

    // --- Step 1: Main Article ---
    const mainResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: buildMainPrompt(gameName) }],
      temperature: 0.7,
      max_tokens: 1800,
      response_format: { type: 'json_object' },
    });

    const mainData = JSON.parse(mainResponse.choices[0].message?.content || '{}');
    if (!mainData.intro_md || !mainData.redeem_md || !mainData.description_md)
      throw new Error('Main article generation failed.');

    // --- Step 2: Extra Sections ---
    console.log(`🔍 Searching for rewards and gameplay details...`);

    const extraResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: buildExtraPrompt(gameName) }],
      temperature: 0.7,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    });

    const extraData = JSON.parse(extraResponse.choices[0].message?.content || '{}');

    // --- Step 3: Merge + Cleanup ---
    let mergedDescription = mainData.description_md
      .replace('[TO BE ENRICHED]', '')
      .trim();

    // remove any empty or duplicate headings
    mergedDescription = mergedDescription
      .replace(/## What Rewards You Normally Get\?\s*/gi, '')
      .replace(/## How to Play .*?Codes Will Help You\s*/gi, '')
      .trim();

    mergedDescription += `\n\n${extraData.rewards_section || ''}\n\n${extraData.play_section || ''}`.trim();

    // --- Step 4: Insert into Supabase ---
console.log(`📦 Inserting into Supabase...`);

    // generate name and slug automatically
    const autoName = gameName.trim();
    const autoSlug = gameName.toLowerCase().replace(/\s+/g, '-');

    const { error } = await supabase.from('games').insert({ 
        name: autoName,
        slug: autoSlug,
        intro_md: mainData.intro_md,
        redeem_md: mainData.redeem_md,
        description_md: mergedDescription,
        is_published: false,
    });

    if (error) throw error;
    console.log(`✅ Successfully inserted draft article for "${autoName}" (${autoSlug})`);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
})();
