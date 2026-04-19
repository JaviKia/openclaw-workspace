import { execFile, spawn, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import type { AudioFrame } from "@kelex/conversation-core";
import type { AudioInputPort } from "@kelex/conversation-core";

const execFileAsync = promisify(execFile);

export interface PulseAudioInputOptions {
  parecPath?: string;
  pactlPath?: string;
  source?: string;
  sampleRate?: number;
  channels?: number;
  frameBytes?: number;
  onSourceResolved?: (source: string) => void;
}

export class PulseAudioInput implements AudioInputPort {
  private readonly parecPath: string;
  private readonly pactlPath: string;
  private readonly requestedSource?: string;
  private readonly sampleRate: number;
  private readonly channels: number;
  private readonly frameBytes: number;
  private readonly onSourceResolved?: (source: string) => void;
  private process?: ChildProcess;
  private onFrameHandler?: (frame: AudioFrame) => void;
  private pending = Buffer.alloc(0);
  private resolvedSource?: string;

  constructor(options: PulseAudioInputOptions = {}) {
    this.parecPath = options.parecPath ?? "/data/linuxbrew/.linuxbrew/bin/parec";
    this.pactlPath = options.pactlPath ?? "pactl";
    this.requestedSource = options.source;
    this.sampleRate = options.sampleRate ?? 16000;
    this.channels = options.channels ?? 1;
    this.frameBytes = options.frameBytes ?? 3200;
    this.onSourceResolved = options.onSourceResolved;
  }

  onFrame(cb: (frame: AudioFrame) => void): void {
    this.onFrameHandler = cb;
  }

  async start(): Promise<void> {
    if (this.process) return;
    this.resolvedSource = await this.resolveSource();
    this.onSourceResolved?.(this.resolvedSource);
    this.process = spawn(this.parecPath, [
      "--raw",
      "--format=s16le",
      `--channels=${this.channels}`,
      `--rate=${this.sampleRate}`,
      `--device=${this.resolvedSource}`
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

  private async resolveSource(): Promise<string> {
    if (this.requestedSource) {
      return this.requestedSource;
    }

    const sources = await listPulseSources(this.pactlPath);
    if (sources.length === 0) {
      return "auto_null.monitor";
    }

    const defaultSource = await getDefaultPulseSource(this.pactlPath);
    const preferredInput = sources.find((source) => !source.endsWith(".monitor"));
    if (preferredInput) {
      return preferredInput;
    }
    if (defaultSource && sources.includes(defaultSource)) {
      return defaultSource;
    }
    return sources[0] ?? "auto_null.monitor";
  }
}

async function listPulseSources(pactlPath: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync(pactlPath, ["list", "short", "sources"], {
      timeout: 5000,
      maxBuffer: 1024 * 1024
    });
    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split(/\s+/)[1])
      .filter((value): value is string => Boolean(value));
  } catch {
    return [];
  }
}

async function getDefaultPulseSource(pactlPath: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync(pactlPath, ["info"], {
      timeout: 5000,
      maxBuffer: 1024 * 1024
    });
    const line = stdout
      .split(/\r?\n/)
      .find((entry) => entry.startsWith("Default Source:"));
    return line?.split(":")[1]?.trim();
  } catch {
    return undefined;
  }
}
