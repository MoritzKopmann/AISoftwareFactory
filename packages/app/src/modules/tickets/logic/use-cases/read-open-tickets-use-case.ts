import { presentWatch } from '../domain/functions/present-watch.js';
import type { Ticket } from '../domain/types/ticket.js';
import type { WatchStore } from '../ports/watch-store.js';

export type ReadOpenTicketsDependencies = {
  readonly watchStore: WatchStore;
};

export class ReadOpenTicketsUseCase {
  constructor(private readonly dependencies: ReadOpenTicketsDependencies) {}

  execute(projectId: string): ReadonlyArray<Ticket> {
    const { watchStore } = this.dependencies;
    const watch = watchStore.watch(projectId);
    return watch === undefined
      ? []
      : (presentWatch(watch, watchStore.statusWrites(projectId)).snapshot?.openTickets ?? []);
  }
}
