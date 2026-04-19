import { access } from "node:fs/promises";
import { constants } from "node:fs";

const SAMPLE_DIR = process.env.OPENCLAW_RUNTIME_SAMPLE_DIR ?? "/data/.openclaw/workspace/fixtures/runtime-audio";
const requiredFiles = [
  `${SAMPLE_DIR}/sample-1-es.mp3`,
  `${SAMPLE_DIR}/sample-2-es.mp3`,
  `${SAMPLE_DIR}/sample-3-es.mp3`,
  `${SAMPLE_DIR}/sample-4-es.mp3`,
  `${SAMPLE_DIR}/sample-5-es.mp3`,
  `${SAMPLE_DIR}/sample-6-es.mp3`,
  `${SAMPLE_DIR}/sample-7-es.mp3`,
  `${SAMPLE_DIR}/sample-8-es.mp3`,
  `${SAMPLE_DIR}/sample-9-es.mp3`,
  `${SAMPLE_DIR}/sample-10-es.mp3`,
];

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  for (const file of requiredFiles) {
    if (!(await exists(file))) {
      throw new Error(`Missing runtime sample: ${file}`);
    }
    console.log(`[samples] ok ${file}`);
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
