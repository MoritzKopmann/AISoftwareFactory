import { describe, expect, it } from 'vitest';
import type { RunRecord } from '../../../../../src/modules/scheduler/logic/domain/types/run-record.js';
import { RunNotAnswerableError } from '../../../../../src/modules/scheduler/logic/errors/run-not-answerable-error.js';
import type { RunAnswer } from '../../../../../src/modules/scheduler/logic/domain/types/run-answer.js';
import type { ProjectLookup } from '../../../../../src/modules/scheduler/logic/ports/project-lookup.js';
import { AnswerRunUseCase } from '../../../../../src/modules/scheduler/logic/use-cases/answer-run-use-case.js';
import { FakeEventPublisher } from '../../../../fakes/fake-event-publisher.js';
import {
  FakeProjectLookup,
  FakeRunnerPort,
  FakeTicketStatusWrites,
} from '../../fakes/fake-scheduler-ports.js';

const permissionRun: RunRecord = {
  id: 'run-1',
  projectId: 'moritz/aisf',
  ticketNumber: 147,
  startedAt: '2026-09-29T09:00:00.000Z',
  endedAt: '2026-09-29T09:30:00.000Z',
  ending: { kind: 'permission-needed', toolName: 'Bash', toolInput: { command: 'git push' } },
};

const checkpointRun: RunRecord = {
  ...permissionRun,
  ending: { kind: 'checkpoint', request: 'Check the login page' },
};
const allowAnswer: RunAnswer = { kind: 'permission', decision: 'allow' };
const checkpointAnswer: RunAnswer = { kind: 'checkpoint', text: 'Looks good' };

function buildSubject(
  projectLookup: ProjectLookup = new FakeProjectLookup(),
  run: RunRecord = permissionRun,
) {
  const ticketStatusWrites = new FakeTicketStatusWrites();
  ticketStatusWrites.liveStatus = 'waiting';
  const runner = new FakeRunnerPort();
  runner.record = run;
  runner.latest = {
    id: run.id,
    startedAt: run.startedAt,
    ...(run.endedAt === undefined ? {} : { endedAt: run.endedAt }),
    ...(run.ending === undefined ? {} : { ending: run.ending }),
  };
  const events = new FakeEventPublisher();
  const useCase = new AnswerRunUseCase({
    ticketStatusWrites,
    runner,
    projectLookup,
    events,
  });
  return { useCase, ticketStatusWrites, runner, events };
}

