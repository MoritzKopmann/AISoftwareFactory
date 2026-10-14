import { describe, expect, it } from 'vitest';
import { statusForDomainError, ticketNumberParameterSchema } from './http.js';
import {
  ConflictError,
  NotFoundError,
  UnprocessableError,
  UpstreamError,
  ValidationError,
} from './errors.js';

describe('ticketNumberParameterSchema', () => {
  it('should parse the number when the text is a positive integer', () => {
    expect(ticketNumberParameterSchema.parse('172')).toBe(172);
  });

  it.each(['0', '-1', '1.5', 'abc', '', '007'])(
    'should reject %j when it is not a positive integer',
    (text) => {
      expect(ticketNumberParameterSchema.safeParse(text).success).toBe(false);
    },
  );

  it('should reject the text when the number is beyond the safe integer range', () => {
    expect(ticketNumberParameterSchema.safeParse('9007199254740993').success).toBe(false);
  });
});

describe('statusForDomainError', () => {
  it.each([
    [new NotFoundError('x'), 404],
    [new ValidationError('x'), 400],
    [new ConflictError('x'), 409],
    [new UnprocessableError('x'), 422],
    [new UpstreamError('x'), 502],
  ])('should return the kind status when given %o', (error, status) => {
    expect(statusForDomainError(error)).toBe(status);
  });

  it('should return undefined when the error is not a domain error', () => {
    expect(statusForDomainError(new Error('plain'))).toBeUndefined();
  });

  it('should return undefined when the value is not an error', () => {
    expect(statusForDomainError('text')).toBeUndefined();
  });
});
