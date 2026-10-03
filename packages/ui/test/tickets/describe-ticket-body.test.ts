import { describe, expect, it } from 'vitest';
import { describeTicketBody } from '../../src/tickets/describe-ticket-body.js';

describe('describeTicketBody', () => {
  it('should be empty when the body is the empty string', () => {
    expect(describeTicketBody('')).toEqual({ kind: 'empty' });
  });

  it('should be empty when the body is whitespace only', () => {
    expect(describeTicketBody(' \n\t  \r\n')).toEqual({ kind: 'empty' });
  });

  it('should carry the body unchanged as markdown when it has text', () => {
    expect(describeTicketBody('\n## Spec\n\n- a\n')).toEqual({
      kind: 'markdown',
      source: '\n## Spec\n\n- a\n',
    });
  });
});
