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

  const message = lines.join('\n');
  await sendTelegramMessage(token, chatId, message);
}

main().catch((error) => {
  console.error('Failed to send automation summary:', error);
  process.exit(1);
});
