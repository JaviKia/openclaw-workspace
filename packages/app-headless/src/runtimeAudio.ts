import { PulseAudioInput } from "@kelex/audio-runtime";
import type { AudioFrame, AudioInputPort } from "@kelex/conversation-core";

class NullAudioInput implements AudioInputPort {
  onFrame(_cb: (frame: AudioFrame) => void): void {}
  async start(): Promise<void> {}
  async stop(): Promise<void> {}
}

export function createRuntimeAudioInput(): AudioInputPort {
  if (process.env.OPENCLAW_RUNTIME_REAL_AUDIO === "1") {
    return new PulseAudioInput({
      parecPath: process.env.OPENCLAW_RUNTIME_PAREC_BIN ?? "/data/linuxbrew/.linuxbrew/bin/parec",
      source: process.env.OPENCLAW_RUNTIME_PULSE_SOURCE ?? "auto_null.monitor",
      sampleRate: Number(process.env.OPENCLAW_RUNTIME_AUDIO_RATE ?? 16000),
      channels: Number(process.env.OPENCLAW_RUNTIME_AUDIO_CHANNELS ?? 1)
    });
  }
  return new NullAudioInput();
}
