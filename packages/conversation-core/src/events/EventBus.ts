import type { RuntimeEvent } from "../contracts/Runtime.js";

export type RuntimeEventHandler = (event: RuntimeEvent) => void | Promise<void>;

export interface EventBus {
  publish(event: RuntimeEvent): Promise<void>;
  subscribe(handler: RuntimeEventHandler): () => void;
}

export class InMemoryEventBus implements EventBus {
  private handlers = new Set<RuntimeEventHandler>();

  async publish(event: RuntimeEvent): Promise<void> {
    for (const handler of this.handlers) {
      await handler(event);
    }
  }

  subscribe(handler: RuntimeEventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }
}
