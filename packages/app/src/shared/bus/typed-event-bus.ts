type EventHandler<Payload> = (payload: Payload) => void;

export class TypedEventBus<Events extends object> {
  private readonly handlersByEvent = new Map<keyof Events, Set<EventHandler<never>>>();

  on<Name extends keyof Events>(name: Name, handler: EventHandler<Events[Name]>): () => void {
    const handlers = this.handlersByEvent.get(name) ?? new Set();
    handlers.add(handler);
    this.handlersByEvent.set(name, handlers);

    return () => {
      handlers.delete(handler);
    };
  }

  emit<Name extends keyof Events>(name: Name, payload: Events[Name]): void {
    // Iterate a copy so a handler that subscribes or unsubscribes doesn't change this emit.
    for (const handler of [...(this.handlersByEvent.get(name) ?? [])]) {
      (handler as EventHandler<Events[Name]>)(payload);
    }
  }
}
