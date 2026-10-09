import { describe, expect, it } from 'vitest';
import { toLiveNotice } from '../../../src/shared/http/to-live-notice.js';

describe('toLiveNotice', () => {
  it('should keep event, project and ticket when the payload has them', () => {
    expect(
      toLiveNotice('run.finished', {
        runId: 'run-1',
        projectId: 'octo/repo',
        ticketNumber: 7,
        ending: { kind: 'finished' },
      }),
    ).toEqual({ event: 'run.finished', projectId: 'octo/repo', ticketNumber: 7 });
  });

  it('should omit the ticket number when the payload has none', () => {
    expect(toLiveNotice('watch.updated', { projectId: 'octo/repo' })).toEqual({
      event: 'watch.updated',
      projectId: 'octo/repo',
    });
  });

  it('should carry only the name when the payload has no ids', () => {
    expect(toLiveNotice('skills.status-changed', {})).toEqual({
      event: 'skills.status-changed',
    });
  });

  it('should drop tool input when the run waits for a permission', () => {
    const notice = toLiveNotice('run.waiting', {
      runId: 'run-1',
      projectId: 'octo/repo',
      ticketNumber: 7,
      wait: { kind: 'permission-needed', toolName: 'Bash', toolInput: { command: 'rm -rf build' } },
    });
    expect(Object.keys(notice).sort()).toEqual(['event', 'projectId', 'ticketNumber']);
  });
});
