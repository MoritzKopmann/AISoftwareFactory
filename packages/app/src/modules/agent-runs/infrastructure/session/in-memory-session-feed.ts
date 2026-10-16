import type { SessionEntry } from '../../business/domain/types/session-entry.js';
import type { SessionFeed, SessionFeedEvent } from '../../business/port/session/session-feed.js';

type Listener = (event: SessionFeedEvent) => void;

export class InMemorySessionFeed implements SessionFeed {
  private readonly entriesByRunId = new Map<string, SessionEntry[]>();
  private readonly listenersByRunId = new Map<string, Set<Listener>>();

  publish(runId: string, event: SessionFeedEvent): void {
    const entries = this.entriesByRunId.get(runId) ?? [];
    if (event.kind === 'entry') {
      entries.push(event.entry);
    }
    this.entriesByRunId.set(runId, entries);
    for (const listener of [...(this.listenersByRunId.get(runId) ?? [])]) {
      listener(event);
    }
  }

  entries(runId: string): ReadonlyArray<SessionEntry> {
    return [...(this.entriesByRunId.get(runId) ?? [])];
  }

  subscribe(runId: string, listener: Listener): () => void {
    const listeners = this.listenersByRunId.get(runId) ?? new Set<Listener>();
    listeners.add(listener);
    this.listenersByRunId.set(runId, listeners);
    return () => {
      listeners.delete(listener);
    };
  }

  isActive(runId: string): boolean {
    return this.entriesByRunId.has(runId);
  }

  end(runId: string): void {
    for (const listener of [...(this.listenersByRunId.get(runId) ?? [])]) {
      listener({ kind: 'ended' });
    }
    this.entriesByRunId.delete(runId);
    this.listenersByRunId.delete(runId);
  }
}
