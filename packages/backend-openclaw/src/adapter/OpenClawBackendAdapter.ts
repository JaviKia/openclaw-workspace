import { access, readFile } from "node:fs/promises";
import type { BackendPort, EventBus } from "@kelex/conversation-core";
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
  status?: string;
}

export interface OpenClawBackendAdapterOptions {
  bus?: EventBus;
  sessionKey?: string;
  binaryPath?: string;
  token?: string;
  url?: string;
  timeoutMs?: number;
  transcriptWaitMs?: number;
}

interface TranscriptMessageLine {
  type?: string;
  timestamp?: string;
  message?: {
    role?: string;
    content?: Array<
      | { type?: string; text?: string }
      | { type?: string; content?: string }
      | Record<string, unknown>
    >;
  };
}

export class OpenClawBackendAdapter implements BackendPort {
  private readonly client: OpenClawGatewayCliClient;
  private readonly bus?: EventBus;
  private readonly sessionKey: string;
  private readonly timeoutMs: number;
  private readonly transcriptWaitMs: number;

  constructor(options: OpenClawBackendAdapterOptions = {}) {
    this.client = new OpenClawGatewayCliClient({
      binaryPath: options.binaryPath,
      token: options.token,
      url: options.url
    });
    this.bus = options.bus;
    this.sessionKey = options.sessionKey ?? "agent:main:main";
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.transcriptWaitMs = options.transcriptWaitMs ?? 30_000;
  }

  async listSessions(limit = 20): Promise<OpenClawSessionEntry[]> {
    const result = await this.client.call<SessionsListResponse>("sessions.list", { limit }, { timeoutMs: this.timeoutMs });
    return Array.isArray(result.sessions) ? result.sessions : [];
  }

  async sendUserTurn(req: { sessionId: string; turnId: string; text: string }): Promise<void> {
    const transcriptPath = await this.resolveTranscriptPath();
    const beforeTimestamps = transcriptPath ? await this.captureKnownAssistantTimestamps(transcriptPath) : new Set<string>();
    const payload = {
      key: this.sessionKey,
      message: req.text,
      timeoutMs: this.timeoutMs,
      idempotencyKey: `${req.sessionId}:${req.turnId}`
    };
    const response = await this.client.call<SessionsSendResponse>("sessions.send", payload, { timeoutMs: this.timeoutMs });

    const assistantText = transcriptPath
      ? await this.waitForAssistantText({
          transcriptPath,
          beforeTimestamps,
          startedAt: Date.now(),
          timeoutMs: Math.max(this.transcriptWaitMs, this.timeoutMs),
          runId: response.runId
        })
      : undefined;

    if (!assistantText) {
      return;
    }

    await this.bus?.publish({
      type: "backend.token",
      turnId: req.turnId,
      token: assistantText,
      ts: Date.now()
    });
    await this.bus?.publish({
      type: "backend.completed",
      turnId: req.turnId,
      text: assistantText,
      ts: Date.now()
    });
  }

  async cancelResponse(_sessionId: string, _turnId: string): Promise<void> {
    await this.client.call("sessions.abort", { key: this.sessionKey }, { timeoutMs: this.timeoutMs });
  }

  private async resolveTranscriptPath(): Promise<string | undefined> {
    const sessions = await this.listSessions(200);
    const entry = sessions.find((session) => session.key === this.sessionKey);
    if (!entry?.sessionId) {
      return undefined;
    }
    return `/data/.openclaw/agents/main/sessions/${entry.sessionId}.jsonl`;
  }

  private async captureKnownAssistantTimestamps(transcriptPath: string): Promise<Set<string>> {
    const seen = new Set<string>();
    try {
      const lines = await this.readTranscriptLines(transcriptPath);
      for (const line of lines) {
        const parsed = this.parseTranscriptLine(line);
        if (parsed?.message?.role !== "assistant" || !parsed.timestamp) continue;
        seen.add(parsed.timestamp);
      }
    } catch {
      return seen;
    }
    return seen;
  }

  private async waitForAssistantText(params: {
    transcriptPath: string;
    beforeTimestamps: Set<string>;
    startedAt: number;
    timeoutMs: number;
    runId?: string;
  }): Promise<string | undefined> {
    const deadline = params.startedAt + params.timeoutMs;
    while (Date.now() < deadline) {
      const text = await this.findNewAssistantText(params.transcriptPath, params.beforeTimestamps);
      if (text) {
        return text;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return undefined;
  }

  private async findNewAssistantText(transcriptPath: string, beforeTimestamps: Set<string>): Promise<string | undefined> {
    try {
      await access(transcriptPath);
      const lines = await this.readTranscriptLines(transcriptPath);
      for (let index = lines.length - 1; index >= 0; index -= 1) {
        const parsed = this.parseTranscriptLine(lines[index]);
        if (!parsed?.timestamp || beforeTimestamps.has(parsed.timestamp)) {
          continue;
        }
        if (parsed.message?.role !== "assistant") {
          continue;
        }
        const text = this.extractAssistantText(parsed);
        if (text) {
          return text;
        }
      }
    } catch {
      return undefined;
    }
    return undefined;
  }

  private async readTranscriptLines(transcriptPath: string): Promise<string[]> {
    const raw = await readFile(transcriptPath, "utf8");
    return raw.split("\n").filter(Boolean);
  }

  private parseTranscriptLine(line: string): TranscriptMessageLine | undefined {
    try {
      return JSON.parse(line) as TranscriptMessageLine;
    } catch {
      return undefined;
    }
  }

  private extractAssistantText(line: TranscriptMessageLine): string | undefined {
    const content = Array.isArray(line.message?.content) ? line.message?.content : [];
    const parts: string[] = [];

    for (const item of content) {
      if (!item || typeof item !== "object" || item.type !== "text") {
        continue;
      }
      const text = "text" in item && typeof item.text === "string" ? item.text.trim() : undefined;
      if (text) {
        parts.push(text);
      }
    }

    if (parts.length === 0) {
      return undefined;
    }
    return parts.join(" ").trim();
  }
}
