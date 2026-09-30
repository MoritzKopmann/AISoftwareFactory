export interface ActiveRunLookup {
  activeRunTicketNumber(projectId: string): Promise<number | undefined>;
}
