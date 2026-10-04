import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { RunAnswer } from '../../../../../src/modules/runner/logic/domain/types/run-answer.js';
import { buildCheckpointResumePrompt } from '../../../../../src/modules/runner/logic/domain/functions/build-checkpoint-resume-prompt.js';
import type { RunEnding } from '../../../../../src/modules/runner/logic/domain/types/run-ending.js';
import { RunAlreadyActiveError } from '../../../../../src/modules/runner/logic/errors/run-already-active-error.js';
import { RunNotResumableError } from '../../../../../src/modules/runner/logic/errors/run-not-resumable-error.js';
import { FinishRunUseCase } from '../../../../../src/modules/runner/logic/use-cases/finish-run-use-case.js';
import { LaunchRunSessionUseCase } from '../../../../../src/modules/runner/logic/use-cases/launch-run-session-use-case.js';
import { ResumeRunUseCase } from '../../../../../src/modules/runner/logic/use-cases/resume-run-use-case.js';
import { FakeClock } from '../../../../fakes/fake-clock.js';
import { FakeEventPublisher } from '../../../../fakes/fake-event-publisher.js';
import {
  buildRun,
  FakeAgentSessions,
  FakeRecentRunSteps,
  FakeRunRepository,
  SequentialIdentifiers,
} from '../../fakes/fake-runner-ports.js';

const allow: RunAnswer = { kind: 'permission', decision: 'allow' };
const deny: RunAnswer = { kind: 'permission', decision: 'deny' };
const checkpointEnding: RunEnding = { kind: 'checkpoint', request: 'Check the page' };
const permissionNeeded: RunEnding = {
  kind: 'permission-needed',
  toolName: 'Bash',
  toolInput: { command: 'git push' },
};

