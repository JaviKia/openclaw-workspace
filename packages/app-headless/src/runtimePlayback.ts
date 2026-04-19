import { FfplayPlaybackController } from "@kelex/playback-runtime";
import type { PlaybackPort } from "@kelex/conversation-core";
import { StubPlaybackPort } from "./stubs.js";

export function createRuntimePlayback(): PlaybackPort {
  if (process.env.OPENCLAW_RUNTIME_REAL_PLAYBACK === "1") {
    return new FfplayPlaybackController({
      ffplayPath: process.env.OPENCLAW_RUNTIME_FFPLAY_BIN ?? "/data/linuxbrew/.linuxbrew/bin/ffplay"
    });
  }
  return new StubPlaybackPort();
}
