import type {
  AudioFrame,
  BackendPort,
  PlaybackPort,
  ResponseComposerPort,
  SpeakableChunk,
  SttPort,
  TtsAudioChunk,
  TtsPort
} from "@kelex/conversation-core";

export class StubSttPort implements SttPort {
  async startTurn(_input: { turnId: string; sessionId: string; language?: string }): Promise<void> {}
  async pushAudio(_turnId: string, _frame: AudioFrame): Promise<void> {}
  async stopTurn(_turnId: string): Promise<void> {}
  async cancelTurn(_turnId: string): Promise<void> {}
}

export class StubBackendPort implements BackendPort {
  async sendUserTurn(req: { sessionId: string; turnId: string; text: string }): Promise<void> {
    console.log("[stub-backend] sendUserTurn", req);
  }

  async cancelResponse(sessionId: string, turnId: string): Promise<void> {
    console.log("[stub-backend] cancelResponse", { sessionId, turnId });
  }
}

export class StubResponseComposer implements ResponseComposerPort {
  private buffers = new Map<string, string[]>();

  pushToken(turnId: string, token: string): SpeakableChunk[] {
    const buffer = this.buffers.get(turnId) ?? [];
    buffer.push(token);
    this.buffers.set(turnId, buffer);
    if (buffer.join("").length < 20 && !/[.!?]$/.test(token)) {
      return [];
    }
    return this.flush(turnId);
  }

  flush(turnId: string): SpeakableChunk[] {
    const buffer = this.buffers.get(turnId) ?? [];
    if (buffer.length === 0) return [];
    this.buffers.delete(turnId);
    return [
      {
        turnId,
        chunkId: crypto.randomUUID(),
        text: buffer.join("").trim(),
        isFinal: true
      }
    ];
  }

  reset(turnId: string): void {
    this.buffers.delete(turnId);
  }
}

export class StubTtsPort implements TtsPort {
  async speak(chunk: SpeakableChunk): Promise<void> {
    console.log("[stub-tts] speak", chunk);
  }

  async cancel(turnId: string): Promise<void> {
    console.log("[stub-tts] cancel", { turnId });
  }
}

export class StubPlaybackPort implements PlaybackPort {
  async play(chunk: TtsAudioChunk): Promise<void> {
    console.log("[stub-playback] play", chunk.turnId, chunk.chunkId);
  }

  async stop(reason: "interrupt" | "cancel" | "error" | "completed"): Promise<void> {
    console.log("[stub-playback] stop", { reason });
  }

  async flush(): Promise<void> {
    console.log("[stub-playback] flush");
  }
}
