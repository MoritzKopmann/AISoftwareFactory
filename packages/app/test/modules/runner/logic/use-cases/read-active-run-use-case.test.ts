import { describe, expect, it } from 'vitest';
import { ReadActiveRunUseCase } from '../../../../../src/modules/runner/logic/use-cases/read-active-run-use-case.js';
import { buildRun, FakeRecentRunSteps, FakeRunRepository } from '../../fakes/fake-runner-ports.js';

describe('ReadActiveRunUseCase', () => {
  it('should return the running run with its recent steps when the project has one', async () => {
    const runRepository = new FakeRunRepository();
    const recentRunSteps = new FakeRecentRunSteps();
    const run = buildRun();
    await runRepository.insert(run);
    recentRunSteps.append('run-1', { at: 'a', summary: 'Read package.json' });

    const activeRun = await new ReadActiveRunUseCase({ runRepository, recentRunSteps }).execute(
      'moritz/aisf',
    );

    expect(activeRun).toEqual({ run, steps: [{ at: 'a', summary: 'Read package.json' }] });
  });

  it('should return undefined when no run in the project is running', async () => {
    const activeRun = await new ReadActiveRunUseCase({
      runRepository: new FakeRunRepository(),
      recentRunSteps: new FakeRecentRunSteps(),
    }).execute('moritz/aisf');

    expect(activeRun).toBeUndefined();
  });
});
