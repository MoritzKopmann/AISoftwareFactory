// Implementation of the EventBus port. Only composition-root.ts instantiates it.
import type { DomainEvents, EventBus, Handler } from "./event-bus.js";

export class InMemoryEventBus implements EventBus {
  private handlers = new Map<keyof DomainEvents, Handler<any>[]>();

  subscribe<K extends keyof DomainEvents>(event: K, handler: Handler<K>): void {
    const list = this.handlers.get(event) ?? [];
    list.push(handler);
    this.handlers.set(event, list);
  }

  async publish<K extends keyof DomainEvents>(event: K, payload: DomainEvents[K]): Promise<void> {
    const list = this.handlers.get(event) ?? [];
    // A failing subscriber must not break the publisher's use case.
    const results = await Promise.allSettled(list.map((h) => h(payload)));
    for (const r of results) if (r.status === "rejected") console.error(`[bus] ${event} handler failed:`, r.reason);
  }
}
