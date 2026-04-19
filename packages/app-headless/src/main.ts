import {
  BasicConversationOrchestrator,
  InMemoryEventBus,
  type RuntimeConfig
} from "@kelex/conversation-core";

const config: RuntimeConfig = {
  session: {
    maxTurns: 20,
    maxContextChars: 4000
  }
};

const bus = new InMemoryEventBus();
const orchestrator = new BasicConversationOrchestrator(bus, config);

bus.subscribe(async (event) => {
  console.log(`[runtime] ${event.type}`, event);
});

const sessionId = await orchestrator.startSession();
console.log(`[runtime] session started: ${sessionId}`);

await orchestrator.handleEvent({ type: "speech.started", ts: Date.now() });
const turnId = crypto.randomUUID();
await orchestrator.handleEvent({ type: "stt.partial", turnId, text: "hola", ts: Date.now() });
await orchestrator.handleEvent({ type: "speech.ended", ts: Date.now(), silenceMs: 850 });
await orchestrator.handleEvent({ type: "stt.final", turnId, text: "hola que tal", ts: Date.now(), language: "es" });
await orchestrator.handleEvent({ type: "backend.token", turnId, token: "hola", ts: Date.now() });
await orchestrator.handleEvent({ type: "backend.completed", turnId, text: "hola javi", ts: Date.now() });

console.log(`[runtime] final state: ${orchestrator.getState()}`);
