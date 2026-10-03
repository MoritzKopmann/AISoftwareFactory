export interface ActiveRunLookup {
  activeRunTicketNumbers(projectId: string): Promise<ReadonlyArray<number>>;
}
