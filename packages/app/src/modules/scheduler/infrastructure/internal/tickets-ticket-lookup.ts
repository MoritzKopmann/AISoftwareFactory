import type { TicketsApi } from '../../../tickets/index.js';
import type { SchedulableTicket } from '../../business/domain/types/schedulable-ticket.js';
import type { TicketLookup } from '../../business/port/ticket/ticket-lookup.js';

export class TicketsTicketLookup implements TicketLookup {
  constructor(private readonly tickets: Pick<TicketsApi, 'ticket'>) {}

  async find(projectId: string, ticketNumber: number): Promise<SchedulableTicket | undefined> {
    const projectTicket = await this.tickets.ticket(projectId, ticketNumber);
    const ticket = projectTicket?.ticket;
    if (projectTicket === undefined || ticket === undefined) {
      return undefined;
    }
    const snapshotTakenAt =
      projectTicket.sync.state === 'pending' ? undefined : projectTicket.sync.snapshotTakenAt;
    return {
      number: ticket.number,
      title: ticket.title,
      status: ticket.status,
      types: ticket.types,
      isLeaf: ticket.subIssueNumbers.length === 0,
      hasOpenBlocker: ticket.blockedBy.some((blocker) => blocker.open),
      subIssueNumbers: ticket.subIssueNumbers,
      ...(snapshotTakenAt === undefined ? {} : { snapshotTakenAt }),
    };
  }
}
