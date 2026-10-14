import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DomainEvents, EventSubscriber } from '../../../../shared/event-bus.js';
import { domainEventNames } from '../../../../shared/event-bus.js';
import { InMemoryEventBus } from '../../../../shared/in-memory-event-bus.js';
import { createLiveRoutes } from './live.routes.js';
import { liveNoticeSchema } from '../dto/api/live-notice-schemas.js';

class CountingSubscriber implements EventSubscriber {
  activeHandlers = 0;
  constructor(private readonly bus: InMemoryEventBus<DomainEvents>) {}
  on<Name extends keyof DomainEvents>(
    name: Name,
    handler: (payload: DomainEvents[Name]) => void,
  ): () => void {
    this.activeHandlers += 1;
    const unsubscribe = this.bus.on(name, handler);
    return () => {
      this.activeHandlers -= 1;
      unsubscribe();
    };
  }
}

async function openStream(subscriber: EventSubscriber) {
  const response = await createLiveRoutes(subscriber).request('/events');
  const body = response.body;
  if (body === null) throw new Error('no body');
  const reader = body.getReader();
  const decoder = new TextDecoder();
  return {
    response,
    cancel: () => reader.cancel(),
    async next(): Promise<string> {
      const chunk = await reader.read();
      return decoder.decode(chunk.value);
    },
  };
}

describe('createLiveRoutes', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should answer as an event stream when a client requests /events', async () => {
    const stream = await openStream(new InMemoryEventBus<DomainEvents>());
    expect(stream.response.status).toBe(200);
    expect(stream.response.headers.get('Content-Type')).toContain('text/event-stream');
    await stream.cancel();
  });

  it('should send a thin notice when the bus emits an event', async () => {
    const bus = new InMemoryEventBus<DomainEvents>();
    const stream = await openStream(bus);
    bus.emit('run.finished', {
      runId: 'run-1',
      projectId: 'octo/repo',
      ticketNumber: 7,
      stage: 'implement',
      ending: { kind: 'finished' },
    });
    expect(await stream.next()).toBe(
      'data: {"event":"run.finished","projectId":"octo/repo","ticketNumber":7}\n\n',
    );
    await stream.cancel();
  });

  it('should forward every event when each name is emitted once', async () => {
    const bus = new InMemoryEventBus<DomainEvents>();
    const stream = await openStream(bus);
    for (const name of domainEventNames) {
      bus.emit(name, {} as never);
    }
    let received = '';
    while (received.split('\n\n').length < domainEventNames.length + 1) {
      received += await stream.next();
    }
    const events = received
      .split('\n\n')
      .filter((message) => message !== '')
      .map((message) => liveNoticeSchema.parse(JSON.parse(message.slice('data: '.length))).event);
    expect(events).toEqual([...domainEventNames]);
    await stream.cancel();
  });

  it('should send the same notice when two clients are connected', async () => {
    const bus = new InMemoryEventBus<DomainEvents>();
    const first = await openStream(bus);
    const second = await openStream(bus);
    bus.emit('finding.changed', { projectId: 'octo/repo', ticketNumber: 7, findingId: 3 });
    const expected =
      'data: {"event":"finding.changed","projectId":"octo/repo","ticketNumber":7}\n\n';
    expect(await first.next()).toBe(expected);
    expect(await second.next()).toBe(expected);
    await first.cancel();
    await second.cancel();
  });

  it('should send a ping comment when 25 seconds pass idle', async () => {
    vi.useFakeTimers();
    const stream = await openStream(new InMemoryEventBus<DomainEvents>());
    await vi.advanceTimersByTimeAsync(25_000);
    expect(await stream.next()).toBe(': ping\n\n');
    await stream.cancel();
  });

  it('should unsubscribe every handler when the client cancels', async () => {
    const subscriber = new CountingSubscriber(new InMemoryEventBus<DomainEvents>());
    const stream = await openStream(subscriber);
    expect(subscriber.activeHandlers).toBe(domainEventNames.length);
    await stream.cancel();
    await vi.waitFor(() => {
      expect(subscriber.activeHandlers).toBe(0);
    });
  });
});
