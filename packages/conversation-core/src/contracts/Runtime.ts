export type ConversationState =
  | "IDLE"
  | "LISTENING"
  | "USER_SPEAKING"
  | "TRANSCRIBING"
  | "THINKING"
  | "ASSISTANT_SPEAKING"
  | "INTERRUPTED"
  | "ERROR";

export interface AudioFrame {
  ts: number;
  pcm: Buffer;
  sampleRate: number;
  channels: number;
}

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

export interface SpeakableChunk {
  turnId: string;
  chunkId: string;
  text: string;
  isFinal?: boolean;
}

export interface TtsAudioChunk {
  turnId: string;
  chunkId: string;
  audio: Buffer;
  format: "pcm" | "mp3" | "opus";
  sampleRate?: number;
}

export type RuntimeEvent =
  | { type: "speech.started"; ts: number; language?: string }
  | { type: "speech.ended"; ts: number; silenceMs: number }
  | { type: "speech.interrupted"; ts: number }
  | { type: "stt.partial"; turnId: string; text: string; ts: number }
  | { type: "stt.final"; turnId: string; text: string; ts: number; language?: string }
  | { type: "backend.token"; turnId: string; token: string; ts: number }
  | { type: "backend.completed"; turnId: string; text: string; ts: number }
  | { type: "tts.audio.chunk"; turnId: string; chunkId: string; ts: number; chunk: TtsAudioChunk }
  | { type: "playback.started"; turnId: string; ts: number }
  | { type: "playback.stopped"; turnId: string; ts: number; reason: string }
  | { type: "state.changed"; state: ConversationState; ts: number }
  | { type: "runtime.error"; ts: number; error: string };

export interface RuntimeConfig {
  session: {
    maxTurns: number;
    maxContextChars: number;
  };
  turnPolicy?: {
    endSilenceMs: number;
    interruptDebounceMs: number;
  };
}
