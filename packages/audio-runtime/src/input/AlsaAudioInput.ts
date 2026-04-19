import { spawn, type ChildProcess } from "node:child_process";
import type { AudioFrame, AudioInputPort } from "@kelex/conversation-core";

export interface AlsaAudioInputOptions {
  arecordPath?: string;
  device?: string;
  sampleRate?: number;
  channels?: number;
  frameBytes?: number;
  onDeviceResolved?: (device: string) => void;
}

export class AlsaAudioInput implements AudioInputPort {
  private readonly arecordPath: string;
  private readonly device: string;
  private readonly sampleRate: number;
  private readonly channels: number;
  private readonly frameBytes: number;
  private readonly onDeviceResolved?: (device: string) => void;
  private process?: ChildProcess;
  private onFrameHandler?: (frame: AudioFrame) => void;
  private pending = Buffer.alloc(0);

  constructor(options: AlsaAudioInputOptions = {}) {
    this.arecordPath = options.arecordPath ?? "arecord";
    this.device = options.device ?? "default";
    this.sampleRate = options.sampleRate ?? 16000;
    this.channels = options.channels ?? 1;
    this.frameBytes = options.frameBytes ?? 3200;
    this.onDeviceResolved = options.onDeviceResolved;
  }

  onFrame(cb: (frame: AudioFrame) => void): void {
    this.onFrameHandler = cb;
  }

  async start(): Promise<void> {
    if (this.process) return;
    this.onDeviceResolved?.(this.device);
    this.process = spawn(this.arecordPath, [
      "-q",
      "-D",
      this.device,
      "-f",
      "S16_LE",
      "-c",
      String(this.channels),
      "-r",
      String(this.sampleRate),
      "-t",
      "raw"
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
}
