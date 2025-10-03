import 'dotenv/config';
import { promises as fs } from 'node:fs';
import { format } from 'date-fns';
import crypto from 'node:crypto';
import { supabaseAdmin } from "@/lib/supabase";
import { SITE_URL } from "@/lib/seo";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID || process.env.TELEGRAM_CHAT_ID;
const TWITTER_API_KEY = process.env.TWITTER_API_KEY;
const TWITTER_API_SECRET = process.env.TWITTER_API_SECRET;
const TWITTER_ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN;
const TWITTER_ACCESS_SECRET = process.env.TWITTER_ACCESS_SECRET;
const FACEBOOK_PAGE_ID = process.env.FACEBOOK_PAGE_ID;
const FACEBOOK_PAGE_ACCESS_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
const BLUESKY_IDENTIFIER = process.env.BLUESKY_IDENTIFIER;
const BLUESKY_PASSWORD = process.env.BLUESKY_PASSWORD;
const THREADS_USER_ID = process.env.THREADS_USER_ID;
const THREADS_ACCESS_TOKEN = process.env.THREADS_ACCESS_TOKEN;

const SITE_BASE = SITE_URL.replace(/\/$/, '');

type GameRelation = { name: string; slug: string } | null;

type PendingCodeRow = {
  id: string;
  game_id: string;
  code: string;
  first_seen_at: string;
  game: GameRelation;
};

async function fetchNextPendingGame() {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('codes')
    .select('id, game_id, code, first_seen_at, games(name, slug)')
    .eq('posted_online', false)
    .eq('status', 'active')
    .order('first_seen_at', { ascending: true })
    .limit(1);

  if (error) throw error;
  if (!data || data.length === 0) return null;

  const row = data[0] as {
    id: string;
    game_id: string;
    code: string;
    first_seen_at: string;
    games: { name: string; slug: string } | { name: string; slug: string }[] | null;
  };

  const gameRelation = Array.isArray(row.games) ? row.games[0] ?? null : row.games;

  return {
    id: row.id,
    game_id: row.game_id,
    code: row.code,
    first_seen_at: row.first_seen_at,
    game: gameRelation ? { name: gameRelation.name, slug: gameRelation.slug } : null,
  } satisfies PendingCodeRow;
}

async function fetchCodesForGame(gameId: string) {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('codes')
    .select('id, code')
    .eq('game_id', gameId)
    .eq('status', 'active')
    .eq('posted_online', false)
    .order('first_seen_at', { ascending: true });

  if (error) throw error;
  return (data as { id: string; code: string }[]) ?? [];
}

async function markCodesPosted(codeIds: string[]) {
  if (!codeIds.length) return;
  const sb = supabaseAdmin();
  const { error } = await sb
    .from('codes')
    .update({ posted_online: true })
    .in('id', codeIds);

  if (error) throw error;
}

type PlatformResult = "sent" | "skipped";

