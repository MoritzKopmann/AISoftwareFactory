import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AisfEventMap } from '../../../src/shared/bus/aisf-event-map.js';
import { aisfEventNames } from '../../../src/shared/bus/aisf-event-names.js';
import type { EventSubscriber } from '../../../src/shared/bus/event-subscriber.js';
import { TypedEventBus } from '../../../src/shared/bus/typed-event-bus.js';
import { createLiveNoticeRoutes } from '../../../src/shared/http/create-live-notice-routes.js';
import { liveNoticeSchema } from '../../../src/shared/http/schemas/live-notice-schemas.js';

class CountingSubscriber implements EventSubscriber {
  activeHandlers = 0;
  constructor(private readonly bus: TypedEventBus<AisfEventMap>) {}
  on<Name extends keyof AisfEventMap>(
    name: Name,
    handler: (payload: AisfEventMap[Name]) => void,
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
  const response = await createLiveNoticeRoutes(subscriber).request('/events');
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

describe('createLiveNoticeRoutes', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should answer as an event stream when a client requests /events', async () => {
    const stream = await openStream(new TypedEventBus<AisfEventMap>());
    expect(stream.response.status).toBe(200);
    expect(stream.response.headers.get('Content-Type')).toContain('text/event-stream');
    await stream.cancel();
  });

  it('should send a thin notice when the bus emits an event', async () => {
    const bus = new TypedEventBus<AisfEventMap>();
    const stream = await openStream(bus);
    bus.emit('run.finished', {
      runId: 'run-1',
      projectId: 'octo/repo',
      ticketNumber: 7,
      ending: { kind: 'finished' },
    });
    expect(await stream.next()).toBe(
      'data: {"event":"run.finished","projectId":"octo/repo","ticketNumber":7}\n\n',
    );
    await stream.cancel();
  });

  it('should forward every event when each name is emitted once', async () => {
    const bus = new TypedEventBus<AisfEventMap>();
    const stream = await openStream(bus);
    for (const name of aisfEventNames) {
      bus.emit(name, {} as never);
    }
    let received = '';
    while (received.split('\n\n').length < aisfEventNames.length + 1) {
      received += await stream.next();
    }
    const events = received
      .split('\n\n')
      .filter((message) => message !== '')
      .map((message) => liveNoticeSchema.parse(JSON.parse(message.slice('data: '.length))).event);
    expect(events).toEqual([...aisfEventNames]);
    await stream.cancel();
  });

  it('should send the same notice when two clients are connected', async () => {
    const bus = new TypedEventBus<AisfEventMap>();
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
    const stream = await openStream(new TypedEventBus<AisfEventMap>());
    await vi.advanceTimersByTimeAsync(25_000);
    expect(await stream.next()).toBe(': ping\n\n');
    await stream.cancel();
  });

  it('should unsubscribe every handler when the client cancels', async () => {
    const subscriber = new CountingSubscriber(new TypedEventBus<AisfEventMap>());
    const stream = await openStream(subscriber);
    expect(subscriber.activeHandlers).toBe(aisfEventNames.length);
    await stream.cancel();
    await vi.waitFor(() => {
      expect(subscriber.activeHandlers).toBe(0);
    });
  });
});
