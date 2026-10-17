import { describe, expect, it } from 'vitest';
import type { RunAnswer } from '../domain/types/run-answer.js';
import type { RunRecord } from '../domain/types/run-record.js';
import type { RunsBlocked } from '../domain/types/runs-blocked.js';
import { IdeaRunNotStartedError } from '../errors/idea-run-not-started-error.js';
import { ProjectNotFoundError } from '../errors/project-not-found-error.js';
import { RunNotAnswerableError } from '../errors/run-not-answerable-error.js';
import { RunNotAvailableError } from '../errors/run-not-available-error.js';
import type { ProjectPort, SchedulerProject } from '../port/project/project-port.js';
import {
  FakeProjectPort,
  FakeRunPort,
  FakeSkillPort,
  FakeTicketPort,
  readyLeaf,
  repository,
} from '../../testing/fake-scheduler-ports.js';
import { TicketRunService } from './ticket-run-service.js';

const startedAt = '2026-09-29T09:00:00.000Z';
const endedAt = '2026-09-29T09:30:00.000Z';

function buildSubject(
  options: {
    runPort?: FakeRunPort;
    ticketPort?: FakeTicketPort;
    skillPort?: FakeSkillPort;
    projectPort?: ProjectPort;
  } = {},
) {
  const runPort = options.runPort ?? new FakeRunPort();
  const ticketPort = options.ticketPort ?? new FakeTicketPort(readyLeaf);
  const service = new TicketRunService({
    ticketPort,
    runPort,
    skillPort: options.skillPort ?? new FakeSkillPort(),
    projectPort: options.projectPort ?? new FakeProjectPort(),
  });
  return { service, runPort, ticketPort };
}

const ideaTicket = { ...readyLeaf, number: 501, status: 'idea' as const };

function buildIdeaSubject(
  options: {
    project?: SchedulerProject | undefined;
    runsBlocked?: RunsBlocked;
    ticket?: typeof ideaTicket | undefined;
  } = {},
) {
  const runPort = new FakeRunPort();
  const project =
    'project' in options ? options.project : { repository, onboarded: true, paused: false };
  const subject = buildSubject({
    runPort,
    projectPort: { find: async () => project },
    skillPort: new FakeSkillPort(options.runsBlocked),
    ticketPort: new FakeTicketPort('ticket' in options ? options.ticket : ideaTicket),
  });
  return { service: subject.service, runPort, ticketPort: subject.ticketPort };
}

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

const liveRun: RunRecord = {
  id: 'run-1',
  projectId: 'moritz/aisf',
  ticketNumber: 147,
  startedAt: '2026-09-29T09:00:00.000Z',
  waitingFor: { kind: 'checkpoint', request: 'Pick A or B' },
};

const allowAnswer: RunAnswer = { kind: 'permission', decision: 'allow' };
const checkpointAnswer: RunAnswer = { kind: 'checkpoint', text: 'Looks good' };

function buildAnswerSubject(run: RunRecord = permissionRun) {
  const runPort = new FakeRunPort();
  runPort.record = run;
  runPort.latest = {
    id: run.id,
    startedAt: run.startedAt,
    ...(run.endedAt === undefined ? {} : { endedAt: run.endedAt }),
    ...(run.ending === undefined ? {} : { ending: run.ending }),
  };
  const { service, ticketPort } = buildSubject({ runPort });
  return { service, ticketPort, runPort };
}

function answersOf(runPort: FakeRunPort): string[] {
  return runPort.calls.filter((call) => call.startsWith('answer'));
}

