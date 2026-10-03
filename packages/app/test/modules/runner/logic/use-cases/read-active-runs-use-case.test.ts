import { describe, expect, it } from 'vitest';
import { ReadActiveRunsUseCase } from '../../../../../src/modules/runner/logic/use-cases/read-active-runs-use-case.js';
import { buildRun, FakeRecentRunSteps, FakeRunRepository } from '../../fakes/fake-runner-ports.js';

describe('ReadActiveRunsUseCase', () => {
  it('should return each running run with its recent steps', async () => {
    const runRepository = new FakeRunRepository();
    const recentRunSteps = new FakeRecentRunSteps();
    const run = buildRun();
    await runRepository.insert(run);
    recentRunSteps.append('run-1', { at: 'a', summary: 'Read package.json' });

    const otherRun = buildRun({ id: 'run-2', ticketNumber: 12 });
    await runRepository.insert(otherRun);

    const activeRuns = await new ReadActiveRunsUseCase({ runRepository, recentRunSteps }).execute(
      'moritz/aisf',
    );

    expect(activeRuns).toEqual([
      { run, steps: [{ at: 'a', summary: 'Read package.json' }] },
      { run: otherRun, steps: [] },
    ]);
  });

  it('should return nothing when no run in the project is running', async () => {
    const activeRuns = await new ReadActiveRunsUseCase({
      runRepository: new FakeRunRepository(),
      recentRunSteps: new FakeRecentRunSteps(),
    }).execute('moritz/aisf');

    expect(activeRuns).toEqual([]);
  });
});
