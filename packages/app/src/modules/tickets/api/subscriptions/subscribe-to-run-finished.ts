import type { EventSubscriber } from '../../../../shared/event-bus.js';

export function subscribeToRunFinished(
  subscriber: EventSubscriber,
  onRunFinished: (projectId: string) => void,
): () => void {
  return subscriber.on('run.finished', ({ projectId }) => {
    onRunFinished(projectId);
  });
}
