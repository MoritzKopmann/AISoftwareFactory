export interface TicketAnswerGate {
  begin(projectId: string, ticketNumber: number): Promise<void>;
  revert(projectId: string, ticketNumber: number): Promise<void>;
}
