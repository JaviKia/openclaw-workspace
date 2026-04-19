import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PlaybackPort, TtsAudioChunk } from "@kelex/conversation-core";

export interface FfplayPlaybackControllerOptions {
  ffplayPath?: string;
}

export class FfplayPlaybackController implements PlaybackPort {
  private readonly ffplayPath: string;
  private currentProcess?: ChildProcess;
  private currentTempDir?: string;
  private currentExitPromise?: Promise<void>;

  constructor(options: FfplayPlaybackControllerOptions = {}) {
    this.ffplayPath = options.ffplayPath ?? "/data/linuxbrew/.linuxbrew/bin/ffplay";
  }

  async play(chunk: TtsAudioChunk): Promise<void> {
    await this.stop("cancel");
    const tempDir = await mkdtemp(join(tmpdir(), "kelex-playback-"));
    this.currentTempDir = tempDir;
    const ext = chunk.format === "opus" ? "opus" : chunk.format === "pcm" ? "wav" : "mp3";
    const audioPath = join(tempDir, `${chunk.chunkId}.${ext}`);
    await writeFile(audioPath, chunk.audio);
    this.currentProcess = spawn(this.ffplayPath, [
      "-nodisp",
      "-autoexit",
      "-loglevel",
      "error",
      audioPath
    ], {
      stdio: "pipe"
    });
    await new Promise<void>((resolve, reject) => {
      const proc = this.currentProcess;
      if (!proc) {
        resolve();
        return;
      }
      proc.once("error", reject);
      proc.once("spawn", () => resolve());
    });
    this.currentExitPromise = new Promise<void>((resolve) => {
      this.currentProcess?.once("exit", () => resolve());
      this.currentProcess?.once("close", () => resolve());
      this.currentProcess?.once("error", () => resolve());
    });
  }

  async stop(_reason: "interrupt" | "cancel" | "error" | "completed"): Promise<void> {
    if (this.currentProcess && !this.currentProcess.killed) {
      this.currentProcess.kill("SIGKILL");
    }
    await this.currentExitPromise?.catch(() => undefined);
    this.currentProcess = undefined;
    this.currentExitPromise = undefined;
    if (this.currentTempDir) {
      await rm(this.currentTempDir, { recursive: true, force: true });
      this.currentTempDir = undefined;
    }
  }

  async flush(): Promise<void> {
    await this.currentExitPromise?.catch(() => undefined);
  }
}
