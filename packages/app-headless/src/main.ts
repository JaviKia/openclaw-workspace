import {
  BasicConversationOrchestrator,
  InMemoryEventBus,
  type RuntimeConfig
} from "@kelex/conversation-core";
import { createRuntimeBackend } from "./runtimeBackend.js";
import { createRuntimePlayback } from "./runtimePlayback.js";
import { createRuntimeStt } from "./runtimeStt.js";
import { createRuntimeTts } from "./runtimeTts.js";
import { StubResponseComposer } from "./stubs.js";

const config: RuntimeConfig = {
  session: {
    maxTurns: 20,
    maxContextChars: 4000
  },
  turnPolicy: {
    endSilenceMs: 800,
    interruptDebounceMs: 250
  }
};

const bus = new InMemoryEventBus();
const playback = createRuntimePlayback();
const orchestrator = new BasicConversationOrchestrator({
  bus,
  config,
  stt: createRuntimeStt(bus),
  backend: createRuntimeBackend(),
  composer: new StubResponseComposer(),
  tts: createRuntimeTts(bus),
  playback
});

bus.subscribe(async (event) => {
  console.log(`[runtime] ${event.type}`, event);
  if (event.type === "stt.final") {
    await orchestrator.handleEvent(event);
  }
});

const sessionId = await orchestrator.startSession();
const turnId = crypto.randomUUID();

console.log(`[runtime] session started: ${sessionId}`);

await orchestrator.handleEvent({ type: "speech.started", ts: Date.now() });
await orchestrator.handleEvent({ type: "stt.partial", turnId, text: "hola", ts: Date.now() });
await orchestrator.handleEvent({ type: "speech.ended", ts: Date.now(), silenceMs: 850 });
await orchestrator.handleEvent({ type: "stt.final", turnId, text: "hola que tal", ts: Date.now(), language: "es" });
await orchestrator.handleEvent({ type: "backend.token", turnId, token: "Hola Javi, ", ts: Date.now() });
await orchestrator.handleEvent({ type: "backend.token", turnId, token: "qué tal.", ts: Date.now() });
await orchestrator.handleEvent({ type: "backend.completed", turnId, text: "Hola Javi, qué tal.", ts: Date.now() });

console.log(`[runtime] final state: ${orchestrator.getState()}`);