async function sendTelegramMessage(message: string): Promise<PlatformResult> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHANNEL_ID) {
    console.log('Skipping Telegram posting (missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHANNEL_ID).');
    return "skipped";
  }
  const endpoint = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHANNEL_ID,
      text: message,
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram API error (${response.status}): ${body}`);
  }

  return "sent";
}

const HEADLINE_TEMPLATES = [
  'Fresh [game name] codes just dropped – [date].',
  '✨ New [game name] codes are live now! (Updated [date])',
  '[game name] codes updated today – check them out!',
  '🎮 Latest [game name] codes are here ([date])',
  'Just in: fresh [game name] codes added today.',
  'Updated list of [game name] codes for [date].',
  '🎁 New rewards waiting in [game name] – grab the latest codes!',
  'Time to redeem! New [game name] codes are now available.',
  '🔥 Hot update: [game name] just got new codes ([date])',
  '[game name] codes refreshed – here’s what’s new today.',
  'Don’t miss out – new [game name] codes are up!',
  'Big update! [game name] codes have just landed.',
  '⚡ Redeem them fast – new [game name] codes are here.',
  'New day, new [game name] codes.',
  '🎉 Fresh [game name] codes dropped, get your freebies now!',
  '[game name] fans, check out today’s new codes!',
  'Another set of [game name] codes is here.',
  '⏳ Grab the newest [game name] codes before they expire.',
  'Latest [game name] codes for [date] – don’t wait!',
  '[game name] codes have been updated today.',
  'Hey players – new [game name] codes out today.',
  '👀 Heads up! Fresh [game name] codes are waiting.',
  'Just spotted – latest [game name] codes ([date])',
  'Good news – [game name] has new redeem codes today.',
  'Quick update: new [game name] codes available.',
  'Redeem alert: [game name] codes refreshed.',
  'Today’s [game name] codes are finally here.',
  '🎁 New freebie codes for [game name] – check them out!',
  'Fresh rewards unlocked – [game name] codes updated.',
  '[game name] codes added today – don’t miss them.',
  'Hurry! 🚨 New [game name] codes just released.',
  'Redeem now – latest [game name] codes are live.',
  'Limited time? New [game name] codes are here today.',
  '[game name] codes updated – act fast!',
  '⚡ Grab the [date] codes before they vanish.',
  'New codes just dropped for [game name], don’t sleep on them.',
  'Hot off the press – [game name] codes are fresh today.',
  '💎 Redeem your freebies! [game name] codes updated.',
  'Don’t miss today’s [game name] code update.',
  'Latest codes for [game name] are finally here – redeem quickly!',
];

function resolveHeadline(template: string, gameName: string, dateLabel: string) {
  return template
    .replace(/\[game name\]/gi, gameName)
    .replace(/\[date\]/gi, dateLabel);
}

function selectHeadline(gameName: string, dateLabel: string) {
  if (HEADLINE_TEMPLATES.length === 0) {
    return `New ${gameName} codes dropped. ${dateLabel}`;
  }

  const index = Math.floor(Math.random() * HEADLINE_TEMPLATES.length);
  return resolveHeadline(HEADLINE_TEMPLATES[index], gameName, dateLabel);
}

function buildBaseMessage(game: { name: string; slug: string }, codes: { code: string }[]) {
  const today = format(new Date(), 'MMMM d, yyyy');
  const headline = selectHeadline(game.name, today);
  const link = `${SITE_BASE}/${game.slug}`;
  const lines = [headline, '', ...codes.map((c) => c.code), '', `Check out all active ${game.name} codes on ${link}`];
  return { headline, link, message: lines.join('\n') };
}

const TWITTER_HASHTAGS = ['#Roblox', '#RobloxCodes'];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function headlineWithGameTag(headline: string, gameName: string, tag: string) {
  if (!gameName || !tag) return headline;
  const pattern = new RegExp(escapeRegExp(gameName), 'gi');
  return headline.replace(pattern, tag);
}

function buildTwitterMessage(
  headline: string,
  link: string,
  codes: string[],
  hashtags: string[] = []
) {
  const limit = 280;
  const hashtagsLine = hashtags.filter(Boolean).join(' ');

  const composeMessage = (codesBlock: string, moreLine?: string) => {
    const codeSection = [codesBlock, moreLine].filter(Boolean).join(codesBlock && moreLine ? '\n' : '');
    const sections = [headline];
    if (codeSection) {
      sections.push('', codeSection);
    }
    sections.push('', link);
    if (hashtagsLine) {
      sections.push(hashtagsLine);
    }
    return sections.join('\n');
  };

  let included: string[] = [];
  for (const code of codes) {
    const candidate = [...included, code];
    const message = composeMessage(candidate.join('\n'));
    if (message.length <= limit) {
      included = candidate;
    } else {
      break;
    }
  }

  let remaining = codes.length - included.length;
  let finalMessage = composeMessage(included.join('\n'));

  if (remaining > 0) {
    let currentIncluded = included.slice();
    let messageWithMore = composeMessage(currentIncluded.join('\n'), `+${remaining} more`);

    while (messageWithMore.length > limit && currentIncluded.length > 0) {
      currentIncluded = currentIncluded.slice(0, -1);
      remaining = codes.length - currentIncluded.length;
      messageWithMore = composeMessage(currentIncluded.join('\n'), `+${remaining} more`);
    }

    if (messageWithMore.length <= limit) {
      finalMessage = messageWithMore;
    } else {
      finalMessage = composeMessage('');
    }
  }

  if (finalMessage.length > limit) {
    finalMessage = `${headline}\n\n${link}\n${hashtagsLine}`.trim();
  }

  return finalMessage;
}

function percentEncode(value: string) {
  return encodeURIComponent(value)
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/'/g, '%27');
}

async function postToTwitter(text: string): Promise<PlatformResult> {
  if (!TWITTER_API_KEY || !TWITTER_API_SECRET || !TWITTER_ACCESS_TOKEN || !TWITTER_ACCESS_SECRET) {
    console.log('Skipping Twitter posting (missing user-context credentials).');
    return "skipped";
  }

  const url = 'https://api.twitter.com/2/tweets';
  const method = 'POST';
  const payload = { text };

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: TWITTER_API_KEY,
    oauth_nonce: crypto.randomBytes(32).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: TWITTER_ACCESS_TOKEN,
    oauth_version: '1.0',
  };

  const signatureBaseString = [
    method,
    percentEncode(url),
    percentEncode(
      Object.keys(oauthParams)
        .sort()
        .map((key) => `${percentEncode(key)}=${percentEncode(oauthParams[key])}`)
        .join('&')
    ),
  ].join('&');

  const signingKey = `${percentEncode(TWITTER_API_SECRET)}&${percentEncode(TWITTER_ACCESS_SECRET)}`;
  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(signatureBaseString)
    .digest('base64');

  const authorizationHeader =
    'OAuth ' +
    Object.entries({ ...oauthParams, oauth_signature: signature })
      .map(([key, value]) => `${percentEncode(key)}="${percentEncode(value)}"`)
      .join(', ');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authorizationHeader,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Twitter API error (${response.status}): ${body}`);
  }

  return "sent";
}

