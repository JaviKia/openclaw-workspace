import { OpenClawBackendAdapter } from "@kelex/backend-openclaw";
import type { BackendPort } from "@kelex/conversation-core";
import { StubBackendPort } from "./stubs.js";

export function createRuntimeBackend(): BackendPort {
  if (process.env.OPENCLAW_RUNTIME_REAL_BACKEND === "1") {
    return new OpenClawBackendAdapter({
      sessionKey: process.env.OPENCLAW_RUNTIME_SESSION_KEY ?? "agent:main:main",
      binaryPath: process.env.OPENCLAW_RUNTIME_OPENCLAW_BIN ?? "/data/.npm-global/bin/openclaw",
      token: process.env.OPENCLAW_GATEWAY_TOKEN,
      url: process.env.OPENCLAW_GATEWAY_URL
    });
  }
  return new StubBackendPort();
}
