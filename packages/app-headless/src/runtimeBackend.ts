import { OpenClawBackendAdapter } from "@kelex/backend-openclaw";
import type { BackendPort, EventBus } from "@kelex/conversation-core";
import { EchoBackendPort, StubBackendPort } from "./stubs.js";

export function createRuntimeBackend(bus?: EventBus): BackendPort {
  if (process.env.OPENCLAW_RUNTIME_REAL_BACKEND === "1") {
    return new OpenClawBackendAdapter({
      bus,
      sessionKey: process.env.OPENCLAW_RUNTIME_SESSION_KEY ?? "agent:main:main",
      binaryPath: process.env.OPENCLAW_RUNTIME_OPENCLAW_BIN ?? "/data/.npm-global/bin/openclaw",
      token: process.env.OPENCLAW_GATEWAY_TOKEN,
      url: process.env.OPENCLAW_GATEWAY_URL
    });
  }
  if (process.env.OPENCLAW_RUNTIME_ECHO_BACKEND === "1" && bus) {
    return new EchoBackendPort(bus);
  }
  return new StubBackendPort();
}
