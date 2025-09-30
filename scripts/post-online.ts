import 'dotenv/config';
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

async function sendTelegramMessage(message: string) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHANNEL_ID) {
    console.log('Skipping Telegram posting (missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHANNEL_ID).');
    return;
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
}

function buildBaseMessage(game: { name: string; slug: string }, codes: { code: string }[]) {
  const today = format(new Date(), 'MMMM d, yyyy');
  const headline = `New ${game.name} codes dropped. ${today}`;
  const link = `${SITE_BASE}/${game.slug}`;
  const lines = [headline, '', ...codes.map((c) => c.code), '', `Check out all active ${game.name} codes on ${link}`];
  return { headline, link, message: lines.join('\n') };
}

function truncateForTwitter(text: string) {
  const limit = 280;
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1)}…`;
}

function percentEncode(value: string) {
  return encodeURIComponent(value)
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/'/g, '%27');
}

async function postToTwitter(text: string) {
  if (!TWITTER_API_KEY || !TWITTER_API_SECRET || !TWITTER_ACCESS_TOKEN || !TWITTER_ACCESS_SECRET) {
    console.log('Skipping Twitter posting (missing user-context credentials).');
    return;
  }

  const url = 'https://api.twitter.com/2/tweets';
  const method = 'POST';
  const payload = { text: truncateForTwitter(text) };

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
}

async function postToFacebook(text: string) {
  if (!FACEBOOK_PAGE_ID || !FACEBOOK_PAGE_ACCESS_TOKEN) {
    console.log('Skipping Facebook posting (missing FACEBOOK_PAGE_ID or FACEBOOK_PAGE_ACCESS_TOKEN).');
    return;
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
}

async function postToBluesky(text: string) {
  if (!BLUESKY_IDENTIFIER || !BLUESKY_PASSWORD) {
    console.log('Skipping Bluesky posting (missing BLUESKY_IDENTIFIER or BLUESKY_PASSWORD).');
    return;
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
}

async function postToThreads(text: string) {
  if (!THREADS_USER_ID || !THREADS_ACCESS_TOKEN) {
    console.log('Skipping Threads posting (missing THREADS_USER_ID or THREADS_ACCESS_TOKEN).');
    return;
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
  const summary = `${headline}\n\n${codes.map((c) => c.code).join(', ')}\n${link}`;

  const tasks: Array<{ name: string; run: () => Promise<void> }> = [
    { name: 'Telegram', run: () => sendTelegramMessage(message) },
    { name: 'Twitter', run: () => postToTwitter(summary) },
    { name: 'Facebook', run: () => postToFacebook(message) },
    { name: 'Bluesky', run: () => postToBluesky(message) },
    { name: 'Threads', run: () => postToThreads(message) },
  ];

  for (const task of tasks) {
    const before = Date.now();
    try {
      await task.run();
      console.log(`${task.name} post completed in ${Date.now() - before}ms.`);
    } catch (err: any) {
      throw new Error(`${task.name} posting failed: ${err?.message ?? err}`);
    }
  }

  await markCodesPosted(codes.map((c) => c.id));
  console.log(`Published ${codes.length} ${codes.length === 1 ? 'code' : 'codes'} for ${game.name} across channels.`);
}

main().catch((err) => {
  console.error('Telegram posting failed:', err);
  process.exit(1);
});
