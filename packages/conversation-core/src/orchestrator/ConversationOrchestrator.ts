import type { BackendPort, PlaybackPort, ResponseComposerPort, SttPort, TtsPort } from "../contracts/Ports.js";
import type { AudioFrame, ConversationState, RuntimeConfig, RuntimeEvent, TurnContext } from "../contracts/Runtime.js";
import type { EventBus } from "../events/EventBus.js";
import { TurnPolicy } from "../policies/TurnPolicy.js";
import { SessionManager } from "../session/SessionManager.js";

export interface ConversationOrchestrator {
  startSession(sessionId?: string): Promise<string>;
  stopSession(sessionId: string): Promise<void>;
  handleAudioFrame(frame: AudioFrame): Promise<void>;
  handleEvent(event: RuntimeEvent): Promise<void>;
  getState(): ConversationState;
}

export interface BasicConversationOrchestratorDeps {
  bus: EventBus;
  config: RuntimeConfig;
  stt?: SttPort;
  backend?: BackendPort;
  composer?: ResponseComposerPort;
  tts?: TtsPort;
  playback?: PlaybackPort;
}

export class BasicConversationOrchestrator implements ConversationOrchestrator {
  private state: ConversationState = "IDLE";
  private activeSessionId?: string;
  private activeTurnId?: string;
  private lastInterruptAt?: number;
  private readonly preRollFrames: AudioFrame[] = [];
  private readonly preRollFrameLimit = 5;
  private readonly sessions: SessionManager;
  private readonly turnPolicy: TurnPolicy;

  constructor(private readonly deps: BasicConversationOrchestratorDeps) {
    this.sessions = new SessionManager(deps.config);
    this.turnPolicy = new TurnPolicy(
      deps.config.turnPolicy ?? { endSilenceMs: 800, interruptDebounceMs: 250 }
    );
  }

  async startSession(sessionId = crypto.randomUUID()): Promise<string> {
    this.sessions.ensureSession(sessionId);
    this.activeSessionId = sessionId;
    await this.transition("LISTENING");
    return sessionId;
  }

  async stopSession(_sessionId: string): Promise<void> {
    this.activeTurnId = undefined;
    await this.transition("IDLE");
  }

  async handleAudioFrame(frame: AudioFrame): Promise<void> {
    this.pushPreRollFrame(frame);
    if (!this.activeTurnId || this.state !== "USER_SPEAKING") return;
    await this.deps.stt?.pushAudio(this.activeTurnId, frame);
  }

  getState(): ConversationState {
    return this.state;
  }

  async handleEvent(event: RuntimeEvent): Promise<void> {
    switch (event.type) {
      case "speech.started": {
        if (!this.activeSessionId) return;
        if (this.state === "ASSISTANT_SPEAKING" || this.state === "THINKING") {
          await this.interruptCurrentTurn(event.ts);
        }
        this.activeTurnId = crypto.randomUUID();
        const turn: TurnContext = {
          turnId: this.activeTurnId,
          sessionId: this.activeSessionId,
          startedAt: event.ts
        };
        this.sessions.addTurn(this.activeSessionId, turn);
        await this.deps.stt?.startTurn({
          turnId: this.activeTurnId,
          sessionId: this.activeSessionId,
          language: event.language
        });
        for (const bufferedFrame of this.preRollFrames) {
          await this.deps.stt?.pushAudio(this.activeTurnId, bufferedFrame);
        }
        this.preRollFrames.length = 0;
        await this.transition("USER_SPEAKING");
        break;
      }
      case "stt.partial": {
        if (!this.activeSessionId) return;
        const turnId = this.resolveTurnId(event.turnId);
        this.activeTurnId = turnId;
        this.sessions.updateTurn(this.activeSessionId, turnId, {
          transcriptPartial: event.text
        });
        break;
      }
      case "speech.ended": {
        if (this.state === "USER_SPEAKING" && this.activeTurnId) {
          await this.transition("TRANSCRIBING");
          await this.deps.stt?.stopTurn(this.activeTurnId);
        }
        break;
      }
      case "stt.final": {
        if (!this.activeSessionId) return;
        const turnId = this.resolveTurnId(event.turnId);
        this.activeTurnId = turnId;
        this.sessions.updateTurn(this.activeSessionId, turnId, {
          transcriptFinal: event.text,
          endedAt: event.ts
        });
        await this.transition("THINKING");
        await this.deps.backend?.sendUserTurn({
          sessionId: this.activeSessionId,
          turnId,
          text: event.text
        });
        break;
      }
      case "backend.token": {
        if (event.turnId !== this.activeTurnId) {
          break;
        }
        if (this.state === "THINKING") {
          await this.transition("ASSISTANT_SPEAKING");
        }
        if (this.deps.composer && this.deps.tts) {
          for (const chunk of this.deps.composer.pushToken(event.turnId, event.token)) {
            await this.deps.tts.speak(chunk);
          }
        }
        break;
      }
      case "speech.interrupted": {
        await this.interruptCurrentTurn(event.ts);
        break;
      }
      case "tts.audio.chunk": {
        if (event.turnId !== this.activeTurnId) {
          break;
        }
        await this.deps.playback?.play(event.chunk);
        break;
      }
      case "backend.completed": {
        if (event.turnId !== this.activeTurnId) {
          break;
        }
        if (this.deps.composer && this.deps.tts) {
          for (const chunk of this.deps.composer.flush(event.turnId)) {
            await this.deps.tts.speak(chunk);
          }
        }
        await this.deps.playback?.flush();
        await this.transition("LISTENING");
        this.activeTurnId = undefined;
        break;
      }
      case "runtime.error": {
        await this.transition("ERROR");
        break;
      }
      default:
        break;
    }
  }

  private resolveTurnId(turnId?: string): string {
    if (turnId) return turnId;
    if (!this.activeTurnId) {
      this.activeTurnId = crypto.randomUUID();
    }
    return this.activeTurnId;
  }

  private async transition(next: ConversationState): Promise<void> {
    this.state = next;
    await this.deps.bus.publish({
      type: "state.changed",
      state: next,
      ts: Date.now()
    });
  }

  private pushPreRollFrame(frame: AudioFrame): void {
    this.preRollFrames.push({
      ...frame,
      pcm: Buffer.from(frame.pcm)
    });
    if (this.preRollFrames.length > this.preRollFrameLimit) {
      this.preRollFrames.shift();
    }
  }

  private async interruptCurrentTurn(ts: number): Promise<void> {
    if (!(this.state === "ASSISTANT_SPEAKING" || this.state === "THINKING" || this.state === "INTERRUPTED")) {
      return;
    }
    if (!this.turnPolicy.shouldInterrupt(this.lastInterruptAt, ts)) {
      return;
    }
    this.lastInterruptAt = ts;
    await this.transition("INTERRUPTED");
    if (this.activeSessionId && this.activeTurnId) {
      await this.deps.backend?.cancelResponse(this.activeSessionId, this.activeTurnId);
      await this.deps.tts?.cancel(this.activeTurnId);
      this.deps.composer?.reset(this.activeTurnId);
    }
    await this.deps.playback?.stop("interrupt");
  }
}
