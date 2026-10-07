import { beforeEach, describe, expect, it } from 'vitest';
import type { RunEnding } from '../../../../../src/modules/runner/logic/domain/types/run-ending.js';
import { WaitForRunAnswerUseCase } from '../../../../../src/modules/runner/logic/use-cases/wait-for-run-answer-use-case.js';
import { FakeClock } from '../../../../fakes/fake-clock.js';
import { FakeEventPublisher } from '../../../../fakes/fake-event-publisher.js';
import { buildRun, FakeRunAnswerWaits, FakeRunRepository } from '../../fakes/fake-runner-ports.js';

describe('WaitForRunAnswerUseCase', () => {
  let runRepository: FakeRunRepository;
  let runAnswerWaits: FakeRunAnswerWaits;
  let events: FakeEventPublisher;
  let finishedEndings: RunEnding[];
  let useCase: WaitForRunAnswerUseCase;

  beforeEach(async () => {
    runRepository = new FakeRunRepository();
    runAnswerWaits = new FakeRunAnswerWaits();
    events = new FakeEventPublisher();
    finishedEndings = [];
    useCase = new WaitForRunAnswerUseCase({
      runRepository,
      runAnswerWaits,
      clock: new FakeClock('2026-09-29T10:05:00.000Z'),
      events,
      finishRun: async (_runId, ending) => {
        finishedEndings.push(ending);
      },
      windowMilliseconds: 3_600_000,
    });
    await runRepository.insert(buildRun());
  });

  it('should hold, record the wait and emit run.waiting when the run has no wait', async () => {
    const wait = { kind: 'checkpoint', request: 'Check the page' } as const;

    let returned = false;
    const result = useCase.execute(buildRun(), wait).then((outcome) => {
      returned = true;
      return outcome;
    });
    await Promise.resolve();

    expect(returned).toBe(false);
    expect(runRepository.runs.get('run-1')).toMatchObject({
      state: 'running',
      waitingFor: wait,
      waitingSince: '2026-09-29T10:05:00.000Z',
    });
    expect(runAnswerWaits.windowsByRunId.get('run-1')).toBe(3_600_000);
    expect(events.emittedEvents).toEqual([
      {
        name: 'run.waiting',
        payload: { runId: 'run-1', projectId: 'moritz/aisf', ticketNumber: 137, wait },
      },
    ]);
    expect(finishedEndings).toEqual([]);
    runAnswerWaits.deliver('run-1', { kind: 'checkpoint', text: 'ok' });
    await result;
  });

  it('should return the answer text and clear the wait when an answer is delivered', async () => {
    const result = useCase.execute(buildRun(), { kind: 'checkpoint', request: 'Check' });
    await Promise.resolve();

    runAnswerWaits.deliver('run-1', { kind: 'checkpoint', text: 'Looks good' });

    expect(await result).toEqual({
      kind: 'answered',
      answer: { kind: 'checkpoint', text: 'Looks good' },
    });
    const run = runRepository.runs.get('run-1');
    expect(run?.state).toBe('running');
    expect(run).not.toHaveProperty('waitingFor');
    expect(run).not.toHaveProperty('waitingSince');
  });

  it('should refuse at once and change nothing when the run already waits', async () => {
    const first = useCase.execute(buildRun(), { kind: 'checkpoint', request: 'Check the page' });
    await Promise.resolve();

    const outcome = await useCase.execute(buildRun(), { kind: 'checkpoint', request: 'Second' });

    expect(outcome).toEqual({
      kind: 'unanswered',
      message:
        'This run is already waiting for an answer. Do not call this tool again: end your turn.',
    });
    expect(events.emittedEvents).toHaveLength(1);
    expect(runRepository.runs.get('run-1')?.waitingFor).toEqual({
      kind: 'checkpoint',
      request: 'Check the page',
    });
    runAnswerWaits.deliver('run-1', { kind: 'checkpoint', text: 'ok' });
    await first;
  });

  it('should end the run with the wait when the window passes', async () => {
    const result = useCase.execute(buildRun(), { kind: 'checkpoint', request: 'Check the page' });
    await Promise.resolve();

    runAnswerWaits.expire('run-1');

    expect(await result).toEqual({
      kind: 'unanswered',
      message:
        'The answer window has passed. End your turn: the app resumes this session when the human answers.',
    });

    expect(finishedEndings).toEqual([{ kind: 'checkpoint', request: 'Check the page' }]);
  });

  it('should tell the session to end its turn when the wait is cancelled', async () => {
    const result = useCase.execute(buildRun(), { kind: 'checkpoint', request: 'Check' });
    await Promise.resolve();

    runAnswerWaits.cancel('run-1');

    expect(await result).toEqual({
      kind: 'unanswered',
      message: 'The run has ended. End your turn.',
    });
    expect(finishedEndings).toEqual([]);
  });

  it('should carry the artifactId on the run and the event when the wait has one', async () => {
    const wait = { kind: 'checkpoint', request: 'Check', artifactId: 'confirm-plan' } as const;
    const result = useCase.execute(buildRun(), wait);
    await Promise.resolve();

    expect(runRepository.runs.get('run-1')?.waitingFor).toEqual(wait);
    expect(events.emittedEvents).toMatchObject([{ payload: { wait } }]);
    runAnswerWaits.deliver('run-1', { kind: 'checkpoint', text: 'ok' });
    await result;
  });

  it('should hold a permission wait and end the run with it when the window passes', async () => {
    const wait = {
      kind: 'permission-needed',
      toolName: 'Bash',
      toolInput: { command: 'ls' },
    } as const;
    const result = useCase.execute(buildRun(), wait);
    await Promise.resolve();

    expect(runRepository.runs.get('run-1')?.waitingFor).toEqual(wait);
    expect(events.emittedEvents).toMatchObject([{ name: 'run.waiting', payload: { wait } }]);
    runAnswerWaits.expire('run-1');
    await result;

    expect(finishedEndings).toEqual([wait]);
  });

  it('should resolve answered with the permission answer when one is delivered', async () => {
    const result = useCase.execute(buildRun(), {
      kind: 'permission-needed',
      toolName: 'Bash',
      toolInput: { command: 'ls' },
    });
    await Promise.resolve();

    runAnswerWaits.deliver('run-1', { kind: 'permission', decision: 'deny' });

    expect(await result).toEqual({
      kind: 'answered',
      answer: { kind: 'permission', decision: 'deny' },
    });
    expect(runRepository.runs.get('run-1')).not.toHaveProperty('waitingFor');
  });
});
