import type { EventSubscriber } from '../../../../shared/event-bus.js';
import type { RepositoryWatchService } from '../../business/service/repository-watch-service.js';

export function subscribeToTicketStatusWritten(
  subscriber: EventSubscriber,
  repositoryWatchService: Pick<RepositoryWatchService, 'recordStatusWriteAndPoll'>,
): () => void {
  return subscriber.on(
    'ticket.status-written',
    ({ projectId, ticketNumber, from, to, waiting, stuck }) => {
      void repositoryWatchService.recordStatusWriteAndPoll(projectId, {
        ticketNumber,
        from,
        to,
        waiting,
        stuck,
      });
    },
  );
}
