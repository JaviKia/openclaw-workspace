import type { ConversationState, RuntimeConfig, RuntimeEvent, TurnContext } from "../contracts/Runtime.js";
import type { EventBus } from "../events/EventBus.js";
import { SessionManager } from "../session/SessionManager.js";

export interface ConversationOrchestrator {
  startSession(sessionId?: string): Promise<string>;
  stopSession(sessionId: string): Promise<void>;
  handleEvent(event: RuntimeEvent): Promise<void>;
  getState(): ConversationState;
}

export class BasicConversationOrchestrator implements ConversationOrchestrator {
  private state: ConversationState = "IDLE";
  private activeSessionId?: string;
  private activeTurnId?: string;
  private readonly sessions: SessionManager;

  constructor(
    private readonly bus: EventBus,
    private readonly config: RuntimeConfig
  ) {
    this.sessions = new SessionManager(config);
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
        if (this.state === "USER_SPEAKING") {
          await this.transition("TRANSCRIBING");
        }
        break;
      }
      case "stt.final": {
        if (!this.activeSessionId) return;
        this.sessions.updateTurn(this.activeSessionId, this.resolveTurnId(event.turnId), {
          transcriptFinal: event.text,
          endedAt: event.ts
        });
        await this.transition("THINKING");
        break;
      }
      case "backend.token": {
        if (this.state === "THINKING") {
          await this.transition("ASSISTANT_SPEAKING");
        }
        break;
      }
      case "speech.interrupted": {
        if (this.state === "ASSISTANT_SPEAKING") {
          await this.transition("INTERRUPTED");
        }
        break;
      }
      case "backend.completed": {
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
    await this.bus.publish({
      type: "state.changed",
      state: next,
      ts: Date.now()
    });
  }
}
