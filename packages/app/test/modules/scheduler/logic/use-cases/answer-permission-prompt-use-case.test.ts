import { describe, expect, it } from 'vitest';
import type { RunRecord } from '../../../../../src/modules/scheduler/logic/domain/types/run-record.js';
import { PermissionNotAnswerableError } from '../../../../../src/modules/scheduler/logic/errors/permission-not-answerable-error.js';
import type { ProjectLookup } from '../../../../../src/modules/scheduler/logic/ports/project-lookup.js';
import { AnswerPermissionPromptUseCase } from '../../../../../src/modules/scheduler/logic/use-cases/answer-permission-prompt-use-case.js';
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

function buildSubject(projectLookup: ProjectLookup = new FakeProjectLookup()) {
  const ticketStatusWrites = new FakeTicketStatusWrites();
  ticketStatusWrites.liveStatus = 'stuck';
  const runner = new FakeRunnerPort();
  runner.record = permissionRun;
  runner.latest = {
    id: permissionRun.id,
    startedAt: permissionRun.startedAt,
    ...(permissionRun.endedAt === undefined ? {} : { endedAt: permissionRun.endedAt }),
    ...(permissionRun.ending === undefined ? {} : { ending: permissionRun.ending }),
  };
  const events = new FakeEventPublisher();
  const useCase = new AnswerPermissionPromptUseCase({
    ticketStatusWrites,
    runner,
    projectLookup,
    events,
  });
  return { useCase, ticketStatusWrites, runner, events };
}

describe('AnswerPermissionPromptUseCase', () => {
  it.each(['allow', 'deny'] as const)(
    'should set the ticket in-progress, then resume the run when the decision is %s',
    async (decision) => {
      const { useCase, ticketStatusWrites, runner } = buildSubject();

      const resumedRun = await useCase.execute('run-1', decision);

      expect(resumedRun).toEqual({ id: 'run-2', startedAt: '2026-09-29T11:00:00.000Z' });
      expect(ticketStatusWrites.calls).toEqual(['readStatus', 'setStatus #147 -> in-progress']);
      expect(runner.calls).toContain(`resume run-1 ${decision}`);
    },
  );

  it.each([
    [
      'the ticket is no longer stuck',
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
    [
      'another run is active in the project',
      (subject: ReturnType<typeof buildSubject>) => {
        subject.runner.activeTicketNumber = 12;
      },
    ],
  ])('should refuse and write and resume nothing when %s', async (_situation, arrange) => {
    const subject = buildSubject();
    arrange(subject);

    await expect(subject.useCase.execute('run-1', 'allow')).rejects.toThrow(
      PermissionNotAnswerableError,
    );

    expect(subject.ticketStatusWrites.calls.filter((call) => call.startsWith('setStatus'))).toEqual(
      [],
    );
    expect(subject.runner.calls.filter((call) => call.startsWith('resume'))).toEqual([]);
  });

  it('should refuse and write nothing when the project is unknown', async () => {
    const subject = buildSubject({ find: async () => undefined });

    await expect(subject.useCase.execute('run-1', 'allow')).rejects.toThrow(
      PermissionNotAnswerableError,
    );

    expect(subject.ticketStatusWrites.calls).toEqual([]);
  });

  it('should put the ticket back to stuck and rethrow when the runner cannot resume', async () => {
    const { useCase, ticketStatusWrites, runner } = buildSubject();
    const failure = new Error('worktree is gone');
    runner.resumeFailure = failure;

    await expect(useCase.execute('run-1', 'allow')).rejects.toBe(failure);

    expect(ticketStatusWrites.calls).toEqual([
      'readStatus',
      'setStatus #147 -> in-progress',
      'setStatus #147 -> stuck',
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
      const resume = runner.resume.bind(runner);
      runner.resume = async (runId, resumeDecision) => {
        eventsSeenAtResume = events.emittedEvents.length;
        return resume(runId, resumeDecision);
      };

      await useCase.execute('run-1', decision);

      expect(events.emittedEvents).toEqual([written('stuck', 'in-progress')]);
      expect(eventsSeenAtResume).toBe(1);
    },
  );

  it('should announce the rollback after the in-progress write when the runner cannot resume', async () => {
    const { useCase, runner, events } = buildSubject();
    const failure = new Error('worktree is gone');
    runner.resumeFailure = failure;

    await expect(useCase.execute('run-1', 'allow')).rejects.toBe(failure);

    expect(events.emittedEvents).toEqual([
      written('stuck', 'in-progress'),
      written('in-progress', 'stuck'),
    ]);
  });

  it('should announce nothing when the answer is rejected', async () => {
    const { useCase, ticketStatusWrites, events } = buildSubject();
    ticketStatusWrites.liveStatus = 'in-progress';

    await expect(useCase.execute('run-1', 'allow')).rejects.toThrow(PermissionNotAnswerableError);

    expect(events.emittedEvents).toEqual([]);
  });

  it('should announce nothing and not resume when the in-progress write fails', async () => {
    const { useCase, ticketStatusWrites, runner, events } = buildSubject();
    const failure = new Error('gh failed');
    ticketStatusWrites.setStatusFailure = failure;

    await expect(useCase.execute('run-1', 'allow')).rejects.toBe(failure);

    expect(events.emittedEvents).toEqual([]);
    expect(runner.calls.filter((call) => call.startsWith('resume'))).toEqual([]);
  });
});
