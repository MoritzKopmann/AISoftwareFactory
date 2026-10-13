// Domain errors: thrown by business code, translated to transport codes by presentation code.
// No HTTP knowledge here — that lives in shared/http.ts.
export class NotFoundError extends Error {}
export class ValidationError extends Error {}
