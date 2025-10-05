import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import fs from 'fs/promises';
import path from 'path';

// --- ENV VARIABLES ---
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE!;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID!;

// --- INIT SUPABASE ---
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// --- TITLE TEMPLATES ---
const TITLE_TEMPLATES = [
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

// --- HELPERS ---
function getRandomTemplate(gameName: string): string {
  const random = TITLE_TEMPLATES[Math.floor(Math.random() * TITLE_TEMPLATES.length)];
  const today = new Date().toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return random
    .replaceAll('[game name]', gameName)
    .replaceAll('[date]', today);
}

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${url}`);
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) {
    throw new Error(`URL is not an image: ${url} (${contentType})`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function createTintedImage(
  backgroundUrl: string,
  codes: string[],
  title: string
): Promise<Buffer> {
  const bg = await fetchImageBuffer(backgroundUrl);

  // Convert and crop to 9:18 portrait ratio
  const bgConverted = await sharp(bg)
    .resize({
      width: 1080,
      height: 2160,
      fit: 'cover',
      position: 'centre',
    })
    .toFormat('jpeg')
    .toBuffer();

  // --- Dynamic Title Wrapping ---
  const maxCharsPerLine = 26; // tighter for margin space
  const words = title.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length > maxCharsPerLine) {
      lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine += ' ' + word;
    }
  }
  if (currentLine) lines.push(currentLine.trim());

  // Adjust font size based on number of lines
  const fontSize = lines.length === 1 ? 80 : lines.length === 2 ? 70 : 60;
  const startY = 360 - (lines.length - 1) * (fontSize + 8) * 0.5;

  // --- Code Handling ---
  const maxCodes = 7;
  const visibleCodes = codes.slice(0, maxCodes);
  const remainingCount = codes.length - visibleCodes.length;

  const codeTexts = visibleCodes
    .map(
      (c, i) => `
        <text x="50%" y="${850 + i * 120}"
          text-anchor="middle"
          fill="white"
          font-size="80"
          font-family="Arial Black, Arial, sans-serif"
          font-weight="700">${c}</text>`
    )
    .join('');

  const extraText =
    remainingCount > 0
      ? `<text x="50%" y="${850 + visibleCodes.length * 120}"
          text-anchor="middle"
          fill="white"
          font-size="70"
          font-family="Arial Black, Arial, sans-serif"
          font-weight="700" opacity="0.8">+${remainingCount} more</text>`
      : '';

  // --- Build SVG Overlay ---
  const overlaySvg = `
    <svg width="1080" height="2160" xmlns="http://www.w3.org/2000/svg">
      <!-- Dark overlay -->
      <rect width="100%" height="100%" fill="black" fill-opacity="0.8" />

      <!-- Title (auto-wrapped with margins) -->
      ${lines
        .map(
          (line, i) => `
            <text x="540" y="${startY + i * (fontSize + 15)}"
              text-anchor="middle"
              fill="white"
              font-size="${fontSize}"
              font-family="Arial Black, Arial, sans-serif"
              font-weight="900"
              xml:space="preserve">${line}</text>`
        )
        .join('')}

      <!-- Divider -->
      <line x1="120" x2="960" y1="${
        startY + lines.length * (fontSize + 15) + 25
      }" y2="${startY + lines.length * (fontSize + 15) + 25}"
        stroke="white" stroke-width="3" opacity="0.5" />

      <!-- Codes -->
      ${codeTexts}
      ${extraText}
    </svg>
  `;

  // --- Combine with background ---
  return await sharp(bgConverted)
    .composite([{ input: Buffer.from(overlaySvg), gravity: 'center' }])
    .jpeg({ quality: 90 })
    .toBuffer();
}

// --- Create 3-second portrait video from image ---
async function createVideoFromImage(imageBuffer: Buffer): Promise<string> {
  const tempDir = './temp';
  await fs.mkdir(tempDir, { recursive: true });

  const imagePath = path.join(tempDir, 'frame.jpg');
  const videoPath = path.join(tempDir, 'output.mp4');

  // --- Pick a random audio track ---
  const assetsDir = './assets';
  const allFiles = await fs.readdir(assetsDir);
  const musicFiles = allFiles.filter((f) =>
    /\.(mp3|wav|ogg|m4a)$/i.test(f)
  );

  if (musicFiles.length === 0) {
    throw new Error('No music files found in ./assets folder');
  }

  const randomTrack =
    musicFiles[Math.floor(Math.random() * musicFiles.length)];
  const musicPath = path.join(assetsDir, randomTrack);

  console.log(`🎵 Using background track: ${randomTrack}`);

  await fs.writeFile(imagePath, imageBuffer);

  return new Promise((resolve, reject) => {
    ffmpeg()
      .setFfmpegPath(ffmpegPath!)
      .addInput(imagePath)
      .loop(3) // 3 seconds total
      .addInput(musicPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions([
        '-t 3',
        '-pix_fmt yuv420p',
        '-vf scale=1080:2160:force_original_aspect_ratio=decrease',
      ])
      .on('end', () => resolve(videoPath))
      .on('error', reject)
      .save(videoPath);
  });
}

async function postVideoToTelegram(videoPath: string, caption: string) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVideo`;
  const formData = new FormData();
  const videoBuffer = await fs.readFile(videoPath);

  formData.append('chat_id', TELEGRAM_CHANNEL_ID);
  formData.append('caption', caption);
  formData.append('video', new Blob([videoBuffer]), 'codes.mp4');

  const res = await fetch(url, { method: 'POST', body: formData });
  const json: any = await res.json();
  if (!res.ok || !json.ok)
    throw new Error(`Telegram video upload failed: ${JSON.stringify(json)}`);
}

// --- MAIN WORKFLOW ---
(async () => {
  console.log('🔍 Checking for unposted active codes...');
  const { data: codes, error } = await supabase
    .from('codes')
    .select('id, code, game_id, last_seen_at')
    .eq('status', 'active')
    .eq('posted_online', false)
    .order('last_seen_at', { ascending: true });

  if (error) throw error;
  if (!codes || codes.length === 0) {
    console.log('✅ No new unposted codes found.');
    return;
  }

  const grouped = codes.reduce((acc: Record<string, any[]>, c) => {
    acc[c.game_id] = acc[c.game_id] || [];
    acc[c.game_id].push(c);
    return acc;
  }, {});

  for (const [gameId, gameCodes] of Object.entries(grouped)) {
    const { data: game, error: gErr } = await supabase
      .from('games')
      .select('name, cover_image')
      .eq('id', gameId)
      .single();
    if (gErr || !game) continue;

    const title = getRandomTemplate(game.name);
    const codeList = gameCodes.map((c) => c.code);

    const image = await createTintedImage(game.cover_image, codeList, title);
    const caption = `${title}\n\n🔥 Active Codes:\n${codeList.map((c) => `- ${c}`).join('\n')}`;

    const videoPath = await createVideoFromImage(image);
    await postVideoToTelegram(videoPath, caption);
    console.log(`📤 Posted video for ${game.name} (${codeList.length} codes)`);

    await supabase
      .from('codes')
      .update({ posted_online: true })
      .in('id', gameCodes.map((c) => c.id));
    console.log(`✅ Marked ${codeList.length} codes as posted.`);

    await fs.rm(videoPath, { force: true });
  }

  console.log('🏁 Done.');
})();
