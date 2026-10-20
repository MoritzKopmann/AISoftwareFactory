import { describe, expect, it } from 'vitest';
import type { PausedRun } from '../domain/types/paused-run.js';
import type { RunAnswer } from '../domain/types/run-answer.js';
import type { ReviewedTicket } from '../domain/types/reviewed-ticket.js';
import type { RunRecord } from '../domain/types/run-record.js';
import type { RunsBlocked } from '../domain/types/runs-blocked.js';
import { IdeaRunNotStartedError } from '../errors/idea-run-not-started-error.js';
import { OnboardingNotNeededError } from '../errors/onboarding-not-needed-error.js';
import { ProjectNotFoundError } from '../errors/project-not-found-error.js';
import { RunNotAnswerableError } from '../errors/run-not-answerable-error.js';
import { RunNotAvailableError } from '../errors/run-not-available-error.js';
import type { ProjectPort, SchedulerProject } from '../port/project/project-port.js';
import {
  FakeProjectPort,
  FakeRunPort,
  FakeSkillPort,
  FakeTicketPort,
  FakeUsagePort,
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
    usagePort?: FakeUsagePort;
  } = {},
) {
  const runPort = options.runPort ?? new FakeRunPort();
  const ticketPort = options.ticketPort ?? new FakeTicketPort(readyLeaf);
  const usagePort = options.usagePort ?? new FakeUsagePort();
  const errors: string[] = [];
  const error = (message: string) => {
    errors.push(message);
  };
  const service = new TicketRunService({
    ticketPort,
    runPort,
    skillPort: options.skillPort ?? new FakeSkillPort(),
    projectPort: options.projectPort ?? new FakeProjectPort(),
    usagePort,
    logger: { info: () => undefined, warn: () => undefined, error },
  });
  return { service, runPort, ticketPort, usagePort, errors };
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

function buildAnswerSubject(run: RunRecord = permissionRun, pausedUntil?: string) {
  const usagePort = new FakeUsagePort();
  usagePort.pausedUntilValue = pausedUntil;
  const runPort = new FakeRunPort();
  runPort.record = run;
  runPort.latest = {
    answerHeld: false,
    id: run.id,
    startedAt: run.startedAt,
    ...(run.endedAt === undefined ? {} : { endedAt: run.endedAt }),
    ...(run.ending === undefined ? {} : { ending: run.ending }),
  };
  const { service, ticketPort } = buildSubject({ runPort, usagePort });
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
        answerHeld: false,
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
        activeRun: { id: 'run-1', startedAt, answerHeld: false },
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
        answerHeld: false,
        id: 'run-0',
        startedAt,
        endedAt,
        ending: { kind: 'escalated', escalation: 'spec', reason: 'AC 2 is unclear' },
      };

      const ticketRun = await buildSubject({ runPort }).service.readTicketRun('moritz/aisf', 138);

      expect(ticketRun.lastRun).toEqual({
        id: 'run-0',
        startedAt,
        answerHeld: false,
        endedAt,
        ending: { kind: 'escalated', escalation: 'spec', reason: 'AC 2 is unclear' },
      });
    });

    it('should leave out the last run when the latest run has not ended', async () => {
      const runPort = new FakeRunPort();
      runPort.latest = { id: 'run-0', answerHeld: false, startedAt };

      const ticketRun = await buildSubject({ runPort }).service.readTicketRun('moritz/aisf', 138);

      expect(ticketRun.lastRun).toBeUndefined();
    });

    it('should leave out the last run when the latest run has an end time but no ending', async () => {
      const runPort = new FakeRunPort();
      runPort.latest = { id: 'run-0', answerHeld: false, startedAt, endedAt };

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

  describe('startDue', () => {
    const project = 'moritz/aisf';
    const leaf7 = { ...readyLeaf, number: 7 };
    const leaf8 = { ...readyLeaf, number: 8 };
    const plan11 = { ...readyLeaf, number: 11, status: 'plan' as const };
    const reviewedOf = (...tickets: ReadonlyArray<typeof readyLeaf>) =>
      tickets.map(({ number, status, types }) => ({
        number,
        status,
        types,
        closingPullRequests: [],
      }));

    function buildDueSubject(
      tickets: ReadonlyArray<typeof readyLeaf>,
      options: { project?: SchedulerProject } = {},
    ) {
      const [first = readyLeaf] = tickets;
      return buildSubject({
        ticketPort: new FakeTicketPort(first, tickets, reviewedOf(...tickets)),
        ...(options.project === undefined
          ? {}
          : { projectPort: new FakeProjectPort(options.project) }),
      });
    }

    it('should start an implement run when a ready leaf is due', async () => {
      const { service, runPort } = buildDueSubject([leaf7]);

      const started = await service.startDue(project);

      expect(started).toHaveLength(1);
      expect(
        runPort.startRequests.map(({ ticketNumber, status }) => [ticketNumber, status]),
      ).toEqual([[7, 'ready']]);
    });

    it('should start nothing when the ticket has an open blocker', async () => {
      const { service, runPort } = buildDueSubject([{ ...leaf8, hasOpenBlocker: true }]);

      await service.startDue(project);

      expect(runPort.calls).toEqual([]);
    });

    it('should start a plan run when a plan ticket is due', async () => {
      const { service, runPort } = buildDueSubject([plan11]);

      await service.startDue(project);

      expect(
        runPort.startRequests.map(({ ticketNumber, status }) => [ticketNumber, status]),
      ).toEqual([[11, 'plan']]);
    });

    it.each(['backlog', 'idea'] as const)(
      'should start nothing when the ticket is %s',
      async (status) => {
        const { service, runPort } = buildDueSubject([{ ...leaf7, status }]);

        await service.startDue(project);

        expect(runPort.calls).toEqual([]);
      },
    );

    it('should start ready before plan when both are due', async () => {
      const { service, runPort } = buildDueSubject([plan11, { ...leaf7, number: 12 }]);

      await service.startDue(project);

      expect(runPort.calls).toEqual([`start ${project} #12`, `start ${project} #11`]);
    });

    it('should start a ready spike before plan when both are due', async () => {
      const { service, runPort } = buildDueSubject([
        plan11,
        { ...leaf7, number: 13, types: ['spike'] },
      ]);

      await service.startDue(project);

      expect(runPort.calls).toEqual([`start ${project} #13`, `start ${project} #11`]);
    });

    it.each([
      ['a waiting plan ticket', { ...plan11, waiting: true }],
      ['a stuck ready leaf', { ...leaf7, stuck: true }],
      ['a ticket whose sync failed', { ...leaf7, syncFailed: true }],
    ])('should start nothing for %s', async (_description, ticket) => {
      const { service, runPort } = buildDueSubject([ticket]);

      await service.startDue(project);

      expect(runPort.calls).toEqual([]);
    });

    it('should start nothing when the project is paused', async () => {
      const { service, runPort } = buildDueSubject([leaf7], {
        project: { repository, onboarded: true, paused: true },
      });
      runPort.activeTicketNumbers = [15];

      await service.startDue(project);

      expect(runPort.calls).toEqual([]);
    });

    it('should still start a manual run when the project is paused', async () => {
      const { service, runPort } = buildDueSubject([leaf7], {
        project: { repository, onboarded: true, paused: true },
      });

      await service.start(project, 7);

      expect(runPort.calls).toEqual([`start ${project} #7`]);
    });

    it('should log the error and start the next ticket when one start fails unexpectedly', async () => {
      const { service, runPort, errors } = buildDueSubject([leaf7, leaf8]);
      runPort.startFailure = new Error('boom');
      runPort.startFailureTicket = 7;

      const started = await service.startDue(project);

      expect(started).toHaveLength(1);
      expect(runPort.calls).toEqual([`start ${project} #7`, `start ${project} #8`]);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('boom');
    });

    it('should skip silently when a ticket already has a run active', async () => {
      const { service, runPort, errors } = buildDueSubject([leaf7]);
      runPort.activeTicketNumbers = [7];

      await service.startDue(project);

      expect(runPort.calls).toEqual([]);
      expect(errors).toEqual([]);
    });

    it('should start a ticket once when two calls overlap', async () => {
      const { service, runPort } = buildDueSubject([leaf7]);
      let release = (): void => undefined;
      runPort.startGate = new Promise<void>((resolve) => {
        release = resolve;
      });

      const first = service.startDue(project);
      await Promise.resolve();
      const second = service.startDue(project);
      await new Promise((resolve) => setImmediate(resolve));
      release();
      await Promise.all([first, second]);

      expect(runPort.calls).toEqual([`start ${project} #7`]);
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

        expect(resumedRun).toEqual({
          kind: 'answered',
          run: { id: 'run-2', startedAt: '2026-09-29T11:00:00.000Z' },
        });
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
          subject.runPort.latest = {
            id: 'run-9',
            answerHeld: false,
            startedAt: '2026-09-29T10:00:00.000Z',
          };
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

  describe('usage pause', () => {
    const pausedUntil = '2026-10-18T15:00:00.000Z';
    const pausedReason = `Usage limit reached, resets at ${pausedUntil}`;

    function buildPausedSubject() {
      const usagePort = new FakeUsagePort();
      usagePort.pausedUntilValue = pausedUntil;
      return { ...buildSubject({ usagePort }), usagePort };
    }

    it('should throw RunNotAvailableError and start nothing when a manual start comes while paused', async () => {
      const { service, runPort } = buildPausedSubject();

      await expect(service.start('moritz/aisf', 138)).rejects.toThrow(
        new RunNotAvailableError(pausedReason),
      );

      expect(runPort.calls).toEqual([]);
    });

    it('should show the ticket run disabled with the reset time when usage is paused', async () => {
      const ticketRun = await buildPausedSubject().service.readTicketRun('moritz/aisf', 138);

      expect(ticketRun.availability).toEqual({ kind: 'disabled', reason: pausedReason });
    });

    it('should start nothing and log no error when a due ticket comes while paused', async () => {
      const usagePort = new FakeUsagePort();
      usagePort.pausedUntilValue = pausedUntil;
      const { service, runPort, errors } = buildSubject({
        usagePort,
        ticketPort: new FakeTicketPort(
          readyLeaf,
          [readyLeaf],
          [{ number: readyLeaf.number, status: 'ready', types: [], closingPullRequests: [] }],
        ),
      });

      await service.startDue('moritz/aisf');

      expect(runPort.calls).toEqual([]);
      expect(errors).toEqual([]);
    });

    it('should show the ticket run available when usage is not paused', async () => {
      const ticketRun = await buildSubject().service.readTicketRun('moritz/aisf', 138);

      expect(ticketRun.availability).toEqual({ kind: 'available' });
    });

    it('should show answerHeld on the last run when the latest run holds an answer', async () => {
      const runPort = new FakeRunPort();
      runPort.latest = {
        answerHeld: true,
        id: 'run-0',
        startedAt,
        endedAt,
        ending: { kind: 'stopped' },
      };

      const ticketRun = await buildSubject({ runPort }).service.readTicketRun('moritz/aisf', 138);

      expect(ticketRun.lastRun?.answerHeld).toBe(true);
    });

    it('should show answerHeld on the active run when the active run holds an answer', async () => {
      const runPort = new FakeRunPort();
      runPort.activeTicketNumbers = [138];

      const ticketRun = await buildSubject({ runPort }).service.readTicketRun('moritz/aisf', 138);

      expect(ticketRun.activeRun?.answerHeld).toBe(false);
    });

    it('should hold the answer and not begin the gate when the answer comes while paused', async () => {
      const { service, runPort, ticketPort } = buildAnswerSubject(checkpointRun, pausedUntil);

      const outcome = await service.answer('run-1', checkpointAnswer);

      expect(outcome).toEqual({ kind: 'held', pausedUntil });
      expect(runPort.calls).toContain(`holdAnswer run-1 ${JSON.stringify(checkpointAnswer)}`);
      expect(answersOf(runPort)).toEqual([]);
      expect(ticketPort.calls).toEqual([]);
    });

    it('should refuse and hold nothing when the wrong answer comes while paused', async () => {
      const { service, runPort } = buildAnswerSubject(checkpointRun, pausedUntil);

      await expect(service.answer('run-1', allowAnswer)).rejects.toThrow(RunNotAnswerableError);

      expect(runPort.calls.filter((call) => call.startsWith('holdAnswer'))).toEqual([]);
    });
  });

  describe('continuePaused', () => {
    const project = 'moritz/aisf';

    function buildContinueSubject(paused: ReadonlyArray<PausedRun>, stuckTickets: number[] = []) {
      const runPort = new FakeRunPort();
      runPort.paused = paused;
      const ticketPort = new FakeTicketPort(readyLeaf);
      const find = ticketPort.find.bind(ticketPort);
      ticketPort.find = async (projectId, number) => {
        const ticket = await find(projectId, number);
        return ticket === undefined
          ? undefined
          : { ...ticket, number, stuck: stuckTickets.includes(number) };
      };
      return { ...buildSubject({ runPort, ticketPort }), runPort, ticketPort };
    }

    it('should begin the gate then deliver the held answer when the run holds one', async () => {
      const { service, runPort, ticketPort } = buildContinueSubject([
        { runId: 'run-1', ticketNumber: 7, heldAnswer: checkpointAnswer },
      ]);

      await service.continuePaused(project);

      expect(ticketPort.calls).toEqual([`begin ${project} #7`]);
      expect(runPort.calls).toEqual([`answer run-1 ${JSON.stringify(checkpointAnswer)}`]);
    });

    it('should resume the run without beginning the gate when the run holds no answer', async () => {
      const { service, runPort, ticketPort } = buildContinueSubject([
        { runId: 'run-1', ticketNumber: 7 },
      ]);

      await service.continuePaused(project);

      expect(runPort.calls).toEqual(['resumePaused run-1']);
      expect(ticketPort.calls).toEqual([]);
    });

    it('should neither answer nor resume the run when its ticket is stuck', async () => {
      const { service, runPort } = buildContinueSubject(
        [{ runId: 'run-1', ticketNumber: 7, heldAnswer: checkpointAnswer }],
        [7],
      );

      await service.continuePaused(project);

      expect(runPort.calls).toEqual([]);
    });

    it('should neither answer nor resume any run when usage is still paused', async () => {
      const { service, runPort, usagePort } = buildContinueSubject([
        { runId: 'run-1', ticketNumber: 7 },
      ]);
      usagePort.pausedUntilValue = '2026-10-18T15:00:00.000Z';

      await service.continuePaused(project);

      expect(runPort.calls).toEqual([]);
    });

    it('should revert the gate and log the error when the held answer fails', async () => {
      const { service, runPort, ticketPort, errors } = buildContinueSubject([
        { runId: 'run-1', ticketNumber: 7, heldAnswer: checkpointAnswer },
      ]);
      runPort.answerFailure = new Error('worktree is gone');

      await service.continuePaused(project);

      expect(ticketPort.calls).toEqual([`begin ${project} #7`, `revert ${project} #7`]);
      expect(errors).toEqual([expect.stringContaining('worktree is gone')]);
    });

    it('should resume the next run and log when resuming one run fails', async () => {
      const { service, runPort, errors } = buildContinueSubject([
        { runId: 'run-1', ticketNumber: 7 },
        { runId: 'run-2', ticketNumber: 8 },
      ]);
      runPort.resumeFailureRunId = 'run-1';

      await service.continuePaused(project);

      expect(runPort.calls).toEqual(['resumePaused run-1', 'resumePaused run-2']);
      expect(errors).toEqual([expect.stringContaining('run-1')]);
    });
  });

  describe('startOnboarding', () => {
    const onboardTicket = { ...readyLeaf, number: 501, types: ['onboard' as const] };
    const notOnboarded: SchedulerProject = { repository, onboarded: false, paused: false };

    function buildOnboardingSubject(
      options: { project?: SchedulerProject; open?: ReadonlyArray<ReviewedTicket> } = {},
    ) {
      const runPort = new FakeRunPort();
      const ticketPort = new FakeTicketPort(onboardTicket, [], options.open ?? []);
      const { service } = buildSubject({
        runPort,
        ticketPort,
        projectPort: new FakeProjectPort(options.project ?? notOnboarded),
      });
      return { service, runPort, ticketPort };
    }

    it('should create the onboarding issue and start a run on it when the project is not onboarded', async () => {
      const { service, runPort, ticketPort } = buildOnboardingSubject();

      const ticketNumber = await service.startOnboarding('moritz/aisf', 'manual');

      expect(ticketNumber).toBe(501);
      expect(ticketPort.calls).toEqual([
        expect.stringMatching(
          /^create \{"title":"Onboard moritz\/aisf","body":".*aisf:onboard-project.*","status":"ready","types":\["onboard"\],"priority":"high"\}$/,
        ),
      ]);
      expect(runPort.calls).toEqual(['start moritz/aisf #501']);
    });

    it('should create nothing and start no run when the project is onboarded and the trigger is project-added', async () => {
      const { service, runPort, ticketPort } = buildOnboardingSubject({
        project: { repository, onboarded: true, paused: false },
      });

      await service.startOnboarding('moritz/aisf', 'project-added');

      expect(ticketPort.calls).toEqual([]);
      expect(runPort.calls).toEqual([]);
    });

    it('should throw a ConflictError and create nothing when the project is onboarded and the trigger is manual', async () => {
      const { service, runPort, ticketPort } = buildOnboardingSubject({
        project: { repository, onboarded: true, paused: false },
      });

      await expect(service.startOnboarding('moritz/aisf', 'manual')).rejects.toThrow(
        OnboardingNotNeededError,
      );
      expect(ticketPort.calls).toEqual([]);
      expect(runPort.calls).toEqual([]);
    });

    it('should throw a ConflictError and create nothing when an onboard ticket is open and the trigger is manual', async () => {
      const open: ReviewedTicket = {
        number: 9,
        status: 'ready',
        types: ['onboard'],
        closingPullRequests: [],
      };
      const { service, ticketPort } = buildOnboardingSubject({ open: [open] });

      await expect(service.startOnboarding('moritz/aisf', 'manual')).rejects.toThrow(
        OnboardingNotNeededError,
      );
      expect(ticketPort.calls).toEqual([]);
    });

    it('should create the issue when an onboard ticket is open and the trigger is project-added', async () => {
      const open: ReviewedTicket = {
        number: 9,
        status: 'ready',
        types: ['onboard'],
        closingPullRequests: [],
      };
      const { service, ticketPort } = buildOnboardingSubject({ open: [open] });

      await service.startOnboarding('moritz/aisf', 'project-added');

      expect(ticketPort.calls).toHaveLength(1);
    });

    it('should throw ProjectNotFoundError when the project is unknown', async () => {
      const { service } = buildSubject({ projectPort: { find: async () => undefined } });

      await expect(service.startOnboarding('moritz/aisf', 'manual')).rejects.toThrow(
        ProjectNotFoundError,
      );
    });
  });
});
