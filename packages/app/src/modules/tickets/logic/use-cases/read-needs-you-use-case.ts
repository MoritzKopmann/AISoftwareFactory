import { buildNeedsYouRows } from '../domain/functions/build-needs-you-rows.js';
import { presentWatch } from '../domain/functions/present-watch.js';
import type { NeedsYouRow } from '../domain/types/needs-you-row.js';
import type { RunWaitLookup } from '../ports/run-wait-lookup.js';
import type { WatchStore } from '../ports/watch-store.js';

export type ReadNeedsYouDependencies = {
  readonly runWaitLookup: RunWaitLookup;
  readonly watchStore: WatchStore;
};

export class ReadNeedsYouUseCase {
  constructor(private readonly dependencies: ReadNeedsYouDependencies) {}

  async execute(projectId: string): Promise<ReadonlyArray<NeedsYouRow> | undefined> {
    const { runWaitLookup, watchStore } = this.dependencies;
    const watch = watchStore.watch(projectId);
    if (watch === undefined) {
      return undefined;
    }
    const openTickets =
      presentWatch(watch, watchStore.statusWrites(projectId)).snapshot?.openTickets ?? [];
    return buildNeedsYouRows(openTickets, await runWaitLookup.waitsOf(projectId));
  }
}
