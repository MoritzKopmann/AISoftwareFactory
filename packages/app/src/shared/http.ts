import { z } from 'zod';
import {
  ConflictError,
  NotFoundError,
  UnprocessableError,
  UpstreamError,
  ValidationError,
} from './errors.js';

/** The HTTP status of a domain error kind, or undefined for any other value. */
export function statusForDomainError(error: unknown): 404 | 400 | 409 | 422 | 502 | undefined {
  if (error instanceof NotFoundError) {
    return 404;
  }
  if (error instanceof ValidationError) {
    return 400;
  }
  if (error instanceof ConflictError) {
    return 409;
  }
  if (error instanceof UnprocessableError) {
    return 422;
  }
  if (error instanceof UpstreamError) {
    return 502;
  }
  return undefined;
}

export const ticketNumberParameterSchema = z
  .string()
  .regex(/^[1-9]\d*$/, 'The ticket number must be a positive integer')
  .transform(Number)
  .refine(Number.isSafeInteger, 'The ticket number is too large');
