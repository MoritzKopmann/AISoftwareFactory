import { describe, expect, it } from 'vitest';
import { describeNewIdeaForm } from '../../src/projects/describe-new-idea-form.js';

describe('describeNewIdeaForm', () => {
  it('should not be pressable when the text is blank', () => {
    expect(describeNewIdeaForm('  \n ', { kind: 'idle' }, 'o/n').pressable).toBe(false);
  });

  it('should be pressable when the text has content and nothing is starting', () => {
    expect(describeNewIdeaForm('Export trips', { kind: 'idle' }, 'o/n').pressable).toBe(true);
  });

  it('should not be pressable while starting', () => {
    expect(describeNewIdeaForm('Export trips', { kind: 'starting' }, 'o/n').pressable).toBe(false);
  });

  it('should be busy when starting', () => {
    expect(describeNewIdeaForm('Export trips', { kind: 'starting' }, 'o/n').busy).toBe(true);
  });

  it('should not be busy when idle', () => {
    expect(describeNewIdeaForm('Export trips', { kind: 'idle' }, 'o/n').busy).toBe(false);
  });

  it('should show a danger error with the server message as detail when nothing was created', () => {
    expect(
      describeNewIdeaForm('x', { kind: 'failed', message: 'POST /ideas · 502' }, 'o/n').error,
    ).toEqual({
      tone: 'danger',
      message: "Couldn't create the idea. Your text is kept; submit again.",
      detail: 'POST /ideas · 502',
    });
  });

  it('should show no detail when nothing was created and the server gave no message', () => {
    expect(describeNewIdeaForm('x', { kind: 'failed', message: '' }, 'o/n').error).toEqual({
      tone: 'danger',
      message: "Couldn't create the idea. Your text is kept; submit again.",
    });
  });

  it('should show a warn error with a link to the ticket when the idea was created but not started', () => {
    expect(
      describeNewIdeaForm('', { kind: 'failed', message: 'Busy', ticketNumber: 419 }, 'o/n').error,
    ).toEqual({
      tone: 'warn',
      message: 'The idea was created, but the session did not start.',
      link: { label: 'Open #419', href: '#/projects/o/n/tickets/419' },
    });
  });
});
