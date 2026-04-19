import type { BackendPort, PlaybackPort, ResponseComposerPort, SttPort, TtsPort } from "../contracts/Ports.js";
import type { ConversationState, RuntimeConfig, RuntimeEvent, TurnContext } from "../contracts/Runtime.js";
import type { EventBus } from "../events/EventBus.js";
import { TurnPolicy } from "../policies/TurnPolicy.js";
import { SessionManager } from "../session/SessionManager.js";

export interface ConversationOrchestrator {
  startSession(sessionId?: string): Promise<string>;
  stopSession(sessionId: string): Promise<void>;
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

  getState(): ConversationState {
    return this.state;
  }

  async handleEvent(event: RuntimeEvent): Promise<void> {
    switch (event.type) {
      case "speech.started": {
        if (!this.activeSessionId) return;
        this.activeTurnId = crypto.randomUUID();
        const turn: TurnContext = {
          turnId: this.activeTurnId,
          sessionId: this.activeSessionId,
          startedAt: event.ts
        };
        this.sessions.addTurn(this.activeSessionId, turn);
        await this.deps.stt?.startTurn({
          turnId: this.activeTurnId,
          sessionId: this.activeSessionId
        });
        await this.transition("USER_SPEAKING");
        break;
      }
      case "stt.partial": {
        if (!this.activeSessionId) return;
        this.sessions.updateTurn(this.activeSessionId, this.resolveTurnId(event.turnId), {
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
        if (this.state === "ASSISTANT_SPEAKING" && this.turnPolicy.shouldInterrupt(undefined, event.ts)) {
          await this.transition("INTERRUPTED");
          if (this.activeSessionId && this.activeTurnId) {
            await this.deps.backend?.cancelResponse(this.activeSessionId, this.activeTurnId);
            await this.deps.tts?.cancel(this.activeTurnId);
          }
          await this.deps.playback?.stop("interrupt");
        }
        break;
      }
      case "backend.completed": {
        if (this.deps.composer && this.deps.tts) {
          for (const chunk of this.deps.composer.flush(event.turnId)) {
            await this.deps.tts.speak(chunk);
          }
        }
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
}
