declare module "/data/.npm-global/lib/node_modules/openclaw/dist/speech-provider-cOElwswQ.js" {
  export function t(): {
    synthesize(input: {
      text: string;
      providerConfig: {
        voice: string;
        outputFormat: string;
        enabled: boolean;
      };
      providerOverrides: Record<string, unknown>;
      timeoutMs: number;
    }): Promise<{ audioBuffer: Buffer }>;
  };
}
