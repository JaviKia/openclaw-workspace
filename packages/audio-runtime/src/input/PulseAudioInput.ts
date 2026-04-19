import { spawn, type ChildProcess } from "node:child_process";
import type { AudioFrame } from "@kelex/conversation-core";
import type { AudioInputPort } from "@kelex/conversation-core";

export interface PulseAudioInputOptions {
  parecPath?: string;
  source?: string;
  sampleRate?: number;
  channels?: number;
  frameBytes?: number;
}

export class PulseAudioInput implements AudioInputPort {
  private readonly parecPath: string;
  private readonly source: string;
  private readonly sampleRate: number;
  private readonly channels: number;
  private readonly frameBytes: number;
  private process?: ChildProcess;
  private onFrameHandler?: (frame: AudioFrame) => void;
  private pending = Buffer.alloc(0);

  constructor(options: PulseAudioInputOptions = {}) {
    this.parecPath = options.parecPath ?? "/data/linuxbrew/.linuxbrew/bin/parec";
    this.source = options.source ?? "auto_null.monitor";
    this.sampleRate = options.sampleRate ?? 16000;
    this.channels = options.channels ?? 1;
    this.frameBytes = options.frameBytes ?? 3200;
  }

  onFrame(cb: (frame: AudioFrame) => void): void {
    this.onFrameHandler = cb;
  }

  async start(): Promise<void> {
    if (this.process) return;
    this.process = spawn(this.parecPath, [
      "--raw",
      "--format=s16le",
      `--channels=${this.channels}`,
      `--rate=${this.sampleRate}`,
      `--device=${this.source}`
    ], {
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

    await new Promise<void>((resolve, reject) => {
      const proc = this.process;
      if (!proc) {
        resolve();
        return;
      }
      proc.once("error", reject);
      proc.once("spawn", () => resolve());
    });
  }

  async stop(): Promise<void> {
    if (this.process && !this.process.killed) {
      this.process.kill("SIGKILL");
    }
    this.process = undefined;
    this.pending = Buffer.alloc(0);
  }
}
