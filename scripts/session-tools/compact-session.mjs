#!/usr/bin/env node
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`Usage:\n  node scripts/session-tools/compact-session.mjs <session-key> [--max-lines N]\n\nExamples:\n  node scripts/session-tools/compact-session.mjs agent:main:main\n  node scripts/session-tools/compact-session.mjs agent:main:runtime-openclaw-e2e --max-lines 200\n\nEnv:\n  OPENCLAW_RUNTIME_OPENCLAW_BIN  Override OpenClaw binary path\n  OPENCLAW_GATEWAY_URL           Optional gateway URL\n  OPENCLAW_GATEWAY_TOKEN         Optional gateway token`);
  process.exit(0);
}

const sessionKey = args.find((arg) => !arg.startsWith('--'));
if (!sessionKey) {
  console.error('Missing session key. Try --help.');
  process.exit(1);
}

const maxLinesIndex = args.findIndex((arg) => arg === '--max-lines');
const maxLines = maxLinesIndex >= 0 ? Number(args[maxLinesIndex + 1]) : undefined;
if (maxLinesIndex >= 0 && (!Number.isFinite(maxLines) || maxLines < 1)) {
  console.error('Invalid --max-lines value.');
  process.exit(1);
}

const openclawBin = process.env.OPENCLAW_RUNTIME_OPENCLAW_BIN ?? '/data/.npm-global/bin/openclaw';
const params = maxLines ? { key: sessionKey, maxLines: Math.floor(maxLines) } : { key: sessionKey };
const cliArgs = ['gateway', 'call', 'sessions.compact', '--json', '--timeout', '120000', '--params', JSON.stringify(params)];

if (process.env.OPENCLAW_GATEWAY_URL) {
  cliArgs.push('--url', process.env.OPENCLAW_GATEWAY_URL);
}
if (process.env.OPENCLAW_GATEWAY_TOKEN) {
  cliArgs.push('--token', process.env.OPENCLAW_GATEWAY_TOKEN);
}

const child = spawn(openclawBin, cliArgs, { stdio: 'inherit' });
child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`compact-session terminated by signal ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
