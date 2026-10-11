import type { EventSubscriber } from '../../../../shared/bus/event-subscriber.js';
import type { StatusWrite } from '../../logic/domain/types/status-write.js';

export function subscribeToTicketStatusWritten(
  subscriber: EventSubscriber,
  recordStatusWrite: (projectId: string, write: Omit<StatusWrite, 'writtenAt'>) => void,
): () => void {
  return subscriber.on('ticket.status-written', ({ projectId, ticketNumber, from, to }) => {
    recordStatusWrite(projectId, { ticketNumber, from, to });
  });
}