describe('ResumeRunUseCase', () => {
  let runRepository: FakeRunRepository;
  let agentSessions: FakeAgentSessions;
  let recentRunSteps: FakeRecentRunSteps;
  let logger: { info: Mock; warn: Mock; error: Mock };
  let resumeRun: ResumeRunUseCase;

  async function insertEndedRun(overrides = {}): Promise<void> {
    await runRepository.insert(
      buildRun({
        id: 'run-1',
        state: 'ended',
        ending: permissionNeeded,
        endedAt: '2026-09-29T10:05:00.000Z',
        ...overrides,
      }),
    );
  }

  beforeEach(() => {
    runRepository = new FakeRunRepository();
    agentSessions = new FakeAgentSessions();
    recentRunSteps = new FakeRecentRunSteps();
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const clock = new FakeClock('2026-09-29T11:00:00.000Z');
    const events = new FakeEventPublisher();
    const finishRun = (runId: string, ending: RunEnding) =>
      new FinishRunUseCase({ runRepository, agentSessions, clock, events }).execute(runId, ending);
    const launchRunSession = new LaunchRunSessionUseCase({
      agentSessions,
      recentRunSteps,
      finishRun,
      tools: [],
      logger,
    });
    resumeRun = new ResumeRunUseCase({
      runRepository,
      identifiers: new SequentialIdentifiers(),
      clock,
      launchRunSession: (run, launch) => launchRunSession.execute(run, launch),
    });
  });

  it('should insert a running run for the same ticket, worktree and session when the run needs permission', async () => {
    await insertEndedRun();

    const resumed = await resumeRun.execute('run-1', allow);

    expect(resumed).toEqual({
      id: 'id-1',
      projectId: 'moritz/aisf',
      ticketNumber: 137,
      stage: 'implement',
      mode: 'afk',
      sessionId: 'session-1',
      worktreePath: '/worktrees/aisf/137',
      branchName: 'aisf/137-runner',
      state: 'running',
      startedAt: '2026-09-29T11:00:00.000Z',
    });
    expect(runRepository.runs.get('id-1')).toEqual(resumed);
  });

  it('should resume the session with the call allowed once when the decision is allow', async () => {
    await insertEndedRun();

    await resumeRun.execute('run-1', allow);

    expect(agentSessions.startedSpecs).toEqual([]);
    expect(agentSessions.resumedSpecs).toHaveLength(1);
    expect(agentSessions.resumedSpecs[0]).toMatchObject({
      sessionId: 'session-1',
      worktreePath: '/worktrees/aisf/137',
      model: 'sonnet',
      allowedCall: { toolName: 'Bash', toolInput: { command: 'git push' } },
    });
    expect(agentSessions.resumedSpecs[0]?.prompt).toContain('allowed');
  });

  it('should resume the session without an allowed call and tell it the call was refused when the decision is deny', async () => {
    await insertEndedRun();

    await resumeRun.execute('run-1', deny);

    expect(agentSessions.resumedSpecs).toHaveLength(1);
    expect(agentSessions.resumedSpecs[0]?.prompt).toContain('refused');
    expect(agentSessions.resumedSpecs[0]).not.toHaveProperty('allowedCall');
  });

  it('should resume a settled run when its ending was permission-needed', async () => {
    await insertEndedRun({ state: 'settled' });

    await resumeRun.execute('run-1', allow);

    expect(agentSessions.resumedSpecs).toHaveLength(1);
  });

  it.each([
    ['the run is unknown', async () => undefined],
    [
      'the run ended another way',
      () => insertEndedRun({ ending: { kind: 'crashed', reason: 'boom' } }),
    ],
    ['the run is still running', () => insertEndedRun({ state: 'running', ending: undefined })],
    [
      'a newer run exists for the ticket',
      async () => {
        await insertEndedRun();
        await runRepository.insert(
          buildRun({
            id: 'run-2',
            state: 'ended',
            ending: { kind: 'finished' },
            startedAt: '2026-09-29T10:30:00.000Z',
          }),
        );
      },
    ],
  ])(
    'should throw RunNotResumableError and change nothing when %s',
    async (_situation, arrange) => {
      await arrange();
      const runCountBefore = runRepository.runs.size;

      await expect(resumeRun.execute('run-1', allow)).rejects.toThrow(RunNotResumableError);

      expect(runRepository.runs.size).toBe(runCountBefore);
      expect(agentSessions.resumedSpecs).toEqual([]);
    },
  );

  it('should throw RunAlreadyActiveError and resume nothing when the ticket already has a running run', async () => {
    await insertEndedRun();
    await runRepository.insert(buildRun({ id: 'other-run' }));

    await expect(resumeRun.execute('run-1', allow)).rejects.toThrow(RunAlreadyActiveError);

    expect(agentSessions.resumedSpecs).toEqual([]);
  });

  it('should record the resumed steps and the ending on the new run when the session carries on', async () => {
    await insertEndedRun();
    await resumeRun.execute('run-1', allow);

    agentSessions.push('session-1', {
      kind: 'step',
      step: { at: '2026-09-29T11:01:00.000Z', summary: 'Ran git push' },
    });
    agentSessions.push('session-1', { kind: 'completed' });
    await vi.waitFor(() => {
      expect(runRepository.runs.get('id-1')?.ending).toEqual({ kind: 'finished' });
    });

    expect(recentRunSteps.read('id-1')).toEqual([
      { at: '2026-09-29T11:01:00.000Z', summary: 'Ran git push' },
    ]);
    expect(runRepository.runs.get('run-1')?.ending).toEqual(permissionNeeded);
  });

  it('should end the new run as permission-needed when the resumed session needs another permission', async () => {
    await insertEndedRun();
    await resumeRun.execute('run-1', allow);

    agentSessions.push('session-1', {
      kind: 'permission-needed',
      toolName: 'Bash',
      toolInput: { command: 'rm -rf build' },
    });
    await vi.waitFor(() => {
      expect(runRepository.runs.get('id-1')?.ending).toEqual({
        kind: 'permission-needed',
        toolName: 'Bash',
        toolInput: { command: 'rm -rf build' },
      });
    });
  });

  describe('with a checkpoint answer', () => {
    const answer: RunAnswer = { kind: 'checkpoint', text: 'Looks right' };

    it.each(['ended', 'settled'])(
      'should resume the same session with the checkpoint prompt and no allowed call when the run is %s',
      async (state) => {
        await insertEndedRun({ state, ending: checkpointEnding });

        const resumed = await resumeRun.execute('run-1', answer);

        expect(resumed).toMatchObject({
          id: 'id-1',
          state: 'running',
          sessionId: 'session-1',
          worktreePath: '/worktrees/aisf/137',
          branchName: 'aisf/137-runner',
        });
        expect(runRepository.runs.get('id-1')).toEqual(resumed);
        expect(agentSessions.resumedSpecs).toHaveLength(1);
        expect(agentSessions.resumedSpecs[0]?.prompt).toBe(
          buildCheckpointResumePrompt(
            137,
            'Check the page',
            'Looks right',
            'aisf:implement-ticket',
          ),
        );
        expect(agentSessions.resumedSpecs[0]).not.toHaveProperty('allowedCall');
      },
    );

    it('should tell a spike run to carry on with aisf:spike when it resumes after a checkpoint', async () => {
      await insertEndedRun({ stage: 'spike', ending: checkpointEnding });

      await resumeRun.execute('run-1', answer);

      expect(agentSessions.resumedSpecs[0]?.prompt).toContain(
        'Carry on with aisf:spike for #137 from its human checkpoint.',
      );
    });

    it.each([
      ['a permission-needed ending', { ending: permissionNeeded }],
      ['a finished ending', { ending: { kind: 'finished' } }],
    ])('should throw RunNotResumableError when the run has %s', async (_name, overrides) => {
      await insertEndedRun(overrides);

      await expect(resumeRun.execute('run-1', answer)).rejects.toThrow(RunNotResumableError);

      expect(runRepository.runs.size).toBe(1);
      expect(agentSessions.resumedSpecs).toEqual([]);
    });

    it('should throw RunNotResumableError when the run is unknown', async () => {
      await expect(resumeRun.execute('missing-run', answer)).rejects.toThrow(RunNotResumableError);
    });

    it('should throw RunNotResumableError when a newer run exists', async () => {
      await insertEndedRun({ ending: checkpointEnding });
      await runRepository.insert(
        buildRun({
          id: 'run-2',
          state: 'ended',
          ending: { kind: 'finished' },
          startedAt: '2026-09-29T10:30:00.000Z',
        }),
      );

      await expect(resumeRun.execute('run-1', answer)).rejects.toThrow(RunNotResumableError);
      expect(agentSessions.resumedSpecs).toEqual([]);
    });

    it('should throw RunAlreadyActiveError when another run is running', async () => {
      await insertEndedRun({ ending: checkpointEnding });
      await runRepository.insert(buildRun({ id: 'other-run' }));

      await expect(resumeRun.execute('run-1', answer)).rejects.toThrow(RunAlreadyActiveError);
      expect(agentSessions.resumedSpecs).toEqual([]);
    });
  });

  it.each([['a checkpoint run', checkpointEnding]])(
    'should throw RunNotResumableError when a permission answer meets %s',
    async (_n, ending) => {
      await insertEndedRun({ ending });

      await expect(resumeRun.execute('run-1', allow)).rejects.toThrow(RunNotResumableError);
      expect(runRepository.runs.size).toBe(1);
      expect(agentSessions.resumedSpecs).toEqual([]);
    },
  );
});
