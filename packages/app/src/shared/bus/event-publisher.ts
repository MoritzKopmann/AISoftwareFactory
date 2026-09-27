import type { AisfEventMap } from './aisf-event-map.js';

export interface EventPublisher {
  emit<Name extends keyof AisfEventMap>(name: Name, payload: AisfEventMap[Name]): void;
}
