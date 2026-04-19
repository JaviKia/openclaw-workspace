export interface TurnPolicyConfig {
  endSilenceMs: number;
  interruptDebounceMs: number;
}

export class TurnPolicy {
  constructor(private readonly config: TurnPolicyConfig) {}

  shouldCloseTurn(lastSpeechAt: number, now: number): boolean {
    return now - lastSpeechAt >= this.config.endSilenceMs;
  }

  shouldInterrupt(lastInterruptAt: number | undefined, now: number): boolean {
    if (!lastInterruptAt) return true;
    return now - lastInterruptAt >= this.config.interruptDebounceMs;
  }
}
