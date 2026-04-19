import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { AudioFrame, EventBus, SttPort } from "@kelex/conversation-core";

const execFileAsync = promisify(execFile);

interface TurnBuffer {
  sessionId: string;
  turnId: string;
  language?: string;
  sampleRate: number;
  channels: number;
  frames: Buffer[];
}

export interface WhisperCliSttProviderOptions {
  bus: EventBus;
  binaryPath?: string;
  ffmpegPath?: string;
  modelPath?: string;
  defaultLanguage?: string;
  timeoutMs?: number;
  ffmpegAudioFilter?: string;
  ffmpegExtraArgs?: string[];
  textReplacements?: Array<{ from: string; to: string }>;
}

export class WhisperCliSttProvider implements SttPort {
  private readonly turns = new Map<string, TurnBuffer>();
  private readonly bus: EventBus;
  private readonly binaryPath: string;
  private readonly ffmpegPath: string;
  private readonly modelPath: string;
  private readonly defaultLanguage: string;
  private readonly timeoutMs: number;
  private readonly ffmpegAudioFilter?: string;
  private readonly ffmpegExtraArgs: string[];
  private readonly textReplacements: Array<{ from: string; to: string }>;

  constructor(options: WhisperCliSttProviderOptions) {
    this.bus = options.bus;
    this.binaryPath = options.binaryPath ?? "/data/linuxbrew/.linuxbrew/bin/whisper-cli";
    this.ffmpegPath = options.ffmpegPath ?? "/data/linuxbrew/.linuxbrew/bin/ffmpeg";
    this.modelPath = options.modelPath ?? "/data/.openclaw/models/whisper/ggml-base.bin";
    this.defaultLanguage = options.defaultLanguage ?? "auto";
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.ffmpegAudioFilter = options.ffmpegAudioFilter;
    this.ffmpegExtraArgs = options.ffmpegExtraArgs ?? [];
    this.textReplacements = options.textReplacements ?? [];
  }

  async startTurn(input: { turnId: string; sessionId: string; language?: string }): Promise<void> {
    this.turns.set(input.turnId, {
      sessionId: input.sessionId,
      turnId: input.turnId,
      language: input.language,
      sampleRate: 16000,
      channels: 1,
      frames: []
    });
  }

  async pushAudio(turnId: string, frame: AudioFrame): Promise<void> {
    const turn = this.turns.get(turnId);
    if (!turn) return;
    turn.sampleRate = frame.sampleRate;
    turn.channels = frame.channels;
    turn.frames.push(frame.pcm);
  }

  async stopTurn(turnId: string): Promise<void> {
    const turn = this.turns.get(turnId);
    if (!turn) return;
    const transcript = await this.transcribeTurn(turn);
    await this.bus.publish({
      type: "stt.final",
      turnId,
      text: transcript,
      ts: Date.now(),
      language: turn.language ?? this.defaultLanguage
    });
    this.turns.delete(turnId);
  }

  async cancelTurn(turnId: string): Promise<void> {
    this.turns.delete(turnId);
  }

  async transcribeFile(inputPath: string, language?: string): Promise<string> {
    const tempDir = await mkdtemp(join(tmpdir(), "kelex-stt-file-"));
    const normalizedPath = join(tempDir, `input.normalized.wav`);
    const outputBase = join(tempDir, `output`);
    try {
      const ffmpegArgs = [
        "-y",
        "-i",
        inputPath,
        ...this.buildFfmpegProcessingArgs(),
        "-ac",
        "1",
        "-ar",
        "16000",
        "-c:a",
        "pcm_s16le",
        normalizedPath
      ];
      await execFileAsync(this.ffmpegPath, ffmpegArgs, {
        timeout: this.timeoutMs,
        maxBuffer: 1024 * 1024 * 10
      });
      await execFileAsync(this.binaryPath, [
        "-m",
        this.modelPath,
        "-l",
        language ?? this.defaultLanguage,
        "-f",
        normalizedPath,
        "-otxt",
        "-of",
        outputBase,
        "-np",
        "-nt"
      ], {
        timeout: this.timeoutMs,
        maxBuffer: 1024 * 1024 * 10
      });
      const text = await readFile(`${outputBase}.txt`, "utf8");
      return this.postProcessTranscript(text);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private async transcribeTurn(turn: TurnBuffer): Promise<string> {
    const tempDir = await mkdtemp(join(tmpdir(), "kelex-stt-"));
    const wavPath = join(tempDir, `${turn.turnId}.wav`);
    const normalizedPath = join(tempDir, `${turn.turnId}.normalized.wav`);
    const outputBase = join(tempDir, turn.turnId);
    try {
      const pcm = Buffer.concat(turn.frames);
      await writeFile(wavPath, createWavFile(pcm, turn.sampleRate, turn.channels));
      return await this.transcribeFile(wavPath, turn.language);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private buildFfmpegProcessingArgs(): string[] {
    const args = [...this.ffmpegExtraArgs];
    if (this.ffmpegAudioFilter && this.ffmpegAudioFilter.trim()) {
      args.push("-af", this.ffmpegAudioFilter);
    }
    return args;
  }

  private postProcessTranscript(text: string): string {
    let result = text.replace(/\s+/g, " ").trim();

    for (const replacement of this.textReplacements) {
      if (!replacement.from) continue;
      result = result.split(replacement.from).join(replacement.to);
    }

    result = normalizeKnownNames(result);
    result = normalizeKnownProducts(result);
    result = normalizeGroupedNumbers(result);
    result = normalizePunctuation(result);

    return result;
  }
}

function normalizeKnownNames(text: string): string {
  return text
    .replace(/\b(?:que\s*lexqu[ií]a|que\s*lex\s*kia|ke\s*lex\s*kia|quelex\s*kia|kelex\s*kia)\b/gi, "Kelex Kia")
    .replace(/\bque\s+lex\b/gi, "Kelex");
}

function normalizeKnownProducts(text: string): string {
  return text
    .replace(/\bOpenClark\b/gi, "OpenClaw")
    .replace(/\bOpen Claw\b/gi, "OpenClaw");
}

function normalizeGroupedNumbers(text: string): string {
  return text.replace(/\b(\d)\.\s+(\d{3})\b/g, "$1$2");
}

function normalizePunctuation(text: string): string {
  let result = text;
  result = result.replace(/\s+([,.;:!?])/g, "$1");
  result = result.replace(/([,.;:!?])(\S)/g, "$1 $2");
  result = result.replace(/\s+/g, " ").trim();
  return result;
}

function createWavFile(pcm: Buffer, sampleRate: number, channels: number): Buffer {
  const bitsPerSample = 16;
  const byteRate = sampleRate * channels * bitsPerSample / 8;
  const blockAlign = channels * bitsPerSample / 8;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
