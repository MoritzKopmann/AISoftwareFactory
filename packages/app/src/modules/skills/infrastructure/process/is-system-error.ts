/** A Node file-system or child-process error: an Error that carries a `code` property. */
export function isSystemError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
