export type AisfEventMap = {
  readonly 'project.added': {
    readonly projectId: string;
    readonly repository: { readonly owner: string; readonly name: string };
    readonly checkoutPath: string;
  };
  readonly 'snapshot.changed': {
    readonly projectId: string;
    readonly addedTicketNumbers: ReadonlyArray<number>;
    readonly changedTicketNumbers: ReadonlyArray<number>;
    readonly removedTicketNumbers: ReadonlyArray<number>;
  };
};