describe('AnswerRunUseCase', () => {
  it('should set the ticket in-progress, then resume the run when the answer is a checkpoint answer', async () => {
    const { useCase, ticketStatusWrites, runner } = buildSubject(undefined, checkpointRun);

    const resumedRun = await useCase.execute('run-1', checkpointAnswer);

    expect(resumedRun).toEqual({ id: 'run-2', startedAt: '2026-09-29T11:00:00.000Z' });
    expect(ticketStatusWrites.calls).toEqual(['readStatus', 'setStatus #147 -> in-progress']);
    expect(runner.calls).toContain(`answer run-1 ${JSON.stringify(checkpointAnswer)}`);
  });

  describe('live wait', () => {
    const liveRun: RunRecord = {
      id: 'run-1',
      projectId: 'moritz/aisf',
      ticketNumber: 147,
      startedAt: '2026-09-29T09:00:00.000Z',
      waitingFor: { kind: 'checkpoint', request: 'Pick A or B' },
    };

    it('should set in-progress, announce it and return the run runner.answer returned when the run waits live', async () => {
      const { useCase, ticketStatusWrites, runner, events } = buildSubject(undefined, liveRun);

      const result = await useCase.execute('run-1', checkpointAnswer);

      expect(result).toEqual({ id: 'run-2', startedAt: '2026-09-29T11:00:00.000Z' });
      expect(ticketStatusWrites.calls).toEqual(['readStatus', 'setStatus #147 -> in-progress']);
      expect(runner.calls.filter((call) => call.startsWith('answer'))).toEqual([
        `answer run-1 ${JSON.stringify(checkpointAnswer)}`,
      ]);
      expect(events.emittedEvents).toEqual([written('waiting', 'in-progress')]);
    });

    it('should answer two waiting runs of one project when each is active', async () => {
      const first = buildSubject(undefined, liveRun);
      first.runner.activeTicketNumbers = [147, 148];
      const second = buildSubject(undefined, {
        ...liveRun,
        id: 'run-2',
        ticketNumber: 148,
      });
      second.runner.activeTicketNumbers = [147, 148];

      await expect(first.useCase.execute('run-1', checkpointAnswer)).resolves.toBeDefined();
      await expect(second.useCase.execute('run-2', checkpointAnswer)).resolves.toBeDefined();
    });

    it('should refuse and write nothing when the run neither ended nor waits', async () => {
      const working: RunRecord = {
        id: liveRun.id,
        projectId: liveRun.projectId,
        ticketNumber: liveRun.ticketNumber,
        startedAt: liveRun.startedAt,
      };
      const subject = buildSubject(undefined, working);

      await expect(subject.useCase.execute('run-1', checkpointAnswer)).rejects.toThrow(
        RunNotAnswerableError,
      );

      expect(subject.ticketStatusWrites.calls.filter((c) => c.startsWith('setStatus'))).toEqual([]);
      expect(subject.runner.calls.filter((c) => c.startsWith('answer'))).toEqual([]);
    });

    it('should refuse and write nothing when a permission answer meets a live checkpoint wait', async () => {
      const subject = buildSubject(undefined, liveRun);

      await expect(subject.useCase.execute('run-1', allowAnswer)).rejects.toThrow(
        RunNotAnswerableError,
      );

      expect(subject.ticketStatusWrites.calls.filter((c) => c.startsWith('setStatus'))).toEqual([]);
      expect(subject.runner.calls.filter((c) => c.startsWith('answer'))).toEqual([]);
    });

    it('should refuse with a not-waiting message when the ticket is still in-progress', async () => {
      const subject = buildSubject(undefined, liveRun);
      subject.ticketStatusWrites.liveStatus = 'in-progress';

      await expect(subject.useCase.execute('run-1', checkpointAnswer)).rejects.toThrow(
        '#147 is not waiting',
      );

      expect(subject.ticketStatusWrites.calls.filter((c) => c.startsWith('setStatus'))).toEqual([]);
    });

    it('should restore waiting and rethrow when delivery fails', async () => {
      const { useCase, runner, events, ticketStatusWrites } = buildSubject(undefined, liveRun);
      const failure = new RunNotAnswerableError('expired');
      runner.answerFailure = failure;

      await expect(useCase.execute('run-1', checkpointAnswer)).rejects.toBe(failure);

      expect(ticketStatusWrites.liveStatus).toBe('waiting');
      expect(events.emittedEvents).toEqual([
        written('waiting', 'in-progress'),
        written('in-progress', 'waiting'),
      ]);
    });
  });

  it.each(['allow', 'deny'] as const)(
    'should set the ticket in-progress, then resume the run when the decision is %s',
    async (decision) => {
      const { useCase, ticketStatusWrites, runner } = buildSubject();

      const resumedRun = await useCase.execute('run-1', { kind: 'permission', decision });

      expect(resumedRun).toEqual({ id: 'run-2', startedAt: '2026-09-29T11:00:00.000Z' });
      expect(ticketStatusWrites.calls).toEqual(['readStatus', 'setStatus #147 -> in-progress']);
      expect(runner.calls).toContain(
        `answer run-1 ${JSON.stringify({ kind: 'permission', decision })}`,
      );
    },
  );

  it.each([
    [
      'the ticket is no longer waiting',
      (subject: ReturnType<typeof buildSubject>) => {
        subject.ticketStatusWrites.liveStatus = 'in-progress';
      },
    ],
    [
      'the run did not end needing permission',
      (subject: ReturnType<typeof buildSubject>) => {
        subject.runner.record = { ...permissionRun, ending: { kind: 'finished' } };
      },
    ],
    [
      'the run is unknown',
      (subject: ReturnType<typeof buildSubject>) => {
        subject.runner.record = undefined;
      },
    ],
    [
      'a newer run exists for the ticket',
      (subject: ReturnType<typeof buildSubject>) => {
        subject.runner.latest = { id: 'run-9', startedAt: '2026-09-29T10:00:00.000Z' };
      },
    ],
  ])('should refuse and write and resume nothing when %s', async (_situation, arrange) => {
    const subject = buildSubject();
    arrange(subject);

    await expect(subject.useCase.execute('run-1', allowAnswer)).rejects.toThrow(
      RunNotAnswerableError,
    );

    expect(subject.ticketStatusWrites.calls.filter((call) => call.startsWith('setStatus'))).toEqual(
      [],
    );
    expect(subject.runner.calls.filter((call) => call.startsWith('answer'))).toEqual([]);
  });

  it('should refuse and write nothing when the project is unknown', async () => {
    const subject = buildSubject({ find: async () => undefined });

    await expect(subject.useCase.execute('run-1', allowAnswer)).rejects.toThrow(
      RunNotAnswerableError,
    );

    expect(subject.ticketStatusWrites.calls).toEqual([]);
  });

  it('should put the ticket back to waiting and rethrow when the runner cannot resume', async () => {
    const { useCase, ticketStatusWrites, runner } = buildSubject();
    const failure = new Error('worktree is gone');
    runner.answerFailure = failure;

    await expect(useCase.execute('run-1', allowAnswer)).rejects.toBe(failure);

    expect(ticketStatusWrites.calls).toEqual([
      'readStatus',
      'setStatus #147 -> in-progress',
      'setStatus #147 -> waiting',
    ]);
  });

  const written = (from: string, to: string) => ({
    name: 'ticket.status-written',
    payload: { projectId: 'moritz/aisf', ticketNumber: 147, from, to },
  });

  it.each(['allow', 'deny'] as const)(
    'should announce the in-progress write before resuming when the decision is %s',
    async (decision) => {
      const { useCase, runner, events } = buildSubject();
      let eventsSeenAtResume = -1;
      const resume = runner.answer.bind(runner);
      runner.answer = async (runId, resumeAnswer) => {
        eventsSeenAtResume = events.emittedEvents.length;
        return resume(runId, resumeAnswer);
      };

      await useCase.execute('run-1', { kind: 'permission', decision });

      expect(events.emittedEvents).toEqual([written('waiting', 'in-progress')]);
      expect(eventsSeenAtResume).toBe(1);
    },
  );

  it('should announce the rollback after the in-progress write when the runner cannot resume', async () => {
    const { useCase, runner, events } = buildSubject();
    const failure = new Error('worktree is gone');
    runner.answerFailure = failure;

    await expect(useCase.execute('run-1', allowAnswer)).rejects.toBe(failure);

    expect(events.emittedEvents).toEqual([
      written('waiting', 'in-progress'),
      written('in-progress', 'waiting'),
    ]);
  });

  it('should announce nothing when the answer is rejected', async () => {
    const { useCase, ticketStatusWrites, events } = buildSubject();
    ticketStatusWrites.liveStatus = 'in-progress';

    await expect(useCase.execute('run-1', allowAnswer)).rejects.toThrow(RunNotAnswerableError);

    expect(events.emittedEvents).toEqual([]);
  });

  it('should announce nothing and not resume when the in-progress write fails', async () => {
    const { useCase, ticketStatusWrites, runner, events } = buildSubject();
    const failure = new Error('gh failed');
    ticketStatusWrites.setStatusFailure = failure;

    await expect(useCase.execute('run-1', allowAnswer)).rejects.toBe(failure);

    expect(events.emittedEvents).toEqual([]);
    expect(runner.calls.filter((call) => call.startsWith('answer'))).toEqual([]);
  });

  it.each<[string, RunAnswer]>([['a checkpoint answer to a permission run', checkpointAnswer]])(
    'should refuse and write nothing when the pair is %s',
    async (_name, answer) => {
      const subject = buildSubject();

      await expect(subject.useCase.execute('run-1', answer)).rejects.toThrow(RunNotAnswerableError);

      expect(
        subject.ticketStatusWrites.calls.filter((call) => call.startsWith('setStatus')),
      ).toEqual([]);
      expect(subject.runner.calls.filter((call) => call.startsWith('answer'))).toEqual([]);
    },
  );

  it('should refuse and write nothing when a permission answer meets a checkpoint run', async () => {
    const subject = buildSubject(undefined, checkpointRun);

    await expect(subject.useCase.execute('run-1', allowAnswer)).rejects.toThrow(
      RunNotAnswerableError,
    );

    expect(subject.ticketStatusWrites.calls.filter((call) => call.startsWith('setStatus'))).toEqual(
      [],
    );
    expect(subject.runner.calls.filter((call) => call.startsWith('answer'))).toEqual([]);
  });

  it('should refuse and write nothing when a checkpoint answer comes before the ticket is waiting', async () => {
    const subject = buildSubject(undefined, checkpointRun);
    subject.ticketStatusWrites.liveStatus = 'in-progress';

    await expect(subject.useCase.execute('run-1', checkpointAnswer)).rejects.toThrow(
      RunNotAnswerableError,
    );

    expect(subject.ticketStatusWrites.calls.filter((call) => call.startsWith('setStatus'))).toEqual(
      [],
    );
    expect(subject.runner.calls.filter((call) => call.startsWith('answer'))).toEqual([]);
  });

  it('should refuse a checkpoint answer when the run has no ending', async () => {
    const subject = buildSubject(undefined, checkpointRun);
    subject.runner.record = {
      id: checkpointRun.id,
      projectId: checkpointRun.projectId,
      ticketNumber: checkpointRun.ticketNumber,
      startedAt: checkpointRun.startedAt,
    };

    await expect(subject.useCase.execute('run-1', checkpointAnswer)).rejects.toThrow(
      RunNotAnswerableError,
    );
  });

  it.each([
    ['unknown run', (s: ReturnType<typeof buildSubject>) => (s.runner.record = undefined)],
    [
      'newer run',
      (s: ReturnType<typeof buildSubject>) =>
        (s.runner.latest = { id: 'run-9', startedAt: '2026-09-29T10:00:00.000Z' }),
    ],
  ])('should refuse a checkpoint answer when there is a %s', async (_name, arrange) => {
    const subject = buildSubject(undefined, checkpointRun);
    arrange(subject);

    await expect(subject.useCase.execute('run-1', checkpointAnswer)).rejects.toThrow(
      RunNotAnswerableError,
    );

    expect(subject.ticketStatusWrites.calls).toEqual([]);
    expect(subject.runner.calls.filter((call) => call.startsWith('answer'))).toEqual([]);
  });

  it('should refuse a checkpoint answer when the project is unknown', async () => {
    const subject = buildSubject({ find: async () => undefined }, checkpointRun);

    await expect(subject.useCase.execute('run-1', checkpointAnswer)).rejects.toThrow(
      RunNotAnswerableError,
    );

    expect(subject.ticketStatusWrites.calls).toEqual([]);
  });

  it('should put the ticket back to waiting and rethrow when a checkpoint resume fails', async () => {
    const { useCase, ticketStatusWrites, runner } = buildSubject(undefined, checkpointRun);
    const failure = new Error('worktree is gone');
    runner.answerFailure = failure;

    await expect(useCase.execute('run-1', checkpointAnswer)).rejects.toBe(failure);

    expect(ticketStatusWrites.calls).toEqual([
      'readStatus',
      'setStatus #147 -> in-progress',
      'setStatus #147 -> waiting',
    ]);
  });

  it('should announce waiting rollback events when a checkpoint resume fails', async () => {
    const { useCase, runner, events } = buildSubject(undefined, checkpointRun);
    runner.answerFailure = new Error('worktree is gone');

    await expect(useCase.execute('run-1', checkpointAnswer)).rejects.toThrow();

    expect(events.emittedEvents).toEqual([
      written('waiting', 'in-progress'),
      written('in-progress', 'waiting'),
    ]);
  });

  it('should not put the answer text in the refusal message', async () => {
    const subject = buildSubject(undefined, checkpointRun);
    subject.ticketStatusWrites.liveStatus = 'in-progress';
    const secret: RunAnswer = { kind: 'checkpoint', text: 'secret-answer-text' };

    const failure = await subject.useCase.execute('run-1', secret).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(RunNotAnswerableError);
    expect((failure as Error).message).not.toContain('secret-answer-text');
  });
});
