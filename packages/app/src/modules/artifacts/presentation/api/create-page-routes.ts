import { Hono, type Context, type MiddlewareHandler } from 'hono';
import { NONCE, secureHeaders } from 'hono/secure-headers';
import { streamSSE } from 'hono/streaming';
import { getMimeType } from 'hono/utils/mime';
import { ConflictError } from '../../../../shared/errors.js';
import { statusForDomainError } from '../../../../shared/http.js';
import type { PageService } from '../../business/service/page-service.js';
import { pageEventBodySchema } from '../dto/api/page-events-schemas.js';
import { toPageStatusResponse } from '../dto/mapper/artifact-mapper.js';
import { toPageEvent } from '../dto/mapper/page-event-mapper.js';

const maxEventBytes = 32 * 1024;

const eventConflictStatuses: Readonly<Record<string, 'busy' | 'closed' | undefined>> = {
  PageBusyError: 'busy',
  PageClosedError: 'closed',
};

const heartbeatIntervalMilliseconds = 25_000;

const addPageHeaders =
  (pageService: PageService): MiddlewareHandler =>
  async (context, next) => {
    const isBoard = (await pageService.kindOf(context.req.param('token') ?? '')) === 'board';
    return secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'none'"],
        scriptSrc: ["'self'", NONCE],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: [`http://${context.req.header('host')}/a/${context.req.param('token')}/`],
        ...(isBoard ? { frameSrc: ["'self'"] } : {}),
        frameAncestors: ["'self'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
      },
      referrerPolicy: 'no-referrer',
    })(context, async () => {
      context.header('Cache-Control', 'no-store');
      await next();
    });
  };

async function answerOrDomainError(
  context: Context,
  answer: () => Promise<Response>,
): Promise<Response> {
  try {
    return await answer();
  } catch (error) {
    const status = statusForDomainError(error);
    if (status === undefined || !(error instanceof Error)) {
      throw error;
    }
    return context.json({ message: error.message }, status);
  }
}

function assetPathOf(context: Context, token: string): string | undefined {
  const { pathname } = new URL(context.req.url);
  const marker = `/${token}/`;
  const rawPath = pathname.slice(pathname.indexOf(marker) + marker.length);
  try {
    return decodeURIComponent(rawPath);
  } catch (error) {
    if (error instanceof URIError) {
      return undefined;
    }
    throw error;
  }
}

export function createPageRoutes(pageService: PageService): Hono {
  return new Hono()
    .use('/:token/*', addPageHeaders(pageService))
    .get('/:token/', (context) =>
      answerOrDomainError(context, async () => {
        const html = await pageService.read(
          context.req.param('token'),
          context.get('secureHeadersNonce') ?? '',
        );
        return context.html(html);
      }),
    )
    .get('/:token/_status', (context) =>
      answerOrDomainError(context, async () =>
        context.json(
          toPageStatusResponse(await pageService.readStatus(context.req.param('token'))),
        ),
      ),
    )
    .get('/:token/_changes', async (context) => {
      const token = context.req.param('token');
      if ((await pageService.kindOf(token)) !== 'board') {
        return context.json({ message: 'Unknown board' }, 404);
      }
      return streamChanges(context, pageService, token);
    })
    .get('/:token/_user-input-state', (context) =>
      answerOrDomainError(context, async () => {
        const userInputState = await pageService.readUserInputState(context.req.param('token'));
        return context.body(userInputState, 200, { 'Content-Type': 'application/json' });
      }),
    )
    .put('/:token/_user-input-state', (context) =>
      answerOrDomainError(context, async () => {
        const userInputState = await context.req.text();
        try {
          JSON.parse(userInputState);
        } catch (error) {
          if (error instanceof SyntaxError) {
            return context.json({ message: 'The user input state must be JSON' }, 400);
          }
          throw error;
        }
        await pageService.writeUserInputState(context.req.param('token'), userInputState);
        return context.body(null, 204);
      }),
    )
    .post('/:token/_events', (context) =>
      answerOrDomainError(context, async () => {
        const raw = await context.req.text();
        if (Buffer.byteLength(raw) > maxEventBytes) {
          return context.json({ message: 'The event is too large' }, 413);
        }
        let json: unknown;
        try {
          json = JSON.parse(raw);
        } catch (error) {
          if (error instanceof SyntaxError) {
            return context.json({ message: 'The event must be JSON' }, 400);
          }
          throw error;
        }
        const parsed = pageEventBodySchema.safeParse(json);
        if (!parsed.success) {
          return context.json({ message: 'The event is malformed' }, 400);
        }
        try {
          await pageService.submitEvent(context.req.param('token'), toPageEvent(parsed.data));
        } catch (error) {
          const conflictStatus =
            error instanceof ConflictError ? eventConflictStatuses[error.name] : undefined;
          if (conflictStatus === undefined) {
            throw error;
          }
          return context.json({ status: conflictStatus }, 409);
        }
        return context.body(null, 201);
      }),
    )
    .get('/:token/*', (context) =>
      answerOrDomainError(context, async () => {
        const token = context.req.param('token');
        const assetPath = assetPathOf(context, token);
        if (assetPath === undefined) {
          return context.json({ message: 'Unknown file' }, 404);
        }
        const content = await pageService.readAsset(token, assetPath);
        return context.body(content as Uint8Array<ArrayBuffer>, 200, {
          'Content-Type': getMimeType(assetPath) ?? 'application/octet-stream',
        });
      }),
    );
}

function streamChanges(context: Context, pageService: PageService, token: string): Response {
  return streamSSE(context, async (stream) => {
    let wake: () => void = () => undefined;
    const stop = await pageService.watchChanges(token, (file) => {
      void stream
        .writeSSE({ event: 'reload', data: JSON.stringify({ file }) })
        .catch(() => undefined);
    });
    const heartbeat = setInterval(() => {
      void stream.write(': ping\n\n').catch(() => undefined);
    }, heartbeatIntervalMilliseconds);
    stream.onAbort(() => {
      clearInterval(heartbeat);
      stop();
      wake();
    });
    await new Promise<void>((resolve) => {
      wake = resolve;
    });
  });
}
