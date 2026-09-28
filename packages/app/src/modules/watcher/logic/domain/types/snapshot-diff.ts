export type SnapshotDiff = {
  readonly addedTicketNumbers: ReadonlyArray<number>;
  readonly changedTicketNumbers: ReadonlyArray<number>;
  readonly removedTicketNumbers: ReadonlyArray<number>;
};
