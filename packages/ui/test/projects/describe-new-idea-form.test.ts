import { describe, expect, it } from 'vitest';
import { describeNewIdeaForm } from '../../src/projects/describe-new-idea-form.js';

describe('describeNewIdeaForm', () => {
  it('should not be pressable when the title is blank', () => {
    expect(describeNewIdeaForm('  ', { kind: 'idle' }, 'o/n').pressable).toBe(false);
  });

  it('should be pressable when the title has text and nothing is starting', () => {
    expect(describeNewIdeaForm('Export trips', { kind: 'idle' }, 'o/n').pressable).toBe(true);
  });

  it('should not be pressable while starting', () => {
    expect(describeNewIdeaForm('Export trips', { kind: 'starting' }, 'o/n').pressable).toBe(false);
  });

  it('should show the message with a link to the ticket when the start failed with a ticket', () => {
    expect(
      describeNewIdeaForm('x', { kind: 'failed', message: 'Busy', ticketNumber: 12 }, 'o/n').error,
    ).toEqual({ message: 'Busy', link: { label: '#12', href: '#/projects/o/n/tickets/12' } });
  });

  it('should show only the message when the start failed without a ticket', () => {
    expect(describeNewIdeaForm('x', { kind: 'failed', message: 'Boom' }, 'o/n').error).toEqual({
      message: 'Boom',
    });
  });
});