async function postToFacebook(text: string): Promise<PlatformResult> {
  if (!FACEBOOK_PAGE_ID || !FACEBOOK_PAGE_ACCESS_TOKEN) {
    console.log('Skipping Facebook posting (missing FACEBOOK_PAGE_ID or FACEBOOK_PAGE_ACCESS_TOKEN).');
    return "skipped";
  }

  const params = new URLSearchParams({
    message: text,
    access_token: FACEBOOK_PAGE_ACCESS_TOKEN,
  });

  const response = await fetch(`https://graph.facebook.com/${FACEBOOK_PAGE_ID}/feed`, {
    method: 'POST',
    body: params,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Facebook API error (${response.status}): ${body}`);
  }

  return "sent";
}

async function postToBluesky(text: string): Promise<PlatformResult> {
  if (!BLUESKY_IDENTIFIER || !BLUESKY_PASSWORD) {
    console.log('Skipping Bluesky posting (missing BLUESKY_IDENTIFIER or BLUESKY_PASSWORD).');
    return "skipped";
  }

  const sessionResponse = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: BLUESKY_IDENTIFIER, password: BLUESKY_PASSWORD }),
  });

  if (!sessionResponse.ok) {
    const body = await sessionResponse.text();
    throw new Error(`Bluesky session error (${sessionResponse.status}): ${body}`);
  }

  const session = await sessionResponse.json();
  const recordResponse = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.accessJwt}`,
    },
    body: JSON.stringify({
      repo: session.did,
      collection: 'app.bsky.feed.post',
      record: {
        $type: 'app.bsky.feed.post',
        text,
        createdAt: new Date().toISOString(),
      },
    }),
  });

  if (!recordResponse.ok) {
    const body = await recordResponse.text();
    throw new Error(`Bluesky post error (${recordResponse.status}): ${body}`);
  }

  return "sent";
}

