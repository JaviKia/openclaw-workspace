import type { BackendPort } from "@kelex/conversation-core";
import { OpenClawGatewayCliClient } from "../client/OpenClawGatewayCliClient.js";

export interface OpenClawSessionEntry {
  key: string;
  sessionId?: string;
  displayName?: string;
  status?: string;
}

export interface SessionsListResponse {
  sessions?: OpenClawSessionEntry[];
}

export interface SessionsSendResponse {
  ok?: boolean;
  runId?: string;
  messageSeq?: number;
  interruptedActiveRun?: boolean;
}

export interface OpenClawBackendAdapterOptions {
  sessionKey?: string;
  binaryPath?: string;
  token?: string;
  url?: string;
  timeoutMs?: number;
}

export class OpenClawBackendAdapter implements BackendPort {
  private readonly client: OpenClawGatewayCliClient;
  private readonly sessionKey: string;
  private readonly timeoutMs: number;

  constructor(options: OpenClawBackendAdapterOptions = {}) {
    this.client = new OpenClawGatewayCliClient({
      binaryPath: options.binaryPath,
      token: options.token,
      url: options.url
    });
    this.sessionKey = options.sessionKey ?? "agent:main:main";
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  async listSessions(limit = 20): Promise<OpenClawSessionEntry[]> {
    const result = await this.client.call<SessionsListResponse>("sessions.list", { limit }, { timeoutMs: this.timeoutMs });
    return Array.isArray(result.sessions) ? result.sessions : [];
  }

  async sendUserTurn(req: { sessionId: string; turnId: string; text: string }): Promise<void> {
    const payload = {
      key: this.sessionKey,
      message: req.text,
      timeoutMs: this.timeoutMs,
      idempotencyKey: `${req.sessionId}:${req.turnId}`
    };
    await this.client.call<SessionsSendResponse>("sessions.send", payload, { timeoutMs: this.timeoutMs });
  }

  async cancelResponse(_sessionId: string, _turnId: string): Promise<void> {
    await this.client.call("sessions.abort", { key: this.sessionKey }, { timeoutMs: this.timeoutMs });
  }
}
