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
      defaultLanguage: process.env.OPENCLAW_RUNTIME_STT_LANG ?? "auto",
      ffmpegAudioFilter: process.env.OPENCLAW_RUNTIME_STT_FFMPEG_FILTER,
      ffmpegExtraArgs: (process.env.OPENCLAW_RUNTIME_STT_FFMPEG_EXTRA_ARGS ?? "")
        .split(" ")
        .map((value) => value.trim())
        .filter(Boolean),
      textReplacements: mergeTextReplacements(
        getDefaultTextReplacements(),
        parseTextReplacements(process.env.OPENCLAW_RUNTIME_STT_TEXT_REPLACEMENTS ?? "")
      )
    });
  }
  return new StubSttPort();
}

function parseTextReplacements(input: string): Array<{ from: string; to: string }> {
  return input
    .split("||")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [from, to] = entry.split("=>");
      return {
        from: from?.trim() ?? "",
        to: to?.trim() ?? ""
      };
    })
    .filter((entry) => entry.from.length > 0);
}

function getDefaultTextReplacements(): Array<{ from: string; to: string }> {
  return [
    { from: "Ranta MTTS", to: "runtime TTS" },
    { from: "Ranta M T T S", to: "runtime TTS" },
    { from: "Ranta Emeteties", to: "runtime TTS" },
    { from: "rantime", to: "runtime" },
    { from: "Rantime", to: "Runtime" },
    { from: "que lexquía", to: "Kelex Kia" },
    { from: "Que lexquía", to: "Kelex Kia" },
    { from: "que lex kia", to: "Kelex Kia" },
    { from: "Ke lex kia", to: "Kelex Kia" },
    { from: "4. 271", to: "4271" },
    { from: "OpenClark", to: "OpenClaw" }
  ];
}

function mergeTextReplacements(
  base: Array<{ from: string; to: string }>,
  overrides: Array<{ from: string; to: string }>
): Array<{ from: string; to: string }> {
  const merged = new Map<string, string>();
  for (const item of base) {
    merged.set(item.from, item.to);
  }
  for (const item of overrides) {
    merged.set(item.from, item.to);
  }
  return Array.from(merged.entries()).map(([from, to]) => ({ from, to }));
}
