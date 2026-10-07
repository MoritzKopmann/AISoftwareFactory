import { describe, expect, it } from 'vitest';
import { createRunLogLoader } from '../../src/tickets/create-run-log-loader.js';
import type { RunLogState } from '../../src/tickets/describe-run-log.js';
import type { RunLogOutcome } from '../../src/tickets/fetch-run-log.js';

const noSession: RunLogOutcome = { kind: 'answer', response: { kind: 'no-session' } };
const transcriptNotFound: RunLogOutcome = {
  kind: 'answer',
  response: { kind: 'transcript-not-found' },
};

function createFakes(outcomes: ReadonlyArray<RunLogOutcome> = [noSession]) {
  const shown: RunLogState[] = [];
  let readCount = 0;
  const loader = createRunLogLoader(
    () => {
      const outcome = outcomes[readCount] ?? noSession;
      readCount += 1;
      return Promise.resolve(outcome);
    },
    (state) => shown.push(state),
  );
  return { loader, shown, readCount: () => readCount };
}

describe('createRunLogLoader', () => {
  it('should fetch nothing when the log has not been opened', () => {
    const { shown, readCount } = createFakes();
    expect(readCount()).toBe(0);
    expect(shown).toEqual([]);
  });

  it('should show loading until the route answers and then the answer when the log opens', async () => {
    const { loader, shown, readCount } = createFakes();
    const loaded = loader.toggle(true);
    expect(shown).toEqual([{ kind: 'loading' }]);
    await loaded;
    expect(shown).toEqual([{ kind: 'loading' }, noSession]);
    expect(readCount()).toBe(1);
  });

  it('should drop what was loaded without fetching when the log closes', async () => {
    const { loader, shown, readCount } = createFakes();
    await loader.toggle(true);
    await loader.toggle(false);
    expect(shown.at(-1)).toEqual({ kind: 'closed' });
    expect(readCount()).toBe(1);
  });

  it('should fetch again and show the newer answer when the log is closed and opened again', async () => {
    const { loader, shown, readCount } = createFakes([noSession, transcriptNotFound]);
    await loader.toggle(true);
    await loader.toggle(false);
    await loader.toggle(true);
    expect(readCount()).toBe(2);
    expect(shown.slice(-2)).toEqual([{ kind: 'loading' }, transcriptNotFound]);
  });

  it('should not show an answer when it arrives after the log closed', async () => {
    const { loader, shown } = createFakes();
    const loaded = loader.toggle(true);
    await loader.toggle(false);
    await loaded;
    expect(shown).toEqual([{ kind: 'loading' }, { kind: 'closed' }]);
  });

  it('should show loading and fetch again when Retry is pressed after a failed fetch', async () => {
    const failed: RunLogOutcome = { kind: 'request-failed', message: 'Failed to fetch' };
    const { loader, shown, readCount } = createFakes([failed, noSession]);
    await loader.toggle(true);
    await loader.retry();
    expect(readCount()).toBe(2);
    expect(shown).toEqual([{ kind: 'loading' }, failed, { kind: 'loading' }, noSession]);
  });
});
