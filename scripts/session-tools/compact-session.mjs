#!/usr/bin/env node
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`Usage:\n  node scripts/session-tools/compact-session.mjs <session-key> [--max-lines N] [--timeout-ms N] [--fallback-max-lines N]\n\nExamples:\n  node scripts/session-tools/compact-session.mjs agent:main:main\n  node scripts/session-tools/compact-session.mjs agent:main:runtime-openclaw-e2e --max-lines 200\n  node scripts/session-tools/compact-session.mjs agent:main:main --timeout-ms 600000\n  node scripts/session-tools/compact-session.mjs agent:main:main --timeout-ms 600000 --fallback-max-lines 400\n\nEnv:\n  OPENCLAW_RUNTIME_OPENCLAW_BIN   Override OpenClaw binary path\n  OPENCLAW_GATEWAY_URL            Optional gateway URL\n  OPENCLAW_GATEWAY_TOKEN          Optional gateway token\n  OPENCLAW_COMPACT_TIMEOUT_MS     Override gateway timeout (default 300000)`);
  process.exit(0);
}

function getFlagNumber(flagName) {
  const index = args.findIndex((arg) => arg === flagName);
  if (index < 0) return undefined;
  const value = Number(args[index + 1]);
  if (!Number.isFinite(value) || value < 1) {
    console.error(`Invalid ${flagName} value.`);
    process.exit(1);
  }
  return Math.floor(value);
}

function normalizeListPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.checkpoints)) return payload.checkpoints;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function spawnCapture(command, cliArgs) {
  return new Promise((resolve) => {
    const child = spawn(command, cliArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', (error) => {
      resolve({ code: 1, signal: null, stdout, stderr: `${stderr}${error.message}\n` });
    });
    child.on('exit', (code, signal) => {
      resolve({ code: code ?? 1, signal, stdout, stderr });
    });
  });
}

async function callGateway(method, params, timeoutMs) {
  const cliArgs = ['gateway', 'call', method, '--json', '--timeout', String(timeoutMs), '--params', JSON.stringify(params)];
  if (process.env.OPENCLAW_GATEWAY_URL) cliArgs.push('--url', process.env.OPENCLAW_GATEWAY_URL);
  if (process.env.OPENCLAW_GATEWAY_TOKEN) cliArgs.push('--token', process.env.OPENCLAW_GATEWAY_TOKEN);
  return spawnCapture(openclawBin, cliArgs);
}

async function getLatestCheckpointId() {
  const result = await callGateway('sessions.compaction.list', { key: sessionKey }, Math.min(timeoutMs, 30000));
  if (result.code !== 0) return undefined;
  try {
    const payload = JSON.parse(result.stdout);
    return normalizeListPayload(payload)[0]?.checkpointId;
  } catch {
    return undefined;
  }
}

const sessionKey = args.find((arg, index) => {
  if (arg.startsWith('--')) return false;
  if (index > 0 && args[index - 1]?.startsWith('--')) return false;
  return true;
});
if (!sessionKey) {
  console.error('Missing session key. Try --help.');
  process.exit(1);
}

const maxLines = getFlagNumber('--max-lines');
const fallbackMaxLines = getFlagNumber('--fallback-max-lines');
const timeoutMs = getFlagNumber('--timeout-ms') ?? Number(process.env.OPENCLAW_COMPACT_TIMEOUT_MS || 300000);
if (!Number.isFinite(timeoutMs) || timeoutMs < 1) {
  console.error('Invalid timeout value.');
  process.exit(1);
}

const openclawBin = process.env.OPENCLAW_RUNTIME_OPENCLAW_BIN ?? '/data/.npm-global/bin/openclaw';
const params = maxLines ? { key: sessionKey, maxLines } : { key: sessionKey };
const beforeCheckpointId = await getLatestCheckpointId();
const result = await callGateway('sessions.compact', params, timeoutMs);

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

if (result.signal) {
  console.error(`compact-session terminated by signal ${result.signal}`);
  process.exit(1);
}

if (result.code === 0) {
  process.exit(0);
}

const timedOut = `${result.stdout}\n${result.stderr}`.includes('gateway timeout after');
if (timedOut) {
  const afterCheckpointId = await getLatestCheckpointId();
  if (afterCheckpointId && afterCheckpointId !== beforeCheckpointId) {
    console.error(`Gateway timed out after ${timeoutMs}ms, but a new compaction checkpoint was created (${afterCheckpointId}). Treating as success.`);
    process.exit(0);
  }
  if (!maxLines && fallbackMaxLines) {
    console.error(`Gateway timed out after ${timeoutMs}ms without a new checkpoint. Retrying with transcript fallback (--max-lines ${fallbackMaxLines}).`);
    const fallbackResult = await callGateway('sessions.compact', { key: sessionKey, maxLines: fallbackMaxLines }, Math.min(timeoutMs, 60000));
    if (fallbackResult.stdout) process.stdout.write(fallbackResult.stdout);
    if (fallbackResult.stderr) process.stderr.write(fallbackResult.stderr);
    if (fallbackResult.signal) {
      console.error(`compact-session fallback terminated by signal ${fallbackResult.signal}`);
      process.exit(1);
    }
    process.exit(fallbackResult.code ?? 1);
  }
  console.error(`Gateway timed out after ${timeoutMs}ms without creating a visible checkpoint. Try again with more timeout or use --fallback-max-lines N.`);
}

process.exit(result.code ?? 1);
