import { promises as fs } from 'node:fs';

function loadEnv(name, optional = false) {
  const value = process.env[name];
  if (!value && !optional) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function formatDuration(totalSeconds) {
  const secondsNumber = Number(totalSeconds);
  if (!Number.isFinite(secondsNumber) || secondsNumber <= 0) {
    return '<1s';
  }

  const seconds = Math.floor(secondsNumber % 60);
  const minutes = Math.floor((secondsNumber / 60) % 60);
  const hours = Math.floor(secondsNumber / 3600);

  const parts = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(' ');
}

function formatPlatformStatus(platform) {
  if (!platform) return '';
  const icon = platform.status === 'success' ? '✅' : platform.status === 'skipped' ? '➖' : '❌';
  const detail = platform.error ? ` (${platform.error})` : platform.status === 'skipped' ? ' (skipped)' : '';
  return `${icon} ${platform.name}${detail}`;
}

function buildSummaryLines(summary) {
  if (!summary || typeof summary !== 'object') return [];

  const lines = [];

  switch (summary.type) {
    case 'refresh-codes': {
      const stats = summary.stats ?? {};
      lines.push('', 'Refresh Details:', `• Games processed: ${stats.processed ?? 0} (ok ${stats.success ?? 0}, skipped ${stats.skipped ?? 0}, failed ${stats.failed ?? 0})`);
      lines.push(`• Codes scraped: ${stats.totalCodesFound ?? 0} | New: ${stats.totalNewCodes ?? 0} | Removed: ${stats.totalCodesRemoved ?? 0}`);

      const changed = Array.isArray(summary.successes)
        ? summary.successes.filter((item) => (item.upserted ?? 0) || (item.removed ?? 0) || (item.newCodes ?? 0))
        : [];
      if (changed.length) {
        const sorted = changed.sort((a, b) => (b.newCodes ?? 0) - (a.newCodes ?? 0) || (b.upserted ?? 0) - (a.upserted ?? 0));
        const top = sorted.slice(0, 5);
        lines.push('• Games updated:');
        top.forEach((game) => {
          const newNote = game.newCodes ? ` +${game.newCodes} new` : '';
          const removedNote = game.removed ? `, -${game.removed} removed` : '';
          const totalNote = game.upserted ? `, ${game.upserted} total` : '';
          lines.push(`   - ${game.name} (${game.slug})${newNote}${removedNote}${totalNote}`);
        });
        if (sorted.length > top.length) {
          lines.push(`   - … ${sorted.length - top.length} more games`);
        }
      }

      if (Array.isArray(summary.failures) && summary.failures.length) {
        lines.push('• Failures:');
        summary.failures.slice(0, 5).forEach((failure) => {
          lines.push(`   - ${failure.slug ?? failure.name ?? 'Unknown'}: ${failure.error ?? 'Unknown error'}`);
        });
      }
      break;
    }
    case 'refresh-expired': {
      const stats = summary.stats ?? {};
      lines.push('', 'Expired Refresh:', `• Games processed: ${stats.processed ?? 0} (ok ${stats.success ?? 0}, skipped ${stats.skipped ?? 0}, failed ${stats.failed ?? 0})`);
      lines.push(`• Expired codes tracked: ${stats.totalExpired ?? 0}`);

      const successes = Array.isArray(summary.successes) ? summary.successes : [];
      if (successes.length) {
        const top = successes
          .filter((item) => item.expired)
          .sort((a, b) => (b.expired ?? 0) - (a.expired ?? 0))
          .slice(0, 5);
        if (top.length) {
          lines.push('• Top expired updates:');
          top.forEach((item) => {
            lines.push(`   - ${item.name} (${item.slug}): ${item.expired ?? 0} entries`);
          });
        }
      }
      break;
    }
    case 'post-online': {
      const game = summary.game ?? {};
      const stats = summary.stats ?? {};
      lines.push('', 'Post Details:', `• Game: ${game.name ?? 'Unknown'} (${game.slug ?? 'n/a'})`, `• Codes queued: ${stats.codesTotal ?? 0}`);

      if (Array.isArray(summary.platforms) && summary.platforms.length) {
        const platformLine = summary.platforms.map(formatPlatformStatus).filter(Boolean).join('  ');
        if (platformLine) {
          lines.push(`• Platforms: ${platformLine}`);
        }
      }

      if (Array.isArray(summary.codes) && summary.codes.length) {
        const preview = summary.codes.slice(0, 5).join(', ');
        const suffix = summary.codes.length > 5 ? `, … +${summary.codes.length - 5} more` : '';
        lines.push(`• Codes snapshot: ${preview}${suffix}`);
      }

      const messages = summary.messages ?? {};
      if (messages.telegram) {
        const trimmed = String(messages.telegram).split('\n').slice(0, 3).join('\n');
        lines.push('• Telegram body:');
        trimmed.split('\n').forEach((line) => lines.push(`   ${line}`));
      }
      break;
    }
    default:
      break;
  }

  return lines;
}

async function sendTelegramMessage(token, chatId, text) {
  const endpoint = `https://api.telegram.org/bot${token}/sendMessage`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram API error (${response.status}): ${body}`);
  }
}

async function main() {
  const token = loadEnv('TELEGRAM_BOT_TOKEN');
  const chatId = loadEnv('TELEGRAM_CHAT_ID');

  const workflowName = loadEnv('WORKFLOW_NAME', true) || 'Unknown Workflow';
  const jobStatus = loadEnv('JOB_STATUS', true) || 'unknown';
  const repo = loadEnv('GITHUB_REPOSITORY', true) || '';
  const runId = loadEnv('RUN_ID', true) || '';
  const runNumber = loadEnv('RUN_NUMBER', true) || '';
  const startTime = loadEnv('RUN_START_TIME', true) || '';
  const endTime = loadEnv('RUN_END_TIME', true) || '';
  const durationSeconds = loadEnv('RUN_DURATION_SECONDS', true) || '0';
  const summaryPath = loadEnv('AUTOMATION_SUMMARY_PATH', true) || '';

  let summary;
  if (summaryPath) {
    try {
      const raw = await fs.readFile(summaryPath, 'utf8');
      summary = JSON.parse(raw);
    } catch (error) {
      console.error('Failed to read automation summary file:', error);
    }
  }

  const duration = formatDuration(durationSeconds);
  const runUrl = runId && repo ? `https://github.com/${repo}/actions/runs/${runId}` : '';

  const lines = [
    `Automation: ${workflowName}`,
    `Status: ${jobStatus}`,
    runNumber ? `Run #: ${runNumber}` : undefined,
    startTime ? `Started: ${startTime}` : undefined,
    endTime ? `Finished: ${endTime}` : undefined,
    `Duration: ${duration}`,
    runUrl ? `Logs: ${runUrl}` : undefined
  ].filter(Boolean);

  lines.push(...buildSummaryLines(summary));

  const message = lines.join('\n');
  await sendTelegramMessage(token, chatId, message);
}

main().catch((error) => {
  console.error('Failed to send automation summary:', error);
  process.exit(1);
});