describe('TicketRunService', () => {
  describe('readAvailability', () => {
    it('should be available when the ticket is a ready leaf and nothing prevents a run', async () => {
      expect(await buildSubject().service.readAvailability('moritz/aisf', 138)).toEqual({
        kind: 'available',
      });
    });

    it('should be absent when the ticket is unknown', async () => {
      const { service } = buildSubject({ ticketPort: new FakeTicketPort(undefined) });

      expect(await service.readAvailability('moritz/aisf', 138)).toEqual({ kind: 'absent' });
    });

    it('should be disabled naming the ticket when it already has a run active', async () => {
      const runPort = new FakeRunPort();
      runPort.activeTicketNumbers = [138];

      expect(await buildSubject({ runPort }).service.readAvailability('moritz/aisf', 138)).toEqual({
        kind: 'disabled',
        reason: '#138 is running',
      });
    });

    it('should be available when only another ticket has a run active', async () => {
      const runPort = new FakeRunPort();
      runPort.activeTicketNumbers = [42];

      expect(await buildSubject({ runPort }).service.readAvailability('moritz/aisf', 138)).toEqual({
        kind: 'available',
      });
    });

    it('should be disabled with the reason when runs are blocked', async () => {
      const { service } = buildSubject({
        skillPort: new FakeSkillPort({ blocked: true, reason: 'Not logged in' }),
      });

      expect(await service.readAvailability('moritz/aisf', 138)).toEqual({
        kind: 'disabled',
        reason: 'Not logged in',
      });
    });

    it('should be disabled when the project is not onboarded', async () => {
      const { service } = buildSubject({
        projectPort: new FakeProjectPort({ repository, onboarded: false, paused: false }),
      });

      expect(await service.readAvailability('moritz/aisf', 138)).toEqual({
        kind: 'disabled',
        reason: 'The project is not onboarded',
      });
    });

    it("should be disabled when the snapshot predates the ticket's last run end", async () => {
      const runPort = new FakeRunPort();
      runPort.latest = {
        id: 'run-0',
        startedAt: '2026-09-29T10:00:00.000Z',
        endedAt: '2026-09-29T10:05:00.000Z',
        ending: { kind: 'finished' },
      };

      expect(await buildSubject({ runPort }).service.readAvailability('moritz/aisf', 138)).toEqual({
        kind: 'disabled',
        reason: 'Waiting for GitHub to catch up',
      });
    });

    it('should be disabled naming the spike when a plan ticket has an open spike sub-issue', async () => {
      const ticket = { ...readyLeaf, status: 'plan' as const, isLeaf: false, subIssueNumbers: [9] };
      const spike = { ...readyLeaf, number: 9, types: ['spike' as const] };
      const { service } = buildSubject({ ticketPort: new FakeTicketPort(ticket, [spike]) });

      expect(await service.readAvailability('moritz/aisf', 138)).toEqual({
        kind: 'disabled',
        reason: 'Waiting for spike #9',
      });
    });
  });

  describe('readTicketRun', () => {
    it('should return only the availability when the ticket never ran', async () => {
      const { service } = buildSubject({
        skillPort: new FakeSkillPort({ blocked: true, reason: 'Not logged in' }),
      });

      expect(await service.readTicketRun('moritz/aisf', 138)).toEqual({
        availability: { kind: 'disabled', reason: 'Not logged in' },
      });
    });

    it('should return the active run when the active run is this ticket', async () => {
      const runPort = new FakeRunPort();
      runPort.activeTicketNumbers = [138];

      expect(await buildSubject({ runPort }).service.readTicketRun('moritz/aisf', 138)).toEqual({
        availability: { kind: 'disabled', reason: '#138 is running' },
        activeRun: { id: 'run-1', startedAt },
      });
    });

    it('should copy waitingFor when the active run waits live', async () => {
      const runPort = new FakeRunPort();
      runPort.activeTicketNumbers = [138];
      runPort.activeWaitingFor = { kind: 'checkpoint', request: 'Pick A or B' };

      const ticketRun = await buildSubject({ runPort }).service.readTicketRun('moritz/aisf', 138);

      expect(ticketRun.activeRun?.waitingFor).toEqual({
        kind: 'checkpoint',
        request: 'Pick A or B',
      });
    });

    it('should show the page of the wait when the checkpoint wait carries one', async () => {
      const runPort = new FakeRunPort();
      runPort.activeTicketNumbers = [12];
      runPort.activeWaitingFor = {
        kind: 'checkpoint',
        request: 'Answer',
        artifactId: 'plan-12',
        page: { title: 'Plan 12', url: '/a/T/' },
      };

      const ticketRun = await buildSubject({ runPort }).service.readTicketRun('moritz/aisf', 12);

      expect(ticketRun.activeRun?.waitingFor).toEqual({
        kind: 'checkpoint',
        request: 'Answer',
        artifactId: 'plan-12',
        page: { title: 'Plan 12', url: '/a/T/' },
      });
    });

    it('should show no page when the checkpoint wait has none', async () => {
      const runPort = new FakeRunPort();
      runPort.activeTicketNumbers = [12];
      runPort.activeWaitingFor = { kind: 'checkpoint', request: 'Answer' };

      const ticketRun = await buildSubject({ runPort }).service.readTicketRun('moritz/aisf', 12);

      expect(ticketRun.activeRun?.waitingFor).not.toHaveProperty('page');
    });

    it('should copy waitingSince when the active run waits', async () => {
      const runPort = new FakeRunPort();
      runPort.activeTicketNumbers = [138];
      runPort.activeWaitingFor = {
        kind: 'permission-needed',
        toolName: 'Bash',
        toolInput: {},
      };
      runPort.activeWaitingSince = '2026-10-07T10:00:00.000Z';

      const ticketRun = await buildSubject({ runPort }).service.readTicketRun('moritz/aisf', 138);

      expect(ticketRun.activeRun?.waitingSince).toBe('2026-10-07T10:00:00.000Z');
    });

    it('should leave out waitingFor when the active run is working', async () => {
      const runPort = new FakeRunPort();
      runPort.activeTicketNumbers = [138];

      const ticketRun = await buildSubject({ runPort }).service.readTicketRun('moritz/aisf', 138);

      expect(ticketRun.activeRun).not.toHaveProperty('waitingFor');
    });

    it('should leave out the active run when the active run is another ticket', async () => {
      const runPort = new FakeRunPort();
      runPort.activeTicketNumbers = [42];

      const ticketRun = await buildSubject({ runPort }).service.readTicketRun('moritz/aisf', 138);

      expect(ticketRun.activeRun).toBeUndefined();
    });

    it('should return the last run when the latest run has an ending and an end time', async () => {
      const runPort = new FakeRunPort();
      runPort.latest = {
        id: 'run-0',
        startedAt,
        endedAt,
        ending: { kind: 'escalated', escalation: 'spec', reason: 'AC 2 is unclear' },
      };

      const ticketRun = await buildSubject({ runPort }).service.readTicketRun('moritz/aisf', 138);

      expect(ticketRun.lastRun).toEqual({
        id: 'run-0',
        startedAt,
        endedAt,
        ending: { kind: 'escalated', escalation: 'spec', reason: 'AC 2 is unclear' },
      });
    });

    it('should leave out the last run when the latest run has not ended', async () => {
      const runPort = new FakeRunPort();
      runPort.latest = { id: 'run-0', startedAt };

      const ticketRun = await buildSubject({ runPort }).service.readTicketRun('moritz/aisf', 138);

      expect(ticketRun.lastRun).toBeUndefined();
    });

    it('should leave out the last run when the latest run has an end time but no ending', async () => {
      const runPort = new FakeRunPort();
      runPort.latest = { id: 'run-0', startedAt, endedAt };

      const ticketRun = await buildSubject({ runPort }).service.readTicketRun('moritz/aisf', 138);

      expect(ticketRun.lastRun).toBeUndefined();
    });
  });

  describe('start', () => {
    it('should start the run on agent runs when the run is available', async () => {
      const runPort = new FakeRunPort();

      await buildSubject({ runPort }).service.start('moritz/aisf', 138);

      expect(runPort.calls).toEqual(['start moritz/aisf #138']);
    });

    it('should pass the ticket title, status and types to agent runs when the run starts', async () => {
      const runPort = new FakeRunPort();
      const ticketPort = new FakeTicketPort({
        ...readyLeaf,
        number: 7,
        title: 'Add login',
        types: ['task'],
      });

      await buildSubject({ runPort, ticketPort }).service.start('moritz/aisf', 7);

      expect(runPort.startRequests).toEqual([
        {
          projectId: 'moritz/aisf',
          ticketNumber: 7,
          ticketTitle: 'Add login',
          status: 'ready',
          types: ['task'],
        },
      ]);
    });

    it('should throw RunNotAvailableError with the reason and start nothing when the ticket already has a run active', async () => {
      const runPort = new FakeRunPort();
      runPort.activeTicketNumbers = [138];

      await expect(buildSubject({ runPort }).service.start('moritz/aisf', 138)).rejects.toThrow(
        new RunNotAvailableError('#138 is running'),
      );
      expect(runPort.calls).toEqual([]);
    });

    it('should throw RunNotAvailableError and start nothing when the ticket is a ui ticket and not a spike', async () => {
      const runPort = new FakeRunPort();
      const ticketPort = new FakeTicketPort({ ...readyLeaf, types: ['ui'] });

      await expect(
        buildSubject({ runPort, ticketPort }).service.start('moritz/aisf', 138),
      ).rejects.toThrow(RunNotAvailableError);
      expect(runPort.calls).toEqual([]);
    });

    it('should throw RunNotAvailableError and start nothing when the ticket is not runnable', async () => {
      const runPort = new FakeRunPort();
      const ticketPort = new FakeTicketPort({ ...readyLeaf, hasOpenBlocker: true });

      await expect(
        buildSubject({ runPort, ticketPort }).service.start('moritz/aisf', 138),
      ).rejects.toThrow(RunNotAvailableError);
      expect(runPort.calls).toEqual([]);
    });
  });

  describe('startIdeaSession', () => {
    it('should create the idea with an empty body and start a run for it when the project is onboarded', async () => {
      const { service, runPort, ticketPort } = buildIdeaSubject();

      const ticketNumber = await service.startIdeaSession(
        'moritz/aisf',
        'Export trips as postcards',
      );

      expect(ticketNumber).toBe(501);
      expect(ticketPort.calls).toEqual(['create {"title":"Export trips as postcards","body":""}']);
      expect(runPort.calls).toEqual(['start moritz/aisf #501']);
    });

    it('should create the idea with its first line as title and the full text as body when the text has several lines', async () => {
      const { service, ticketPort } = buildIdeaSubject();

      await service.startIdeaSession(
        'moritz/aisf',
        'Export trips as postcards\nAs printable cards.',
      );

      expect(ticketPort.calls).toEqual([
        'create {"title":"Export trips as postcards","body":"Export trips as postcards\\nAs printable cards."}',
      ]);
    });

    it('should throw ProjectNotFoundError and create nothing when the project is unknown', async () => {
      const { service, ticketPort } = buildIdeaSubject({ project: undefined });

      await expect(service.startIdeaSession('moritz/aisf', 'x')).rejects.toThrow(
        ProjectNotFoundError,
      );
      expect(ticketPort.calls).toEqual([]);
    });

    it('should throw RunNotAvailableError and create nothing when runs are blocked', async () => {
      const { service, ticketPort } = buildIdeaSubject({
        runsBlocked: { blocked: true, reason: 'Usage limit' },
      });

      await expect(service.startIdeaSession('moritz/aisf', 'x')).rejects.toThrow(
        new RunNotAvailableError('Usage limit'),
      );
      expect(ticketPort.calls).toEqual([]);
    });

    it('should throw RunNotAvailableError and create nothing when the project is not onboarded', async () => {
      const { service, ticketPort } = buildIdeaSubject({
        project: { repository, onboarded: false, paused: false },
      });

      await expect(service.startIdeaSession('moritz/aisf', 'x')).rejects.toThrow(
        RunNotAvailableError,
      );
      expect(ticketPort.calls).toEqual([]);
    });

    it('should throw IdeaRunNotStartedError with the ticket number when the run fails to start', async () => {
      const { service, runPort } = buildIdeaSubject();
      runPort.startFailure = new RunNotAvailableError('boom');

      await expect(service.startIdeaSession('moritz/aisf', 'x')).rejects.toThrow(
        new IdeaRunNotStartedError(501, 'boom'),
      );
    });

    it('should throw IdeaRunNotStartedError with the ticket number when the snapshot lacks the new idea', async () => {
      const { service } = buildIdeaSubject({ ticket: undefined });

      await expect(service.startIdeaSession('moritz/aisf', 'x')).rejects.toMatchObject({
        name: 'IdeaRunNotStartedError',
        ticketNumber: 501,
      });
    });
  });

  describe('answer', () => {
    it.each<[string, RunRecord, RunAnswer]>([
      ['a checkpoint answer to an ended checkpoint run', checkpointRun, checkpointAnswer],
      ['a checkpoint answer to a live checkpoint wait', liveRun, checkpointAnswer],
      ['an allow decision', permissionRun, allowAnswer],
      ['a deny decision', permissionRun, { kind: 'permission', decision: 'deny' }],
    ])(
      'should begin the gate before resuming the run when the answer is %s',
      async (_name, run, answer) => {
        const { service, ticketPort, runPort } = buildAnswerSubject(run);
        const resume = runPort.answer.bind(runPort);
        runPort.answer = async (runId, resumeAnswer) => {
          ticketPort.calls.push('answer reached');
          return resume(runId, resumeAnswer);
        };

        const resumedRun = await service.answer('run-1', answer);

        expect(resumedRun).toEqual({ id: 'run-2', startedAt: '2026-09-29T11:00:00.000Z' });
        expect(ticketPort.calls).toEqual(['begin moritz/aisf #147', 'answer reached']);
        expect(answersOf(runPort)).toEqual([`answer run-1 ${JSON.stringify(answer)}`]);
      },
    );

    it('should revert the gate and rethrow when the agent runs cannot resume', async () => {
      const { service, ticketPort, runPort } = buildAnswerSubject();
      const failure = new Error('worktree is gone');
      runPort.answerFailure = failure;

      await expect(service.answer('run-1', allowAnswer)).rejects.toBe(failure);

      expect(ticketPort.calls).toEqual(['begin moritz/aisf #147', 'revert moritz/aisf #147']);
    });

    it('should rethrow and not resume the run when the gate refuses to begin', async () => {
      const { service, ticketPort, runPort } = buildAnswerSubject();
      const refusal = new RunNotAnswerableError('#147 is not waiting');
      ticketPort.beginFailure = refusal;

      await expect(service.answer('run-1', allowAnswer)).rejects.toBe(refusal);

      expect(ticketPort.calls).toEqual(['begin moritz/aisf #147']);
      expect(answersOf(runPort)).toEqual([]);
    });

    it.each([
      [
        'the run did not end needing permission',
        (subject: ReturnType<typeof buildAnswerSubject>) => {
          subject.runPort.record = { ...permissionRun, ending: { kind: 'finished' } };
        },
      ],
      [
        'the run is unknown',
        (subject: ReturnType<typeof buildAnswerSubject>) => {
          subject.runPort.record = undefined;
        },
      ],
      [
        'a newer run exists for the ticket',
        (subject: ReturnType<typeof buildAnswerSubject>) => {
          subject.runPort.latest = { id: 'run-9', startedAt: '2026-09-29T10:00:00.000Z' };
        },
      ],
      [
        'the run neither ended nor waits',
        (subject: ReturnType<typeof buildAnswerSubject>) => {
          subject.runPort.record = {
            id: permissionRun.id,
            projectId: permissionRun.projectId,
            ticketNumber: permissionRun.ticketNumber,
            startedAt: permissionRun.startedAt,
          };
        },
      ],
    ])('should refuse and touch nothing when %s', async (_situation, arrange) => {
      const subject = buildAnswerSubject();
      arrange(subject);

      await expect(subject.service.answer('run-1', allowAnswer)).rejects.toThrow(
        RunNotAnswerableError,
      );

      expect(subject.ticketPort.calls).toEqual([]);
      expect(answersOf(subject.runPort)).toEqual([]);
    });

    it.each<[string, RunRecord, RunAnswer]>([
      ['a checkpoint answer to a permission run', permissionRun, checkpointAnswer],
      ['a permission answer to a checkpoint run', checkpointRun, allowAnswer],
      ['a permission answer to a live checkpoint wait', liveRun, allowAnswer],
    ])('should refuse and touch nothing when the pair is %s', async (_name, run, answer) => {
      const subject = buildAnswerSubject(run);

      await expect(subject.service.answer('run-1', answer)).rejects.toThrow(RunNotAnswerableError);

      expect(subject.ticketPort.calls).toEqual([]);
      expect(answersOf(subject.runPort)).toEqual([]);
    });
  });
});
