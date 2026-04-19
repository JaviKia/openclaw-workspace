import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface PulseAudioDiagnostics {
  availableSources: string[];
  defaultSource?: string;
  preferredSource?: string;
  hasRealInput: boolean;
  onlyMonitorSources: boolean;
}

export async function getPulseAudioDiagnostics(pactlPath = "pactl"): Promise<PulseAudioDiagnostics> {
  const availableSources = await listPulseSources(pactlPath);
  const defaultSource = await getDefaultPulseSource(pactlPath);
  const preferredSource = selectPreferredPulseSource(availableSources, defaultSource);
  const hasRealInput = availableSources.some((source) => !source.endsWith(".monitor"));
  const onlyMonitorSources = availableSources.length > 0 && availableSources.every((source) => source.endsWith(".monitor"));

  return {
    availableSources,
    defaultSource,
    preferredSource,
    hasRealInput,
    onlyMonitorSources
  };
}

export function selectPreferredPulseSource(sources: string[], defaultSource?: string): string | undefined {
  const preferredInput = sources.find((source) => !source.endsWith(".monitor"));
  if (preferredInput) return preferredInput;
  if (defaultSource && sources.includes(defaultSource)) return defaultSource;
  return sources[0];
}

async function listPulseSources(pactlPath: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync(pactlPath, ["list", "short", "sources"], {
      timeout: 5000,
      maxBuffer: 1024 * 1024
    });
    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split(/\s+/)[1])
      .filter((value): value is string => Boolean(value));
  } catch {
    return [];
  }
}

async function getDefaultPulseSource(pactlPath: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync(pactlPath, ["info"], {
      timeout: 5000,
      maxBuffer: 1024 * 1024
    });
    const line = stdout
      .split(/\r?\n/)
      .find((entry) => entry.startsWith("Default Source:"));
    return line?.split(":")[1]?.trim();
  } catch {
    return undefined;
  }
}
