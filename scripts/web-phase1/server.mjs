import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OpenClawBackendAdapter } from '../../dist/backend-openclaw/src/adapter/OpenClawBackendAdapter.js';
import { OpenClawGatewayCliClient } from '../../dist/backend-openclaw/src/client/OpenClawGatewayCliClient.js';
import { InMemoryEventBus } from '../../dist/conversation-core/src/events/EventBus.js';
import { WhisperCliSttProvider } from '../../dist/stt-runtime/src/providers/WhisperCliSttProvider.js';
import { MicrosoftTtsProvider } from '../../dist/tts-runtime/src/providers/MicrosoftTtsProvider.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const publicDir = join(__dirname, '../../public/voice-phase1');
const port = Number(process.env.OPENCLAW_WEB_PORT ?? 4173);
const host = process.env.OPENCLAW_WEB_HOST ?? '127.0.0.1';
const sessionKey = process.env.OPENCLAW_WEB_SESSION_KEY ?? 'agent:main:runtime-openclaw-web';
const agentId = process.env.OPENCLAW_WEB_AGENT_ID ?? 'main';
const openclawBin = process.env.OPENCLAW_RUNTIME_OPENCLAW_BIN ?? '/data/.npm-global/bin/openclaw';

const bus = new InMemoryEventBus();
const gatewayClient = new OpenClawGatewayCliClient({
  binaryPath: openclawBin,
  token: process.env.OPENCLAW_GATEWAY_TOKEN,
  url: process.env.OPENCLAW_GATEWAY_URL
});
const backend = new OpenClawBackendAdapter({
  bus,
  sessionKey,
  binaryPath: openclawBin,
  token: process.env.OPENCLAW_GATEWAY_TOKEN,
  url: process.env.OPENCLAW_GATEWAY_URL,
  timeoutMs: 60000,
  transcriptWaitMs: 60000
});
const stt = new WhisperCliSttProvider({
  bus,
  binaryPath: process.env.OPENCLAW_RUNTIME_WHISPER_BIN ?? '/data/linuxbrew/.linuxbrew/bin/whisper-cli',
  ffmpegPath: process.env.OPENCLAW_RUNTIME_FFMPEG_BIN ?? '/data/linuxbrew/.linuxbrew/bin/ffmpeg',
  modelPath: process.env.OPENCLAW_RUNTIME_WHISPER_MODEL ?? '/data/.openclaw/models/whisper/ggml-base.bin',
  defaultLanguage: process.env.OPENCLAW_WEB_STT_LANG ?? process.env.OPENCLAW_RUNTIME_STT_LANG ?? 'auto'
});
const tts = new MicrosoftTtsProvider({
  bus,
  voice: process.env.OPENCLAW_RUNTIME_TTS_VOICE ?? 'en-US-BrianMultilingualNeural'
});

void ensureGatewaySession();

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/') {
      return await serveFile(res, join(publicDir, 'index.html'), 'text/html; charset=utf-8');
    }
    if (req.method === 'GET' && req.url === '/health') {
      return json(res, 200, { ok: true, sessionKey });
    }
    if (req.method === 'POST' && req.url === '/api/reset') {
      return json(res, 200, { ok: true });
    }
    if (req.method === 'POST' && req.url === '/api/turn') {
      const browserSessionId = getBrowserSessionId(req.headers['x-session-id']);
      const contentType = String(req.headers['content-type'] ?? 'audio/webm');
      const body = await readRequestBody(req);
      if (body.length === 0) return json(res, 400, { error: 'empty audio body' });
      const result = await handleTurn({ browserSessionId, contentType, body });
      return json(res, 200, result);
    }
    return json(res, 404, { error: 'not found' });
  } catch (error) {
    console.error('[voice-web] request failed', error);
    return json(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(port, host, () => {
  console.log(`[voice-web] listening on http://${host}:${port}`);
  console.log(`[voice-web] target session ${sessionKey}`);
});

async function handleTurn(input) {
  await ensureGatewaySession();
  const turnId = randomUUID();
  const tempDir = await mkdtemp(join(tmpdir(), 'kelex-web-turn-'));
  try {
    const ext = extensionFromContentType(input.contentType);
    const audioPath = join(tempDir, `input${ext}`);
    await writeFile(audioPath, input.body);

    const transcript = await stt.transcribeFile(audioPath, process.env.OPENCLAW_WEB_STT_LANG);
    const replyText = await sendToBackendAndWait({
      browserSessionId: input.browserSessionId,
      turnId,
      text: transcript
    });

    const replyPath = join(tempDir, 'reply.mp3');
    await tts.synthesizeToFile(replyText, replyPath);
    const audioBuffer = await readFile(replyPath);

    return {
      transcript,
      replyText,
      audioBase64: audioBuffer.toString('base64'),
      audioMimeType: 'audio/mpeg'
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function sendToBackendAndWait(input) {
  const completed = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      off();
      reject(new Error('timeout waiting backend.completed'));
    }, 60000);

    const off = bus.subscribe(async (event) => {
      if (event.type !== 'backend.completed') return;
      if (event.turnId !== input.turnId) return;
      clearTimeout(timeout);
      off();
      resolve(event.text);
    });
  });

  await backend.sendUserTurn({
    sessionId: input.browserSessionId,
    turnId: input.turnId,
    text: input.text
  });

  return completed;
}

async function ensureGatewaySession() {
  try {
    await gatewayClient.call('sessions.create', {
      agentId,
      key: sessionKey,
      label: 'Runtime OpenClaw Web'
    }, { timeoutMs: 30000 });
  } catch (error) {
    console.warn('[voice-web] sessions.create warning', error instanceof Error ? error.message : String(error));
  }
}

function extensionFromContentType(contentType) {
  if (contentType.includes('ogg')) return '.ogg';
  if (contentType.includes('mp4') || contentType.includes('m4a')) return '.m4a';
  if (contentType.includes('mpeg')) return '.mp3';
  return '.webm';
}

function getBrowserSessionId(header) {
  const value = Array.isArray(header) ? header[0] : header;
  return value && value.trim() ? value.trim() : randomUUID();
}

async function serveFile(res, path, contentType) {
  await stat(path);
  const content = await readFile(path);
  res.writeHead(200, { 'content-type': contentType });
  res.end(content);
}

async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}
