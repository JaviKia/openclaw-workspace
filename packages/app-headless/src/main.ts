import {
  BasicConversationOrchestrator,
  InMemoryEventBus,
  type RuntimeConfig
} from "@kelex/conversation-core";
import {
  StubBackendPort,
  StubPlaybackPort,
  StubResponseComposer,
  StubSttPort,
  StubTtsPort
} from "./stubs.js";

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
const orchestrator = new BasicConversationOrchestrator({
  bus,
  config,
  stt: new StubSttPort(),
  backend: new StubBackendPort(),
  composer: new StubResponseComposer(),
  tts: new StubTtsPort(),
  playback: new StubPlaybackPort()
});

bus.subscribe(async (event) => {
  console.log(`[runtime] ${event.type}`, event);
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
