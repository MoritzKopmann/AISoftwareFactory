import type { DomainEvents, EventPublisher } from '../event-bus.js';

export class FakeEventPublisher implements EventPublisher {
  readonly emittedEvents: Array<{ readonly name: keyof DomainEvents; readonly payload: unknown }> =
    [];

  emit<Name extends keyof DomainEvents>(name: Name, payload: DomainEvents[Name]): void {
    this.emittedEvents.push({ name, payload });
  }
}
