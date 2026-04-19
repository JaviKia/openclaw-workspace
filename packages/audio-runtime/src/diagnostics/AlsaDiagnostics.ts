import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface AlsaDiagnostics {
  hasArecord: boolean;
  availableCaptureDevices: string[];
  hasCaptureDevice: boolean;
}

export async function getAlsaDiagnostics(arecordPath = "arecord"): Promise<AlsaDiagnostics> {
  try {
    const { stdout } = await execFileAsync(arecordPath, ["-l"], {
      timeout: 5000,
      maxBuffer: 1024 * 1024
    });
    const availableCaptureDevices = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith("card "));
    return {
      hasArecord: true,
      availableCaptureDevices,
      hasCaptureDevice: availableCaptureDevices.length > 0
    };
  } catch {
    return {
      hasArecord: false,
      availableCaptureDevices: [],
      hasCaptureDevice: false
    };
  }
}
