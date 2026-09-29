import { describe, expect, it } from 'vitest';
import { ticketNumberParameterSchema } from '../../../src/shared/http/ticket-number-parameter-schema.js';

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
