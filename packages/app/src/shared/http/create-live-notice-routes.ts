import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { domainEventNames } from '../event-bus.js';
import type { EventSubscriber } from '../event-bus.js';
import { toLiveNotice } from './to-live-notice.js';

const heartbeatIntervalMilliseconds = 25_000;

export function createLiveNoticeRoutes(subscriber: EventSubscriber): Hono {
  return new Hono().get('/events', (context) =>
    streamSSE(context, async (stream) => {
      let closed = false;
      let wake: () => void = () => undefined;
      const unsubscribes: Array<() => void> = [];
      const heartbeat = setInterval(() => {
        void stream.write(': ping\n\n').catch(() => undefined);
      }, heartbeatIntervalMilliseconds);

      stream.onAbort(() => {
        closed = true;
        clearInterval(heartbeat);
        for (const unsubscribe of unsubscribes) {
          unsubscribe();
        }
        wake();
      });

      for (const name of domainEventNames) {
        unsubscribes.push(
          subscriber.on(name, (payload) => {
            void stream
              .writeSSE({ data: JSON.stringify(toLiveNotice(name, payload)) })
              .catch(() => undefined);
          }),
        );
      }

      if (!closed) {
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      }
    }),
  );
}
