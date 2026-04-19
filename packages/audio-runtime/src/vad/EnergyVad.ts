import type { AudioFrame, EventBus, VadPort } from "@kelex/conversation-core";

export interface EnergyVadOptions {
  bus: EventBus;
  startThreshold?: number;
  endThreshold?: number;
  endSilenceMs?: number;
  languageHint?: string;
}

export class EnergyVad implements VadPort {
  private readonly bus: EventBus;
  private readonly startThreshold: number;
  private readonly endThreshold: number;
  private readonly endSilenceMs: number;
  private readonly languageHint?: string;
  private speaking = false;
  private lastAboveThresholdAt = 0;

  constructor(options: EnergyVadOptions) {
    this.bus = options.bus;
    this.startThreshold = options.startThreshold ?? 0.015;
    this.endThreshold = options.endThreshold ?? 0.008;
    this.endSilenceMs = options.endSilenceMs ?? 800;
    this.languageHint = options.languageHint;
  }

  pushFrame(frame: AudioFrame): void {
    const energy = computeRms(frame.pcm);
    const now = frame.ts;

    if (!this.speaking && energy >= this.startThreshold) {
      this.speaking = true;
      this.lastAboveThresholdAt = now;
      void this.bus.publish({ type: "speech.started", ts: now, language: this.languageHint });
      return;
    }

    if (!this.speaking) return;

    if (energy >= this.endThreshold) {
      this.lastAboveThresholdAt = now;
      return;
    }

    if (now - this.lastAboveThresholdAt >= this.endSilenceMs) {
      this.speaking = false;
      void this.bus.publish({
        type: "speech.ended",
        ts: now,
        silenceMs: now - this.lastAboveThresholdAt
      });
    }
  }

  reset(): void {
    this.speaking = false;
    this.lastAboveThresholdAt = 0;
  }
}

function computeRms(pcm: Buffer): number {
  if (pcm.length < 2) return 0;
  let sum = 0;
  let samples = 0;
  for (let i = 0; i + 1 < pcm.length; i += 2) {
    const sample = pcm.readInt16LE(i) / 32768;
    sum += sample * sample;
    samples += 1;
  }
  if (samples === 0) return 0;
  return Math.sqrt(sum / samples);
}
