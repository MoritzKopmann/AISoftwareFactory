import { Hono, type Context, type MiddlewareHandler } from 'hono';
import { NONCE, secureHeaders } from 'hono/secure-headers';
import { getMimeType } from 'hono/utils/mime';
import { pageEventBodySchema } from '../schemas/page-events-schemas.js';
import { ArtifactNotFoundError } from '../../logic/errors/artifact-not-found-error.js';
import { PageBusyError } from '../../logic/errors/page-busy-error.js';
import { PageClosedError } from '../../logic/errors/page-closed-error.js';
import type { ReadPageAssetUseCase } from '../../logic/use-cases/read-page-asset-use-case.js';
import type { ReadPageStateUseCase } from '../../logic/use-cases/read-page-state-use-case.js';
import type { ReadPageStatusUseCase } from '../../logic/use-cases/read-page-status-use-case.js';
import type { ReadPageUseCase } from '../../logic/use-cases/read-page-use-case.js';
import type { SubmitPageEventUseCase } from '../../logic/use-cases/submit-page-event-use-case.js';
import type { WritePageStateUseCase } from '../../logic/use-cases/write-page-state-use-case.js';

export type PageRoutesUseCases = {
  readonly readPage: ReadPageUseCase;
  readonly readAsset: ReadPageAssetUseCase;
  readonly readStatus: ReadPageStatusUseCase;
  readonly readState: ReadPageStateUseCase;
  readonly writeState: WritePageStateUseCase;
  readonly submitEvent: SubmitPageEventUseCase;
};

const maxEventBytes = 32 * 1024;

const loopbackHostPattern = /^(127\.0\.0\.1|localhost)(:\d+)?$/i;

const requireLoopbackHost: MiddlewareHandler = async (context, next) => {
  const host = context.req.header('host');
  if (host === undefined || !loopbackHostPattern.test(host)) {
    return context.json({ message: 'Forbidden host' }, 403);
  }
  return next();
};

// Our own check instead of hono/csrf: that one skips JSON bodies.
const requireOwnOrigin: MiddlewareHandler = async (context, next) => {
  if (context.req.method === 'GET' || context.req.method === 'HEAD') {
    return next();
  }
  if (context.req.header('origin') !== `http://${context.req.header('host')}`) {
    return context.json({ message: 'Forbidden origin' }, 403);
  }
  return next();
};

const addPageHeaders: MiddlewareHandler = (context, next) =>
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'none'"],
      scriptSrc: ["'self'", NONCE],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: [`http://${context.req.header('host')}/a/${context.req.param('token')}/`],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
    },
    referrerPolicy: 'no-referrer',
  })(context, async () => {
    context.header('Cache-Control', 'no-store');
    await next();
  });

async function answerOrNotFound(
  context: Context,
  answer: () => Promise<Response>,
): Promise<Response> {
  try {
    return await answer();
  } catch (error) {
    if (error instanceof ArtifactNotFoundError) {
      return context.json({ message: error.message }, 404);
    }
    throw error;
  }
}

function assetPathOf(context: Context, token: string): string | undefined {
  const { pathname } = new URL(context.req.url);
  const marker = `/${token}/`;
  const rawPath = pathname.slice(pathname.indexOf(marker) + marker.length);
  try {
    return decodeURIComponent(rawPath);
  } catch {
    return undefined;
  }
}

export function createPageRoutes(useCases: PageRoutesUseCases): Hono {
  return new Hono()
    .use('*', requireLoopbackHost)
    .use('*', requireOwnOrigin)
    .use('/:token/*', addPageHeaders)
    .get('/:token/', (context) =>
      answerOrNotFound(context, async () => {
        const html = await useCases.readPage.execute(
          context.req.param('token'),
          context.get('secureHeadersNonce') ?? '',
        );
        return context.html(html);
      }),
    )
    .get('/:token/_status', (context) =>
      answerOrNotFound(context, async () =>
        context.json(await useCases.readStatus.execute(context.req.param('token'))),
      ),
    )
    .get('/:token/_state', (context) =>
      answerOrNotFound(context, async () => {
        const state = await useCases.readState.execute(context.req.param('token'));
        return context.body(state, 200, { 'Content-Type': 'application/json' });
      }),
    )
    .put('/:token/_state', (context) =>
      answerOrNotFound(context, async () => {
        const state = await context.req.text();
        try {
          JSON.parse(state);
        } catch {
          return context.json({ message: 'The state must be JSON' }, 400);
        }
        await useCases.writeState.execute(context.req.param('token'), state);
        return context.body(null, 204);
      }),
    )
    .post('/:token/_events', (context) =>
      answerOrNotFound(context, async () => {
        const raw = await context.req.text();
        if (Buffer.byteLength(raw) > maxEventBytes) {
          return context.json({ message: 'The event is too large' }, 413);
        }
        let json: unknown;
        try {
          json = JSON.parse(raw);
        } catch {
          return context.json({ message: 'The event must be JSON' }, 400);
        }
        const parsed = pageEventBodySchema.safeParse(json);
        if (!parsed.success) {
          return context.json({ message: 'The event is malformed' }, 400);
        }
        try {
          await useCases.submitEvent.execute(context.req.param('token'), parsed.data);
        } catch (error) {
          if (error instanceof PageBusyError) {
            return context.json({ status: 'busy' }, 409);
          }
          if (error instanceof PageClosedError) {
            return context.json({ status: 'closed' }, 409);
          }
          throw error;
        }
        return context.body(null, 201);
      }),
    )
    .get('/:token/*', (context) =>
      answerOrNotFound(context, async () => {
        const token = context.req.param('token');
        const assetPath = assetPathOf(context, token);
        if (assetPath === undefined) {
          throw new ArtifactNotFoundError('Unknown file');
        }
        const content = await useCases.readAsset.execute(token, assetPath);
        return context.body(content as Uint8Array<ArrayBuffer>, 200, {
          'Content-Type': getMimeType(assetPath) ?? 'application/octet-stream',
        });
      }),
    );
}
