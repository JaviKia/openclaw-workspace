import { WhisperCliSttProvider } from "@kelex/stt-runtime";
import type { EventBus, SttPort } from "@kelex/conversation-core";
import { StubSttPort } from "./stubs.js";

export function createRuntimeStt(bus: EventBus): SttPort {
  if (process.env.OPENCLAW_RUNTIME_REAL_STT === "1") {
    return new WhisperCliSttProvider({
      bus,
      binaryPath: process.env.OPENCLAW_RUNTIME_WHISPER_BIN ?? "/data/linuxbrew/.linuxbrew/bin/whisper-cli",
      ffmpegPath: process.env.OPENCLAW_RUNTIME_FFMPEG_BIN ?? "/data/linuxbrew/.linuxbrew/bin/ffmpeg",
      modelPath: process.env.OPENCLAW_RUNTIME_WHISPER_MODEL ?? "/data/.openclaw/models/whisper/ggml-base.bin",
      defaultLanguage: process.env.OPENCLAW_RUNTIME_STT_LANG ?? "auto"
    });
  }
  return new StubSttPort();
}
