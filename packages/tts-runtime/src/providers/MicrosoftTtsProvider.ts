import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { EventBus, SpeakableChunk, TtsAudioChunk, TtsPort } from "@kelex/conversation-core";
// @ts-expect-error OpenClaw bundle path has no published typings.
import { t as buildMicrosoftSpeechProvider } from "/data/.npm-global/lib/node_modules/openclaw/dist/speech-provider-cOElwswQ.js";

export interface MicrosoftTtsProviderOptions {
  bus: EventBus;
  voice?: string;
  outputFormat?: string;
}

export class MicrosoftTtsProvider implements TtsPort {
  private readonly bus: EventBus;
  private readonly voice: string;
  private readonly outputFormat: string;
  private readonly provider = buildMicrosoftSpeechProvider();

  constructor(options: MicrosoftTtsProviderOptions) {
    this.bus = options.bus;
    this.voice = options.voice ?? "en-US-BrianMultilingualNeural";
    this.outputFormat = options.outputFormat ?? "audio-24khz-48kbitrate-mono-mp3";
  }

  async speak(chunk: SpeakableChunk): Promise<void> {
    const result = await this.provider.synthesize({
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
      ts: Date.now()
    });
    await this.writeDebugAudio(audioChunk);
  }

  async cancel(_turnId: string): Promise<void> {}

  async synthesizeToFile(text: string, outPath: string): Promise<void> {
    const result = await this.provider.synthesize({
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
