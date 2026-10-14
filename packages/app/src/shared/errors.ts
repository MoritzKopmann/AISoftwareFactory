/** Domain error kinds. A module error subclasses one of these; `statusForDomainError` maps it to a status. */
export class NotFoundError extends Error {}
export class ValidationError extends Error {}
export class ConflictError extends Error {}
export class UnprocessableError extends Error {}
export class UpstreamError extends Error {}
