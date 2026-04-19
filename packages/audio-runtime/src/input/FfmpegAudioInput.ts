import { spawn, type ChildProcess } from "node:child_process";
import type { AudioFrame, AudioInputPort } from "@kelex/conversation-core";

export interface FfmpegAudioInputOptions {
  ffmpegPath?: string;
  inputFormat?: "pulse" | "file";
  source?: string;
  inputPath?: string;
  sampleRate?: number;
  channels?: number;
  frameBytes?: number;
  onInputResolved?: (input: { format: "pulse" | "file"; target: string }) => void;
  onEnded?: () => void;
}

export class FfmpegAudioInput implements AudioInputPort {
  private readonly ffmpegPath: string;
  private readonly inputFormat: "pulse" | "file";
  private readonly source?: string;
  private readonly inputPath?: string;
  private readonly sampleRate: number;
  private readonly channels: number;
  private readonly frameBytes: number;
  private readonly onInputResolved?: (input: { format: "pulse" | "file"; target: string }) => void;
  private onEndedHandler?: () => void;
  private process?: ChildProcess;
  private onFrameHandler?: (frame: AudioFrame) => void;
  private pending = Buffer.alloc(0);

  constructor(options: FfmpegAudioInputOptions = {}) {
    this.ffmpegPath = options.ffmpegPath ?? "/data/linuxbrew/.linuxbrew/bin/ffmpeg";
    this.inputFormat = options.inputFormat ?? "pulse";
    this.source = options.source;
    this.inputPath = options.inputPath;
    this.sampleRate = options.sampleRate ?? 16000;
    this.channels = options.channels ?? 1;
    this.frameBytes = options.frameBytes ?? 3200;
    this.onInputResolved = options.onInputResolved;
    this.onEndedHandler = options.onEnded;
  }

  onFrame(cb: (frame: AudioFrame) => void): void {
    this.onFrameHandler = cb;
  }

  onEnded(cb: () => void): void {
    this.onEndedHandler = cb;
  }

  async start(): Promise<void> {
    if (this.process) return;
    const args = this.buildArgs();
    this.onInputResolved?.({ format: this.inputFormat, target: this.inputFormat === "file" ? (this.inputPath ?? "") : (this.source ?? "default") });
    this.process = spawn(this.ffmpegPath, args, {
      stdio: ["ignore", "pipe", "pipe"]
    });

    this.process.stdout?.on("data", (chunk: Buffer) => {
      this.pending = Buffer.concat([this.pending, chunk]);
      while (this.pending.length >= this.frameBytes) {
        const frameBuffer = this.pending.subarray(0, this.frameBytes);
        this.pending = this.pending.subarray(this.frameBytes);
        this.onFrameHandler?.({
          ts: Date.now(),
          pcm: Buffer.from(frameBuffer),
          sampleRate: this.sampleRate,
          channels: this.channels
        });
      }
    });

    this.process.once("close", () => {
      this.process = undefined;
      this.pending = Buffer.alloc(0);
      this.onEndedHandler?.();
    });

    await new Promise<void>((resolve, reject) => {
      const proc = this.process;
      if (!proc) return resolve();
      proc.once("error", reject);
      proc.once("spawn", resolve);
    });
  }

  async stop(): Promise<void> {
    if (this.process && !this.process.killed) {
      this.process.kill("SIGKILL");
    }
    this.process = undefined;
    this.pending = Buffer.alloc(0);
  }

  private buildArgs(): string[] {
    if (this.inputFormat === "file") {
      if (!this.inputPath) {
        throw new Error("FfmpegAudioInput requires inputPath when inputFormat=file");
      }
      return [
        "-hide_banner",
        "-loglevel",
        "error",
        "-re",
        "-i",
        this.inputPath,
        "-af",
        "apad=pad_dur=1",
        "-f",
        "s16le",
        "-ac",
        String(this.channels),
        "-ar",
        String(this.sampleRate),
        "-acodec",
        "pcm_s16le",
        "-"
      ];
    }

    return [
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "pulse",
      "-i",
      this.source ?? "default",
      "-f",
      "s16le",
      "-ac",
      String(this.channels),
      "-ar",
      String(this.sampleRate),
      "-acodec",
      "pcm_s16le",
      "-"
    ];
  }
}
