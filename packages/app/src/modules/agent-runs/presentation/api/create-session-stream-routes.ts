import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { ticketNumberParameterSchema } from '../../../../shared/http.js';
import type { TicketSessionWatchEvent } from '../../business/domain/types/ticket-session-watch.js';
import type { RunQueryService } from '../../business/service/run-query-service.js';
import { toSessionStreamFrame } from '../dto/mapper/session-stream-mapper.js';

const heartbeatIntervalMilliseconds = 25_000;
const lastEventKinds: ReadonlyArray<TicketSessionWatchEvent['kind']> = [
  'no-session',
  'transcript-not-found',
  'ended',
];

export function createSessionStreamRoutes(runQueryService: RunQueryService): Hono {
  return new Hono().get('/api/projects/:owner/:name/tickets/:number/session', (context) => {
    const parsedNumber = ticketNumberParameterSchema.safeParse(context.req.param('number'));
    if (!parsedNumber.success) {
      return context.json({ message: parsedNumber.error.issues[0]?.message }, 400);
    }

    const projectId = `${context.req.param('owner')}/${context.req.param('name')}`;
    return streamSSE(context, async (stream) => {
      let closed = false;
      let finished = false;
      let unsubscribe: () => void = () => undefined;
      let wake: () => void = () => undefined;
      let writes: Promise<void> = Promise.resolve();
      const heartbeat = setInterval(() => {
        void stream.write(': ping\n\n').catch(() => undefined);
      }, heartbeatIntervalMilliseconds);

      const close = (): void => {
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        wake();
      };
      stream.onAbort(close);

      const send = (event: TicketSessionWatchEvent): void => {
        if (finished) {
          return;
        }
        const data = JSON.stringify(toSessionStreamFrame(event));
        writes = writes.then(() => stream.writeSSE({ data })).catch(() => undefined);
        if (lastEventKinds.includes(event.kind)) {
          finished = true;
          void writes.then(close);
        }
      };

      try {
        unsubscribe = await runQueryService.watchTicketSession(projectId, parsedNumber.data, send);
        if (closed) {
          return;
        }
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      } finally {
        close();
      }
    });
  });
}
