import type { EventSubscriber } from '../../../../shared/bus/event-subscriber.js';

export function subscribeToRunFinished(
  subscriber: EventSubscriber,
  onRunFinished: (projectId: string) => void,
): () => void {
  return subscriber.on('run.finished', ({ projectId }) => {
    onRunFinished(projectId);
  });
}
