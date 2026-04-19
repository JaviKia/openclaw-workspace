import { AlsaAudioInput, EnergyVad, FfmpegAudioInput, getAlsaDiagnostics, getPulseAudioDiagnostics, PulseAudioInput } from "@kelex/audio-runtime";
import type { AudioFrame, AudioInputPort, EventBus, VadPort } from "@kelex/conversation-core";

class NullAudioInput implements AudioInputPort {
  onFrame(_cb: (frame: AudioFrame) => void): void {}
  onEnded(_cb: () => void): void {}
  async start(): Promise<void> {}
  async stop(): Promise<void> {}
}

export function createRuntimeAudioInput(): AudioInputPort {
  if (process.env.OPENCLAW_RUNTIME_REAL_AUDIO === "1") {
    const backend = process.env.OPENCLAW_RUNTIME_AUDIO_BACKEND ?? "pulse";
    if (backend === "alsa") {
      return new AlsaAudioInput({
        arecordPath: process.env.OPENCLAW_RUNTIME_ARECORD_BIN ?? "arecord",
        device: process.env.OPENCLAW_RUNTIME_ALSA_DEVICE ?? "default",
        sampleRate: Number(process.env.OPENCLAW_RUNTIME_AUDIO_RATE ?? 16000),
        channels: Number(process.env.OPENCLAW_RUNTIME_AUDIO_CHANNELS ?? 1),
        onDeviceResolved: (device) => {
          console.log("[audio] alsa device", device);
        }
      });
    }
    if (backend === "ffmpeg") {
      return new FfmpegAudioInput({
        ffmpegPath: process.env.OPENCLAW_RUNTIME_FFMPEG_BIN ?? "/data/linuxbrew/.linuxbrew/bin/ffmpeg",
        inputFormat: process.env.OPENCLAW_RUNTIME_AUDIO_INPUT_FORMAT === "file" ? "file" : "pulse",
        source: process.env.OPENCLAW_RUNTIME_PULSE_SOURCE,
        inputPath: process.env.OPENCLAW_RUNTIME_AUDIO_INPUT_FILE,
        sampleRate: Number(process.env.OPENCLAW_RUNTIME_AUDIO_RATE ?? 16000),
        channels: Number(process.env.OPENCLAW_RUNTIME_AUDIO_CHANNELS ?? 1),
        onInputResolved: (input) => {
          console.log("[audio] ffmpeg input", input);
        }
      });
    }

    return new PulseAudioInput({
      parecPath: process.env.OPENCLAW_RUNTIME_PAREC_BIN ?? "/data/linuxbrew/.linuxbrew/bin/parec",
      pactlPath: process.env.OPENCLAW_RUNTIME_PACTL_BIN ?? "pactl",
      source: process.env.OPENCLAW_RUNTIME_PULSE_SOURCE,
      sampleRate: Number(process.env.OPENCLAW_RUNTIME_AUDIO_RATE ?? 16000),
      channels: Number(process.env.OPENCLAW_RUNTIME_AUDIO_CHANNELS ?? 1),
      onSourceResolved: (source) => {
        console.log("[audio] source", source);
      }
    });
  }
  return new NullAudioInput();
}

export async function getRuntimeAudioDiagnostics() {
  const [pulse, alsa] = await Promise.all([
    getPulseAudioDiagnostics(process.env.OPENCLAW_RUNTIME_PACTL_BIN ?? "pactl"),
    getAlsaDiagnostics(process.env.OPENCLAW_RUNTIME_ARECORD_BIN ?? "arecord")
  ]);
  return { pulse, alsa };
}

export function createRuntimeVad(bus: EventBus): VadPort {
  return new EnergyVad({
    bus,
    startThreshold: Number(process.env.OPENCLAW_RUNTIME_VAD_START ?? 0.015),
    endThreshold: Number(process.env.OPENCLAW_RUNTIME_VAD_END ?? 0.008),
    endSilenceMs: Number(process.env.OPENCLAW_RUNTIME_VAD_SILENCE_MS ?? 800)
  });
}
