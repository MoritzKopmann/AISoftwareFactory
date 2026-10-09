import type { LiveNotice } from '@aisf/app/api-schemas/live-notice-schemas.js';
import { describe, expect, it } from 'vitest';
import { keepPolledAt } from '../../src/board/keep-polled-at.js';

const polledAt = '2026-09-28T10:05:00.000Z';
const noChange = (projectId: string): LiveNotice => ({
  event: 'watch.updated',
  projectId,
  changed: false,
  polledAt,
});

describe('keepPolledAt', () => {
  it('should take the poll time when a no-change notice is for the same project', () => {
    expect(keepPolledAt(undefined, noChange('P'), 'P')).toBe(polledAt);
  });

  it('should keep the previous time when the notice is for another project', () => {
    expect(keepPolledAt(undefined, noChange('Q'), 'P')).toBeUndefined();
  });

  it('should keep the previous time when the notice reports a change', () => {
    expect(keepPolledAt('old', { ...noChange('P'), changed: true }, 'P')).toBe('old');
  });

  it('should keep the previous time when the notice is not watch.updated', () => {
    expect(keepPolledAt('old', { ...noChange('P'), event: 'run.started' }, 'P')).toBe('old');
  });
});
