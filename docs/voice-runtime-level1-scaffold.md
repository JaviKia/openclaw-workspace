# Voice Runtime Level 1, scaffold inicial

## Objetivo

Definir una base implementable para un runtime conversacional por voz en tiempo real, reusable, modular y desacoplado de cualquier skill o canal concreto.

Este documento aterriza:
- estructura de repo recomendada
- contratos TypeScript iniciales
- orden de implementación
- bootstrap del modo headless
- criterios para que un nivel 2 reutilice el core sin duplicarlo

---

## Principios de diseño

- El núcleo es el `ConversationOrchestrator`
- El core no depende de Discord, Telegram ni UI
- El runtime trabaja con audio continuo, no con ficheros ni notas de voz
- La interrupción del usuario es una primitiva de primer nivel
- El nivel 1 no contiene lógica específica de inglés ni pedagogía
- El nivel 2 consumirá este runtime como una capa superior

---

## Estructura de monorepo recomendada

```text
packages/
  conversation-core/
    src/
      orchestrator/
        ConversationOrchestrator.ts
      state/
        ConversationState.ts
        transitions.ts
      session/
        SessionManager.ts
      events/
        EventBus.ts
        RuntimeEvents.ts
      contracts/
        Audio.ts
        Backend.ts
        Stt.ts
        Tts.ts
        Playback.ts
        Session.ts
      policies/
        TurnPolicy.ts
        ChunkPolicy.ts
      errors/
        RuntimeErrors.ts

  audio-runtime/
    src/
      input/
        AudioInput.ts
      playback/
        PlaybackController.ts
      vad/
        VadEngine.ts
      codecs/
        Pcm.ts

  stt-runtime/
    src/
      contracts/
        SttProvider.ts
      providers/
        WhisperStreamingProvider.ts
      streaming/
        SttStreamSession.ts

  tts-runtime/
    src/
      contracts/
        TtsProvider.ts
      providers/
        MicrosoftTtsProvider.ts
      streaming/
        TtsStreamSession.ts

  backend-openclaw/
    src/
      adapter/
        OpenClawBackendAdapter.ts
      client/
        OpenClawClient.ts
      session/
        OpenClawSessionContext.ts

  response-composer/
    src/
      chunking/
        SpeakableChunker.ts
      normalization/
        TextNormalizer.ts
      policies/
        ChunkFlushPolicy.ts

  telemetry-runtime/
    src/
      metrics/
        MetricsRecorder.ts
      tracing/
        SpanTracker.ts
      logging/
        RuntimeLogger.ts

  config-runtime/
    src/
      schema/
        RuntimeConfig.ts
      loader/
        loadRuntimeConfig.ts
      defaults/
        defaults.ts

  app-headless/
    src/
      bootstrap/
        createRuntime.ts
      wiring/
        wireRuntime.ts
      main.ts

  app-debug-ui/
    src/
      server/
      client/
```

---

## Contratos TypeScript iniciales

### Estado

```ts
export type ConversationState =
  | "IDLE"
  | "LISTENING"
  | "USER_SPEAKING"
  | "TRANSCRIBING"
  | "THINKING"
  | "ASSISTANT_SPEAKING"
  | "INTERRUPTED"
  | "ERROR";
```

### Audio

```ts
export interface AudioFrame {
  ts: number;
  pcm: Buffer;
  sampleRate: number;
  channels: number;
}

export interface AudioInput {
  start(): Promise<void>;
  stop(): Promise<void>;
  onFrame(cb: (frame: AudioFrame) => void): void;
}
```

### Sesión y turno

```ts
export interface SessionContext {
  sessionId: string;
  startedAt: number;
  lastActivityAt: number;
  turns: TurnContext[];
  metadata?: Record<string, string>;
}

export interface TurnContext {
  turnId: string;
  sessionId: string;
  startedAt: number;
  endedAt?: number;
  transcriptPartial?: string;
  transcriptFinal?: string;
  interrupted?: boolean;
}
```

### VAD

```ts
export interface VadEngine {
  pushFrame(frame: AudioFrame): void;
  reset(): void;
}
```

### STT

```ts
export interface SttProvider {
  startTurn(input: {
    turnId: string;
    sessionId: string;
    language?: string;
  }): Promise<void>;
  pushAudio(turnId: string, frame: AudioFrame): Promise<void>;
  stopTurn(turnId: string): Promise<void>;
  cancelTurn(turnId: string): Promise<void>;
}
```

### Backend

```ts
export interface BackendRequest {
  sessionId: string;
  turnId: string;
  text: string;
}

export interface BackendAdapter {
  sendUserTurn(req: BackendRequest): Promise<void>;
  cancelResponse(sessionId: string, turnId: string): Promise<void>;
}
```

### Response Composer

```ts
export interface SpeakableChunk {
  turnId: string;
  chunkId: string;
  text: string;
  isFinal?: boolean;
}

export interface ResponseComposer {
  pushToken(turnId: string, token: string): SpeakableChunk[];
  flush(turnId: string): SpeakableChunk[];
  reset(turnId: string): void;
}
```

