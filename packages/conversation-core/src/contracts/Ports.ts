import type { AudioFrame, SpeakableChunk, TtsAudioChunk } from "./Runtime.js";

export interface AudioInputPort {
  start(): Promise<void>;
  stop(): Promise<void>;
  onFrame(cb: (frame: AudioFrame) => void): void;
}

export interface VadPort {
  pushFrame(frame: AudioFrame): void;
  reset(): void;
}

export interface SttPort {
  startTurn(input: { turnId: string; sessionId: string; language?: string }): Promise<void>;
  pushAudio(turnId: string, frame: AudioFrame): Promise<void>;
  stopTurn(turnId: string): Promise<void>;
  cancelTurn(turnId: string): Promise<void>;
}

export interface BackendPort {
  sendUserTurn(req: { sessionId: string; turnId: string; text: string }): Promise<void>;
  cancelResponse(sessionId: string, turnId: string): Promise<void>;
}

export interface ResponseComposerPort {
  pushToken(turnId: string, token: string): SpeakableChunk[];
  flush(turnId: string): SpeakableChunk[];
  reset(turnId: string): void;
}

export interface TtsPort {
  speak(chunk: SpeakableChunk): Promise<void>;
  cancel(turnId: string): Promise<void>;
}

export interface PlaybackPort {
  play(chunk: TtsAudioChunk): Promise<void>;
  stop(reason: "interrupt" | "cancel" | "error" | "completed"): Promise<void>;
  flush(): Promise<void>;
}
