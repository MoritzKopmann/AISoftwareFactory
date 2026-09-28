import type { AisfEventMap } from './aisf-event-map.js';

export interface EventSubscriber {
  on<Name extends keyof AisfEventMap>(
    name: Name,
    handler: (payload: AisfEventMap[Name]) => void,
  ): () => void;
}
