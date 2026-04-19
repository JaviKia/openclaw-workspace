import type { RuntimeConfig, SessionContext, TurnContext } from "../contracts/Runtime.js";

export class SessionManager {
  private sessions = new Map<string, SessionContext>();

  constructor(private readonly config: RuntimeConfig) {}

  startSession(sessionId: string): SessionContext {
    const now = Date.now();
    const session: SessionContext = {
      sessionId,
      startedAt: now,
      lastActivityAt: now,
      turns: []
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string): SessionContext | undefined {
    return this.sessions.get(sessionId);
  }

  ensureSession(sessionId: string): SessionContext {
    return this.getSession(sessionId) ?? this.startSession(sessionId);
  }

  addTurn(sessionId: string, turn: TurnContext): void {
    const session = this.ensureSession(sessionId);
    session.turns.push(turn);
    if (session.turns.length > this.config.session.maxTurns) {
      session.turns = session.turns.slice(-this.config.session.maxTurns);
    }
    session.lastActivityAt = Date.now();
  }

  updateTurn(sessionId: string, turnId: string, patch: Partial<TurnContext>): void {
    const session = this.ensureSession(sessionId);
    const turn = session.turns.find((entry) => entry.turnId === turnId);
    if (!turn) return;
    Object.assign(turn, patch);
    session.lastActivityAt = Date.now();
  }
}
