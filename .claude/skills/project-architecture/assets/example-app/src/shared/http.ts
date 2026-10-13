// Transport helpers shared by every module's presentation/api. Only presentation/api may import this.
import { NotFoundError, ValidationError } from "./errors.js";

export interface HttpRequest {
  params: Record<string, string>;
  body: unknown;
}
export interface HttpResponse {
  status: number;
  body: unknown;
}
export type HttpHandler = (req: HttpRequest) => Promise<HttpResponse>;
/** Route table a module contributes, keyed "METHOD /path". */
export type Routes = Record<string, HttpHandler>;

export function toHttpError(err: unknown): HttpResponse {
  if (err instanceof ValidationError) return { status: 400, body: { error: err.message } };
  if (err instanceof NotFoundError) return { status: 404, body: { error: err.message } };
  console.error(err);
  return { status: 500, body: { error: "Internal error" } };
}
