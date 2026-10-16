import type { MiddlewareHandler } from 'hono';

const loopbackHostPattern = /^(127\.0\.0\.1|localhost)(:\d+)?$/i;

// Guards the whole app against DNS rebinding and cross-site writes.
// Our own check instead of hono/csrf: that one skips JSON bodies.
export const requireLocalRequest: MiddlewareHandler = async (context, next) => {
  const host = context.req.header('host');
  if (host === undefined || !loopbackHostPattern.test(host)) {
    return context.json({ message: 'Forbidden host' }, 403);
  }
  if (context.req.method !== 'GET' && context.req.method !== 'HEAD') {
    if (context.req.header('origin') !== `http://${host}`) {
      return context.json({ message: 'Forbidden origin' }, 403);
    }
  }
  return next();
};
