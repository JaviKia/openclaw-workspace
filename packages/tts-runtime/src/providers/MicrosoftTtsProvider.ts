import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { EventBus, SpeakableChunk, TtsAudioChunk, TtsPort } from "@kelex/conversation-core";

type MicrosoftSpeechProviderFactory = () => {
  synthesize(input: {
    text: string;
    providerConfig: {
      voice: string;
      outputFormat: string;
      enabled: boolean;
    };
    providerOverrides: Record<string, unknown>;
    timeoutMs: number;
  }): Promise<{ audioBuffer: Buffer }>;
};

export interface MicrosoftTtsProviderOptions {
  bus: EventBus;
  voice?: string;
  outputFormat?: string;
}

export class MicrosoftTtsProvider implements TtsPort {
  private readonly bus: EventBus;
  private readonly voice: string;
  private readonly outputFormat: string;
  private readonly providerPromise = loadMicrosoftSpeechProvider();

  constructor(options: MicrosoftTtsProviderOptions) {
    this.bus = options.bus;
    this.voice = options.voice ?? "en-US-BrianMultilingualNeural";
    this.outputFormat = options.outputFormat ?? "audio-24khz-48kbitrate-mono-mp3";
  }

  async speak(chunk: SpeakableChunk): Promise<void> {
    const provider = await this.providerPromise;
    const result = await provider.synthesize({
      text: chunk.text,
      providerConfig: {
        voice: this.voice,
        outputFormat: this.outputFormat,
        enabled: true
      },
      providerOverrides: {},
      timeoutMs: 30000
    });
    const audioChunk: TtsAudioChunk = {
      turnId: chunk.turnId,
      chunkId: chunk.chunkId,
      audio: result.audioBuffer,
      format: "mp3"
    };
    await this.bus.publish({
      type: "tts.audio.chunk",
      turnId: chunk.turnId,
      chunkId: chunk.chunkId,
      ts: Date.now(),
      chunk: audioChunk
    });
    await this.writeDebugAudio(audioChunk);
  }

  async cancel(_turnId: string): Promise<void> {}

  async synthesizeToFile(text: string, outPath: string): Promise<void> {
    const provider = await this.providerPromise;
    const result = await provider.synthesize({
      text,
      providerConfig: {
        voice: this.voice,
        outputFormat: this.outputFormat,
        enabled: true
      },
      providerOverrides: {},
      timeoutMs: 30000
    });
    await writeFile(outPath, result.audioBuffer);
  }

  private async writeDebugAudio(chunk: TtsAudioChunk): Promise<void> {
    const tempDir = await mkdtemp(join(tmpdir(), "kelex-tts-"));
    try {
      const outPath = join(tempDir, `${chunk.chunkId}.mp3`);
      await writeFile(outPath, chunk.audio);
      await readFile(outPath);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}

async function loadMicrosoftSpeechProvider(): Promise<ReturnType<MicrosoftSpeechProviderFactory>> {
  const modulePath = await resolveSpeechProviderModulePath();
  const loaded = (await import(pathToFileURL(modulePath).href)) as { t?: MicrosoftSpeechProviderFactory };
  if (typeof loaded.t !== "function") {
    throw new Error(`Invalid OpenClaw speech provider module: ${modulePath}`);
  }
  return loaded.t();
}

async function resolveSpeechProviderModulePath(): Promise<string> {
  const explicitPath = process.env.OPENCLAW_SPEECH_PROVIDER_MODULE;
  if (explicitPath) {
    return explicitPath;
  }

  const candidateDistDirs = [
    process.env.OPENCLAW_DIST_DIR,
    "/data/.npm-global/lib/node_modules/openclaw/dist",
    "/usr/local/lib/node_modules/openclaw/dist"
  ].filter((value): value is string => Boolean(value));

  for (const distDir of candidateDistDirs) {
    try {
      const entries = await readdir(distDir);
      const match = entries.find((entry) => /^speech-provider-.*\.js$/.test(entry));
      if (match) {
        return join(distDir, match);
      }
    } catch {
      // try next candidate
    }
  }

  throw new Error(
    "OpenClaw speech provider bundle not found. Set OPENCLAW_DIST_DIR or OPENCLAW_SPEECH_PROVIDER_MODULE."
  );
}
