import { MicrosoftTtsProvider } from "@kelex/tts-runtime";
import type { EventBus, TtsPort } from "@kelex/conversation-core";
import { StubTtsPort } from "./stubs.js";

export function createRuntimeTts(bus: EventBus): TtsPort {
  if (process.env.OPENCLAW_RUNTIME_REAL_TTS === "1") {
    return new MicrosoftTtsProvider({
      bus,
      voice: process.env.OPENCLAW_RUNTIME_TTS_VOICE ?? "en-US-BrianMultilingualNeural"
    });
  }
  return new StubTtsPort();
}
