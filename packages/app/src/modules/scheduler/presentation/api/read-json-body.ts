import type { Context } from 'hono';

/** The parsed JSON body of the request, or `undefined` when the body is not valid JSON. */
export function readJsonBody(context: Context): Promise<unknown> {
  return context.req.json().catch((error: unknown) => {
    if (!(error instanceof SyntaxError)) {
      throw error;
    }
    return undefined;
  });
}
