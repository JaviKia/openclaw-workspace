import {
  BasicConversationOrchestrator,
  InMemoryEventBus,
  type RuntimeConfig
} from "@kelex/conversation-core";
import { createRuntimeAudioInput, createRuntimeVad, getRuntimeAudioDiagnostics } from "./runtimeAudio.js";
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
const audioInput = createRuntimeAudioInput();
const vad = createRuntimeVad(bus);
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

let capturedFrames = 0;
audioInput.onFrame((frame) => {
  capturedFrames += 1;
  void orchestrator.handleAudioFrame(frame);
  vad.pushFrame(frame);
  if (capturedFrames <= 3) {
    console.log("[audio] frame", {
      bytes: frame.pcm.length,
      sampleRate: frame.sampleRate,
      channels: frame.channels
    });
  }
});

bus.subscribe(async (event) => {
  console.log(`[runtime] ${event.type}`, sanitizeEventForLog(event));
  if (event.type === "stt.final") {
    await orchestrator.handleEvent(event);
    return;
  }
  if (
    event.type === "speech.started" ||
    event.type === "speech.ended" ||
    event.type === "speech.interrupted" ||
    event.type === "tts.audio.chunk"
  ) {
    await orchestrator.handleEvent(event);
  }
});

const sessionId = await orchestrator.startSession();
console.log(`[runtime] session started: ${sessionId}`);

if (process.env.OPENCLAW_RUNTIME_REAL_AUDIO === "1") {
  const diagnostics = await getRuntimeAudioDiagnostics();
  console.log("[audio] diagnostics", diagnostics);
  await audioInput.start();
  await new Promise((resolve) => setTimeout(resolve, Number(process.env.OPENCLAW_RUNTIME_AUDIO_TEST_MS ?? 2000)));
  await audioInput.stop();
  console.log(`[audio] captured frames: ${capturedFrames}`);
} else {
  const turnId = crypto.randomUUID();
  await orchestrator.handleEvent({ type: "speech.started", ts: Date.now() });
  await orchestrator.handleEvent({ type: "stt.partial", turnId, text: "hola", ts: Date.now() });
  await orchestrator.handleEvent({ type: "speech.ended", ts: Date.now(), silenceMs: 850 });
  await orchestrator.handleEvent({ type: "stt.final", turnId, text: "hola que tal", ts: Date.now(), language: "es" });
  await orchestrator.handleEvent({ type: "backend.token", turnId, token: "Hola Javi, ", ts: Date.now() });
  if (process.env.OPENCLAW_RUNTIME_TEST_INTERRUPT === "1") {
    await orchestrator.handleEvent({ type: "speech.started", ts: Date.now() + 10 });
    const interruptTurnId = crypto.randomUUID();
    await orchestrator.handleEvent({ type: "backend.token", turnId, token: "esto no debe sonar", ts: Date.now() + 20 });
    await orchestrator.handleEvent({ type: "backend.completed", turnId, text: "respuesta interrumpida", ts: Date.now() + 30 });
    await orchestrator.handleEvent({ type: "stt.partial", turnId: interruptTurnId, text: "para", ts: Date.now() + 40 });
    await orchestrator.handleEvent({ type: "speech.ended", ts: Date.now() + 50, silenceMs: 850 });
    await orchestrator.handleEvent({ type: "stt.final", turnId: interruptTurnId, text: "para", ts: Date.now() + 60, language: "es" });
    await orchestrator.handleEvent({ type: "backend.token", turnId: interruptTurnId, token: "Vale, paro.", ts: Date.now() + 70 });
    await orchestrator.handleEvent({ type: "backend.completed", turnId: interruptTurnId, text: "Vale, paro.", ts: Date.now() + 80 });
  } else {
    await orchestrator.handleEvent({ type: "backend.token", turnId, token: "qué tal.", ts: Date.now() });
    await orchestrator.handleEvent({ type: "backend.completed", turnId, text: "Hola Javi, qué tal.", ts: Date.now() });
  }
}

console.log(`[runtime] final state: ${orchestrator.getState()}`);

function sanitizeEventForLog(event: Parameters<typeof bus.subscribe>[0] extends (arg: infer T) => unknown ? T : never) {
  if (event.type !== "tts.audio.chunk") return event;
  return {
    ...event,
    chunk: {
      ...event.chunk,
      audio: `<${event.chunk.audio.length} bytes>`
    }
  };
}
