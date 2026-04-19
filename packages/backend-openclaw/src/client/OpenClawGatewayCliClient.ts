import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface GatewayCallOptions {
  timeoutMs?: number;
}

export interface OpenClawGatewayCliClientOptions {
  binaryPath?: string;
  token?: string;
  url?: string;
}

export class OpenClawGatewayCliClient {
  private readonly binaryPath: string;
  private readonly token?: string;
  private readonly url?: string;

  constructor(options: OpenClawGatewayCliClientOptions = {}) {
    this.binaryPath = options.binaryPath ?? "/data/.npm-global/bin/openclaw";
    this.token = options.token;
    this.url = options.url;
  }

  async call<T>(method: string, params: Record<string, unknown>, options: GatewayCallOptions = {}): Promise<T> {
    const args = ["gateway", "call", method, "--json", "--params", JSON.stringify(params)];
    if (typeof options.timeoutMs === "number") {
      args.push("--timeout", String(options.timeoutMs));
    }
    if (this.token) {
      args.push("--token", this.token);
    }
    if (this.url) {
      args.push("--url", this.url);
    }
    const { stdout } = await execFileAsync(this.binaryPath, args, {
      maxBuffer: 1024 * 1024 * 10
    });
    return JSON.parse(stdout) as T;
  }
}