async function postToThreads(text: string): Promise<PlatformResult> {
  if (!THREADS_USER_ID || !THREADS_ACCESS_TOKEN) {
    console.log('Skipping Threads posting (missing THREADS_USER_ID or THREADS_ACCESS_TOKEN).');
    return "skipped";
  }

  const params = new URLSearchParams({
    text,
    access_token: THREADS_ACCESS_TOKEN,
  });

  const response = await fetch(`https://graph.threads.net/v1.0/${THREADS_USER_ID}/threads`, {
    method: 'POST',
    body: params,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Threads API error (${response.status}): ${body}`);
  }

  return "sent";
}

async function main() {
  const pending = await fetchNextPendingGame();
  if (!pending) {
    console.log('No codes pending Telegram posting.');
    return;
  }

  const game = pending.game;
  if (!game) {
    console.warn(`Skipping code ${pending.id} because the linked game record is missing.`);
    return;
  }

  const codes = await fetchCodesForGame(pending.game_id);
  if (codes.length === 0) {
    console.log(`No Telegram-ready codes found for game ${game.name}.`);
    return;
  }

  const { message, headline, link } = buildBaseMessage(game, codes);
  const sanitizedGameTag = game.name.replace(/[^a-zA-Z0-9]+/g, '');
  const primaryTag = sanitizedGameTag ? `#${sanitizedGameTag}` : '';
  const twitterHeadline = primaryTag ? headlineWithGameTag(headline, game.name, primaryTag) : headline;
  const twitterHashtags = [...TWITTER_HASHTAGS];
  const twitterMessage = buildTwitterMessage(twitterHeadline, link, codes.map((c) => c.code), twitterHashtags);
  const threadsMessage = message;

  const tasks: Array<{ name: string; run: () => Promise<PlatformResult> }> = [
    { name: 'Telegram', run: () => sendTelegramMessage(message) },
    { name: 'Twitter', run: () => postToTwitter(twitterMessage) },
    { name: 'Facebook', run: () => postToFacebook(message) },
    { name: 'Bluesky', run: () => postToBluesky(message) },
    { name: 'Threads', run: () => postToThreads(threadsMessage) },
  ];

  const failures: string[] = [];
  const platformResults: Array<{ name: string; status: 'success' | 'skipped' | 'failed'; error?: string }> = [];

  for (const task of tasks) {
    const before = Date.now();
    try {
      const result = await task.run();
      const status = result === 'skipped' ? 'skipped' : 'success';
      platformResults.push({ name: task.name, status });
      console.log(`${task.name} post completed in ${Date.now() - before}ms.${result === 'skipped' ? ' (skipped)' : ''}`);
    } catch (err: any) {
      const messageText = `${task.name} posting failed: ${err?.message ?? err}`;
      failures.push(messageText);
      console.error(messageText);
      platformResults.push({ name: task.name, status: 'failed', error: err?.message ?? String(err) });
    }
  }

  await markCodesPosted(codes.map((c) => c.id));
  console.log(`Published ${codes.length} ${codes.length === 1 ? 'code' : 'codes'} for ${game.name} across channels.`);

  const summaryPath = process.env.AUTOMATION_SUMMARY_PATH;
  if (summaryPath) {
    const summary = {
      type: 'post-online' as const,
      generatedAt: new Date().toISOString(),
      game: {
        id: game.id,
        name: game.name,
        slug: game.slug,
      },
      stats: {
        codesTotal: codes.length,
        headline,
      },
      messages: {
        telegram: message,
        twitter: twitterMessage,
        threads: threadsMessage,
      },
      platforms: platformResults,
      codes: codes.map((c) => c.code),
    };

    try {
      await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to write automation summary', error);
    }
  }

  if (failures.length) {
    throw new Error(failures.join('; '));
  }
}

main().catch((err) => {
  console.error('Telegram posting failed:', err);
  process.exit(1);
});
