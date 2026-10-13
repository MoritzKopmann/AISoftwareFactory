// Typed, in-process event bus used for *asynchronous* inter-module communication.
// The event map is the contract: modules agree on event names + payloads, not on each other's classes.

export interface DomainEvents {
  "order.placed": { orderId: string; userId: string; total: number };
  "user.registered": { userId: string; email: string };
}

export type Handler<K extends keyof DomainEvents> = (payload: DomainEvents[K]) => void | Promise<void>;

export interface EventBus {
  publish<K extends keyof DomainEvents>(event: K, payload: DomainEvents[K]): Promise<void>;
  subscribe<K extends keyof DomainEvents>(event: K, handler: Handler<K>): void;
}
