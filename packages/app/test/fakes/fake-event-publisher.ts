import type { AisfEventMap } from '../../src/shared/bus/aisf-event-map.js';
import type { EventPublisher } from '../../src/shared/bus/event-publisher.js';

export class FakeEventPublisher implements EventPublisher {
  readonly emittedEvents: Array<{ readonly name: keyof AisfEventMap; readonly payload: unknown }> =
    [];

  emit<Name extends keyof AisfEventMap>(name: Name, payload: AisfEventMap[Name]): void {
    this.emittedEvents.push({ name, payload });
  }
}