### TTS

```ts
export interface TtsAudioChunk {
  turnId: string;
  chunkId: string;
  audio: Buffer;
  format: "pcm" | "mp3" | "opus";
  sampleRate?: number;
}

export interface TtsProvider {
  speak(chunk: SpeakableChunk): Promise<void>;
  cancel(turnId: string): Promise<void>;
}
```

### Playback

```ts
export interface PlaybackController {
  play(chunk: TtsAudioChunk): Promise<void>;
  stop(reason: "interrupt" | "cancel" | "error" | "completed"): Promise<void>;
  flush(): Promise<void>;
}
```

### Orchestrator

```ts
export interface ConversationOrchestrator {
  startSession(sessionId?: string): Promise<string>;
  stopSession(sessionId: string): Promise<void>;
  handleEvent(event: RuntimeEvent): Promise<void>;
  getState(): ConversationState;
}
```

---

## Eventos internos mínimos

```ts
export type RuntimeEvent =
  | { type: "speech.started"; ts: number }
  | { type: "speech.ended"; ts: number; silenceMs: number }
  | { type: "speech.interrupted"; ts: number }
  | { type: "stt.partial"; turnId: string; text: string; ts: number }
  | { type: "stt.final"; turnId: string; text: string; ts: number; language?: string }
  | { type: "backend.token"; turnId: string; token: string; ts: number }
  | { type: "backend.completed"; turnId: string; text: string; ts: number }
  | { type: "tts.audio.chunk"; turnId: string; chunkId: string; ts: number }
  | { type: "playback.started"; turnId: string; ts: number }
  | { type: "playback.stopped"; turnId: string; ts: number; reason: string }
  | { type: "state.changed"; state: ConversationState; ts: number }
  | { type: "runtime.error"; ts: number; error: string };
```

---

## Flujo end to end

1. `AudioInput` emite frames PCM
2. `VadEngine` detecta inicio de habla
3. `ConversationOrchestrator` abre `turnId`
4. `SttProvider` recibe audio y emite parciales
5. `VadEngine` detecta fin de turno
6. `SttProvider` emite transcript final
7. `BackendAdapter` envía el turno a OpenClaw
8. El backend devuelve tokens en streaming
9. `ResponseComposer` agrupa en chunks hablables
10. `TtsProvider` sintetiza chunks
11. `PlaybackController` reproduce
12. Si entra `speech.interrupted`, el orquestador cancela backend, TTS y playback

---

## Bootstrap headless inicial

```ts
const bus = new InMemoryEventBus();
const config = loadRuntimeConfig();

const audioInput = createAudioInput(config);
const vad = createVadEngine(config, bus);
const stt = createSttProvider(config, bus);
const backend = createOpenClawAdapter(config, bus);
const composer = createResponseComposer(config);
const tts = createTtsProvider(config, bus);
const playback = createPlaybackController(config, bus);

const orchestrator = createConversationOrchestrator({
  bus,
  config,
  stt,
  backend,
  composer,
  tts,
  playback
});
```

---

## Orden de implementación recomendado

### Hito 1
- Event bus tipado
- state machine
- orchestrator mínimo
- logging básico

### Hito 2
- audio input
- VAD
- apertura y cierre de turnos

### Hito 3
- STT streaming
- parciales y final
- cancelación de turno

### Hito 4
- adapter a OpenClaw
- streaming de respuesta
- contexto corto de sesión

### Hito 5
- response composer
- TTS streaming
- playback interruptible

### Hito 6
- métricas y panel de depuración mínimo

---

## Métricas mínimas

- tiempo hasta cierre de turno
- latencia STT parcial
- latencia STT final
- tiempo hasta primer token backend
- tiempo hasta primer audio TTS
- número de interrupciones
- falsos cortes
- duración total de respuesta

---

## Qué queda explícitamente fuera de nivel 1

- Discord como base arquitectónica
- lógica de clases de inglés
- feedback pedagógico
- perfiles docentes
- progreso del alumno
- UI de producto final

---

## Garantías para el futuro nivel 2

El nivel 2 debe reutilizar:
- orchestrator
- audio input
- VAD
- STT
- TTS
- playback
- session manager
- métricas

El nivel 2 solo añadirá:
- skill de inglés
- reglas pedagógicas
- subagentes
- perfiles de voz o acento
- UX específica si hace falta

Resumen corto:
- nivel 1 ejecuta
- nivel 2 decide

---

## Verificación final

- El nivel 1 no depende de Discord ni de canales externos
- El nivel 1 no contiene lógica de clases de inglés
- El nivel 2 reutiliza el nivel 1 y no lo duplica
- La arquitectura permite modo headless y cliente mínimo
- El core queda separado de skills futuras
- El diseño favorece voz en tiempo real con streaming e interrupciones
