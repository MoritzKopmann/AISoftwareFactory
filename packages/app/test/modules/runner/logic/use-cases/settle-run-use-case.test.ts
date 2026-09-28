import { describe, expect, it } from 'vitest';
import { SettleRunUseCase } from '../../../../../src/modules/runner/logic/use-cases/settle-run-use-case.js';
import { FakeClock } from '../../../../fakes/fake-clock.js';
import { buildRun, FakeRunRepository } from '../../fakes/fake-runner-ports.js';

describe('SettleRunUseCase', () => {
  it('should mark an ended run as settled when its ending has been written to GitHub', async () => {
    const runRepository = new FakeRunRepository();
    await runRepository.insert(buildRun({ state: 'ended', ending: { kind: 'finished' } }));
    const settleRun = new SettleRunUseCase({
      runRepository,
      clock: new FakeClock('2026-09-29T12:00:00.000Z'),
    });

    await settleRun.execute('run-1');

    expect(runRepository.runs.get('run-1')?.state).toBe('settled');
  });
});
