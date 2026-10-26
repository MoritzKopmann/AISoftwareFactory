import type { BoardIndex as Index } from '../../../../assets/kit/board/board-store.js';

/** A design index with only the fields a test cares about set. */
export function buildIndex(fields: Partial<Index> = {}): Index {
  return {
    title: 'Design',
    brief: 'A brief',
    round: 1,
    boards: [{ id: 'settings', title: 'Settings', w: 1280, h: 800, note: '' }],
    ...fields,
  };
}

/** Serves `index.json` and the `_changes` stream a board page reads. `index` undefined → 404. */
export class FakeBoardServer {
  index: Index | undefined = buildIndex();
  readonly requests: string[] = [];
  readonly changeUrls: string[] = [];
  private readonly changes = new EventTarget();

  dependencies(): {
    fetch: (url: string) => Promise<Response>;
    openChanges: (url: string) => EventTarget;
  } {
    return {
      fetch: async (url) => {
        this.requests.push(url);
        return this.index === undefined
          ? new Response('Not found', { status: 404 })
          : new Response(JSON.stringify(this.index), { status: 200 });
      },
      openChanges: (url) => {
        this.changeUrls.push(url);
        return this.changes;
      },
    };
  }

  /** Sends one `reload` event, as the app does when a file in the design folder changes. */
  reload(file: string): void {
    this.changes.dispatchEvent(new MessageEvent('reload', { data: JSON.stringify({ file }) }));
  }
}
