import { describe, expect, it } from 'vitest';
import { ReadLatestRunUseCase } from '../../../../../src/modules/runner/logic/use-cases/read-latest-run-use-case.js';
import { buildRun, FakeRunRepository } from '../../fakes/fake-runner-ports.js';

describe('ReadLatestRunUseCase', () => {
  it('should return the latest run of the ticket when it has one', async () => {
    const runRepository = new FakeRunRepository();
    const run = buildRun({ state: 'ended', ending: { kind: 'finished' } });
    await runRepository.insert(run);

    expect(await new ReadLatestRunUseCase({ runRepository }).execute('moritz/aisf', 137)).toEqual(
      run,
    );
  });

  it('should return undefined when the ticket has no run', async () => {
    const latestRun = await new ReadLatestRunUseCase({
      runRepository: new FakeRunRepository(),
    }).execute('moritz/aisf', 137);

    expect(latestRun).toBeUndefined();
  });
});
