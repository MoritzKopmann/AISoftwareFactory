import { describe, expect, it, vi } from 'vitest';
import { TicketNotAnswerableError } from '../errors/ticket-not-answerable-error.js';
import type { ProjectPort } from '../port/project/project-port.js';
import { FakeEventPublisher } from '../../../../shared/testing/fake-event-publisher.js';
import { FakeProjectPort } from '../../testing/fake-tickets-ports.js';
import { FakeTicketStatusWrites, FakeRunPort } from '../../testing/fake-ticket-status-writes.js';
import { TicketNotMovableError } from '../errors/ticket-not-movable-error.js';
import { TicketNotResettableError } from '../errors/ticket-not-resettable-error.js';
import type { TicketStatus } from '../../../../shared/ticket-status/ticket-status.js';
import type { FinishedRun } from '../domain/types/finished-run.js';
import type { WaitingRun } from '../domain/types/waiting-run.js';
import { TicketStatusService } from './ticket-status-service.js';
import { unusedTicketStatusDependencies } from '../../testing/unused-dependencies.js';

describe('TicketStatusService', () => {
  describe('beginAnswer', () => {
    function buildSubject(
      waiting: boolean,
      projectPort: ProjectPort = new FakeProjectPort([
        { projectId: 'moritz/aisf', repository: { owner: 'moritz', name: 'aisf' } },
      ]),
    ) {
      const ticketStatusWrites = new FakeTicketStatusWrites();
      ticketStatusWrites.liveWaiting = waiting;
      const events = new FakeEventPublisher();
      const useCase = new TicketStatusService({
        ...unusedTicketStatusDependencies,
        ticketStatusWrites,
        projectPort,
        events,
      });
      return { useCase, ticketStatusWrites, events };
    }

    it('should remove the waiting label and announce it when the ticket is waiting', async () => {
      const { useCase, ticketStatusWrites, events } = buildSubject(true);

      await useCase.beginAnswer('moritz/aisf', 147);

      expect(ticketStatusWrites.calls).toEqual(['readState', 'setSecondaryState #147 waiting off']);
      expect(events.emittedEvents).toEqual([
        {
          name: 'ticket.status-written',
          payload: {
            projectId: 'moritz/aisf',
            ticketNumber: 147,
            from: 'in-progress',
            to: 'in-progress',
            waiting: false,
            stuck: false,
          },
        },
      ]);
    });

    it('should throw and write nothing when the ticket has no waiting label', async () => {
      const { useCase, ticketStatusWrites, events } = buildSubject(false);

      await expect(useCase.beginAnswer('moritz/aisf', 147)).rejects.toThrow('#147 is not waiting');

      expect(ticketStatusWrites.calls).toEqual(['readState']);
      expect(events.emittedEvents).toEqual([]);
    });

    it('should throw and write nothing when the project is unknown', async () => {
      const { useCase, ticketStatusWrites } = buildSubject(true, new FakeProjectPort([]));

      await expect(useCase.beginAnswer('moritz/aisf', 147)).rejects.toBeInstanceOf(
        TicketNotAnswerableError,
      );

      expect(ticketStatusWrites.calls).toEqual([]);
    });

    it('should announce nothing when the label write fails', async () => {
      const { useCase, ticketStatusWrites, events } = buildSubject(true);
      ticketStatusWrites.setStatusFailure = new Error('gh failed');

      await expect(useCase.beginAnswer('moritz/aisf', 147)).rejects.toThrow('gh failed');

      expect(events.emittedEvents).toEqual([]);
    });
  });

  describe('revertAnswer', () => {
    it('should restore the waiting label and announce it when an answer is reverted', async () => {
      const ticketStatusWrites = new FakeTicketStatusWrites();
      const events = new FakeEventPublisher();
      const useCase = new TicketStatusService({
        ...unusedTicketStatusDependencies,
        ticketStatusWrites,
        projectPort: new FakeProjectPort([
          { projectId: 'moritz/aisf', repository: { owner: 'moritz', name: 'aisf' } },
        ]),
        events,
      });

      await useCase.revertAnswer('moritz/aisf', 147);

      expect(ticketStatusWrites.calls).toEqual(['readState', 'setSecondaryState #147 waiting on']);
      expect(events.emittedEvents).toEqual([
        {
          name: 'ticket.status-written',
          payload: {
            projectId: 'moritz/aisf',
            ticketNumber: 147,
            from: 'in-progress',
            to: 'in-progress',
            waiting: true,
            stuck: false,
          },
        },
      ]);
    });
  });

  describe('reset', () => {
    function buildSubject(
      liveStatus: TicketStatus,
      flags: { waiting?: boolean; stuck?: boolean } = {},
      projectPort: ProjectPort = new FakeProjectPort([
        { projectId: 'moritz/aisf', repository: { owner: 'moritz', name: 'aisf' } },
      ]),
    ) {
      const ticketStatusWrites = new FakeTicketStatusWrites();
      ticketStatusWrites.liveStatus = liveStatus;
      ticketStatusWrites.liveWaiting = flags.waiting ?? false;
      ticketStatusWrites.liveStuck = flags.stuck ?? false;
      const runPort = new FakeRunPort();
      const events = new FakeEventPublisher();
      const useCase = new TicketStatusService({
        ...unusedTicketStatusDependencies,
        ticketStatusWrites,
        runPort,
        projectPort,
        events,
      });
      return { useCase, ticketStatusWrites, runPort, events };
    }

    it('should set the ticket ready and clear the stuck label when it is in-progress and stuck', async () => {
      const { useCase, ticketStatusWrites } = buildSubject('in-progress', { stuck: true });

      await useCase.reset('moritz/aisf', 138);

      expect(ticketStatusWrites.calls).toEqual([
        'readState',
        'setStatus #138 -> ready',
        'setSecondaryState #138 stuck off',
      ]);
    });

    it('should clear both labels when the ticket is waiting and stuck', async () => {
      const { useCase, ticketStatusWrites } = buildSubject('in-progress', {
        waiting: true,
        stuck: true,
      });

      await useCase.reset('moritz/aisf', 138);

      expect(ticketStatusWrites.calls).toEqual([
        'readState',
        'setStatus #138 -> ready',
        'setSecondaryState #138 waiting off',
        'setSecondaryState #138 stuck off',
      ]);
    });

    it('should only set the status when the ticket is in-progress without flags', async () => {
      const { useCase, ticketStatusWrites } = buildSubject('in-progress');

      await useCase.reset('moritz/aisf', 138);

      expect(ticketStatusWrites.calls).toEqual(['readState', 'setStatus #138 -> ready']);
    });

    it('should set the ticket ready when the active run is on another ticket', async () => {
      const { useCase, ticketStatusWrites, runPort } = buildSubject('in-progress', {
        stuck: true,
      });
      runPort.activeTicketNumbers = [140];

      await useCase.reset('moritz/aisf', 138);

      expect(ticketStatusWrites.calls).toContain('setStatus #138 -> ready');
    });

    it('should throw and write nothing when the ticket has an active run', async () => {
      const { useCase, ticketStatusWrites, runPort } = buildSubject('in-progress', {
        stuck: true,
      });
      runPort.activeTicketNumbers = [138];

      await expect(useCase.reset('moritz/aisf', 138)).rejects.toBeInstanceOf(
        TicketNotResettableError,
      );
      expect(ticketStatusWrites.calls).toEqual([]);
    });

    it.each(['ready', 'in-review'] as const)(
      'should throw and write nothing when the ticket status is %s without a stuck label',
      async (status) => {
        const { useCase, ticketStatusWrites } = buildSubject(status);

        await expect(useCase.reset('moritz/aisf', 138)).rejects.toBeInstanceOf(
          TicketNotResettableError,
        );
        expect(ticketStatusWrites.calls).toEqual(['readState']);
      },
    );

    it('should throw and not touch the ticket when the project is unknown', async () => {
      const { useCase, ticketStatusWrites } = buildSubject(
        'in-progress',
        { stuck: true },
        new FakeProjectPort([]),
      );

      await expect(useCase.reset('moritz/unknown', 138)).rejects.toBeInstanceOf(
        TicketNotResettableError,
      );
      expect(ticketStatusWrites.calls).toEqual([]);
    });

    it('should emit ticket.status-written to ready with both flags off when the reset succeeds', async () => {
      const { useCase, events } = buildSubject('in-progress', { stuck: true });

      await useCase.reset('moritz/aisf', 138);

      expect(events.emittedEvents).toEqual([
        {
          name: 'ticket.status-written',
          payload: {
            projectId: 'moritz/aisf',
            ticketNumber: 138,
            from: 'in-progress',
            to: 'ready',
            waiting: false,
            stuck: false,
          },
        },
      ]);
    });

    it('should emit nothing when the ticket has an active run', async () => {
      const { useCase, runPort, events } = buildSubject('in-progress', { stuck: true });
      runPort.activeTicketNumbers = [138];

      await expect(useCase.reset('moritz/aisf', 138)).rejects.toBeInstanceOf(
        TicketNotResettableError,
      );
      expect(events.emittedEvents).toEqual([]);
    });

    it('should emit nothing when the status write fails', async () => {
      const { useCase, ticketStatusWrites, events } = buildSubject('in-progress', { stuck: true });
      ticketStatusWrites.setStatusFailure = new Error('gh failed');

      await expect(useCase.reset('moritz/aisf', 138)).rejects.toThrow('gh failed');
      expect(events.emittedEvents).toEqual([]);
    });

    it('should clear both labels and write no status when an in-review ticket is waiting and stuck', async () => {
      const { useCase, ticketStatusWrites } = buildSubject('in-review', {
        waiting: true,
        stuck: true,
      });

      await useCase.reset('moritz/aisf', 9);

      expect(ticketStatusWrites.calls).toEqual([
        'readState',
        'setSecondaryState #9 waiting off',
        'setSecondaryState #9 stuck off',
      ]);
    });

    it.each([
      'idea',
      'backlog',
      'plan',
      'planned',
      'ready',
      'in-review',
      'conflict',
      'closed',
    ] as const)(
      'should clear the stuck label and keep the status when a ticket at %s is reset',
      async (status) => {
        const { useCase, ticketStatusWrites, events } = buildSubject(status, { stuck: true });

        await useCase.reset('moritz/aisf', 7);

        expect(ticketStatusWrites.calls).toEqual(['readState', 'setSecondaryState #7 stuck off']);
        expect(events.emittedEvents).toMatchObject([
          { payload: { from: status, to: status, waiting: false, stuck: false } },
        ]);
      },
    );
  });

  describe('moveToPlan', () => {
    function buildSubject(
      liveStatus: TicketStatus,
      projectPort: ProjectPort = new FakeProjectPort([
        { projectId: 'owner/name', repository: { owner: 'owner', name: 'name' } },
      ]),
    ) {
      const ticketStatusWrites = new FakeTicketStatusWrites();
      ticketStatusWrites.liveStatus = liveStatus;
      const events = new FakeEventPublisher();
      const useCase = new TicketStatusService({
        ...unusedTicketStatusDependencies,
        ticketStatusWrites,
        projectPort,
        events,
      });
      return { useCase, ticketStatusWrites, events };
    }

    it('should write status plan and emit ticket.status-written when the ticket is in backlog', async () => {
      const { useCase, ticketStatusWrites, events } = buildSubject('backlog');

      await useCase.moveToPlan('owner/name', 7);

      expect(ticketStatusWrites.calls).toEqual(['readState', 'setStatus #7 -> plan']);
      expect(events.emittedEvents).toEqual([
        {
          name: 'ticket.status-written',
          payload: {
            projectId: 'owner/name',
            ticketNumber: 7,
            from: 'backlog',
            to: 'plan',
            waiting: false,
            stuck: false,
          },
        },
      ]);
    });

    it('should carry the live flags in the event when the backlog ticket is flagged', async () => {
      const { useCase, ticketStatusWrites, events } = buildSubject('backlog');
      ticketStatusWrites.liveStuck = true;

      await useCase.moveToPlan('owner/name', 7);

      expect(events.emittedEvents).toMatchObject([{ payload: { waiting: false, stuck: true } }]);
    });

    it('should throw and write nothing when the ticket is not in backlog', async () => {
      const { useCase, ticketStatusWrites, events } = buildSubject('ready');

      await expect(useCase.moveToPlan('owner/name', 7)).rejects.toBeInstanceOf(
        TicketNotMovableError,
      );
      expect(ticketStatusWrites.calls).toEqual(['readState']);
      expect(events.emittedEvents).toEqual([]);
    });

    it('should throw and write nothing when the project is unknown', async () => {
      const { useCase, ticketStatusWrites, events } = buildSubject(
        'backlog',
        new FakeProjectPort([]),
      );

      await expect(useCase.moveToPlan('owner/missing', 7)).rejects.toBeInstanceOf(
        TicketNotMovableError,
      );
      expect(ticketStatusWrites.calls).toEqual([]);
      expect(events.emittedEvents).toEqual([]);
    });
  });

  describe('settleFinishedRun', () => {
    const escalatedRun: FinishedRun = {
      runId: 'run-1',
      projectId: 'moritz/aisf',
      ticketNumber: 138,
      stage: 'implement',
      ending: { kind: 'escalated', escalation: 'spec', reason: 'AC is vague' },
    };

    function buildSubject(
      projectPort: ProjectPort = new FakeProjectPort([
        { projectId: 'moritz/aisf', repository: { owner: 'moritz', name: 'aisf' } },
      ]),
    ) {
      const ticketStatusWrites = new FakeTicketStatusWrites();
      const runPort = new FakeRunPort();
      const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
      const events = new FakeEventPublisher();
      const useCase = new TicketStatusService({
        ...unusedTicketStatusDependencies,
        ticketStatusWrites,
        runPort,
        projectPort,
        events,
        logger,
      });
      return { useCase, ticketStatusWrites, runPort, logger, events };
    }

    it('should add the stuck label, then comment, then settle the run when the ticket is in-progress after an escalation', async () => {
      const { useCase, ticketStatusWrites, runPort } = buildSubject();

      await useCase.settleFinishedRun(escalatedRun);

      expect(ticketStatusWrites.calls).toEqual([
        'readState',
        'setSecondaryState #138 stuck on',
        'comment #138: The run escalated (spec): AC is vague',
      ]);
      expect(runPort.calls).toEqual(['settle run-1']);
    });

    it('should add the waiting label, post the request and settle the run when the run reached its checkpoint', async () => {
      const { useCase, ticketStatusWrites, runPort } = buildSubject();

      await useCase.settleFinishedRun({
        ...escalatedRun,
        ending: { kind: 'checkpoint', request: 'Check the waiting chip' },
      });

      expect(ticketStatusWrites.calls).toEqual([
        'readState',
        'setSecondaryState #138 waiting on',
        'comment #138: The run reached its human checkpoint and waits for an answer on the ticket page:\n\nCheck the waiting chip',
      ]);
      expect(runPort.calls).toEqual(['settle run-1']);
    });

    it('should return the ticket to ready without a comment and settle when the run parked', async () => {
      const { useCase, ticketStatusWrites, runPort } = buildSubject();

      await useCase.settleFinishedRun({
        ...escalatedRun,
        ending: { kind: 'parked', blockerNumber: 12 },
      });

      expect(ticketStatusWrites.calls).toEqual(['readState', 'setStatus #138 -> ready']);
      expect(runPort.calls).toEqual(['settle run-1']);
    });

    it('should write nothing and settle when the ticket is already in-review', async () => {
      const { useCase, ticketStatusWrites, runPort } = buildSubject();
      ticketStatusWrites.liveStatus = 'in-review';

      await useCase.settleFinishedRun({ ...escalatedRun, ending: { kind: 'finished' } });

      expect(ticketStatusWrites.calls).toEqual(['readState']);
      expect(runPort.calls).toEqual(['settle run-1']);
    });

    it('should write nothing, emit nothing and settle the run when the run hit the usage limit', async () => {
      const { useCase, ticketStatusWrites, runPort, events } = buildSubject();

      await useCase.settleFinishedRun({
        ...escalatedRun,
        ending: { kind: 'usage-limit', reason: 'limit hit' },
      });

      expect(ticketStatusWrites.calls).toEqual(['readState']);
      expect(events.emittedEvents).toEqual([]);
      expect(runPort.calls).toEqual(['settle run-1']);
    });

    describe('a plan run that finished', () => {
      const planRun: FinishedRun = {
        ...escalatedRun,
        stage: 'plan',
        ending: { kind: 'finished' },
      };

      it('should add the stuck label, comment and emit stuck when the ticket is still at plan with no open spike', async () => {
        const { useCase, ticketStatusWrites, events } = buildSubject();
        ticketStatusWrites.liveStatus = 'plan';

        await useCase.settleFinishedRun(planRun);

        expect(ticketStatusWrites.calls).toEqual([
          'readState',
          'hasOpenSpike #138',
          'setSecondaryState #138 stuck on',
          'comment #138: The plan run finished but the ticket is still at plan',
        ]);
        expect(events.emittedEvents).toContainEqual({
          name: 'ticket.status-written',
          payload: expect.objectContaining({ ticketNumber: 138, stuck: true }) as unknown,
        });
      });

      it('should write nothing when the ticket is still at plan with an open spike', async () => {
        const { useCase, ticketStatusWrites } = buildSubject();
        ticketStatusWrites.liveStatus = 'plan';
        ticketStatusWrites.openSpike = true;

        await useCase.settleFinishedRun(planRun);

        expect(ticketStatusWrites.calls).toEqual(['readState', 'hasOpenSpike #138']);
      });

      it('should not read spikes when the ticket moved on to planned', async () => {
        const { useCase, ticketStatusWrites } = buildSubject();
        ticketStatusWrites.liveStatus = 'planned';

        await useCase.settleFinishedRun(planRun);

        expect(ticketStatusWrites.calls).toEqual(['readState']);
      });
    });

    it('should write nothing and settle when the ticket was marked stuck during the run', async () => {
      const { useCase, ticketStatusWrites, runPort } = buildSubject();
      ticketStatusWrites.liveStuck = true;

      await useCase.settleFinishedRun(escalatedRun);

      expect(ticketStatusWrites.calls).toEqual(['readState']);
      expect(runPort.calls).toEqual(['settle run-1']);
    });

    it('should write nothing and settle when a parked run finds the ticket ready', async () => {
      const { useCase, ticketStatusWrites, runPort } = buildSubject();
      ticketStatusWrites.liveStatus = 'ready';

      await useCase.settleFinishedRun({
        ...escalatedRun,
        ending: { kind: 'parked', blockerNumber: 12 },
      });

      expect(ticketStatusWrites.calls).toEqual(['readState']);
      expect(runPort.calls).toEqual(['settle run-1']);
    });

    it('should add stuck, remove waiting and keep the status when a waiting run crashed', async () => {
      const { useCase, ticketStatusWrites, events, runPort } = buildSubject();
      ticketStatusWrites.liveWaiting = true;

      await useCase.settleFinishedRun({
        ...escalatedRun,
        ending: { kind: 'crashed', reason: 'boom' },
      });

      expect(ticketStatusWrites.calls).toEqual([
        'readState',
        'setSecondaryState #138 waiting off',
        'setSecondaryState #138 stuck on',
        'comment #138: The run crashed: boom',
      ]);
      expect(ticketStatusWrites.liveStatus).toBe('in-progress');
      expect(events.emittedEvents).toEqual([
        {
          name: 'ticket.status-written',
          payload: {
            projectId: 'moritz/aisf',
            ticketNumber: 138,
            from: 'in-progress',
            to: 'in-progress',
            waiting: false,
            stuck: true,
          },
        },
      ]);
      expect(runPort.calls).toEqual(['settle run-1']);
    });

    it('should write nothing the second time when the same run.finished is replayed', async () => {
      const { useCase, ticketStatusWrites } = buildSubject();

      await useCase.settleFinishedRun(escalatedRun);
      const callsAfterFirstSettlement = ticketStatusWrites.calls.length;
      await useCase.settleFinishedRun(escalatedRun);

      expect(ticketStatusWrites.calls.slice(callsAfterFirstSettlement)).toEqual(['readState']);
    });

    it('should write nothing, log it and settle when the project is unknown', async () => {
      const { useCase, ticketStatusWrites, runPort, logger } = buildSubject(
        new FakeProjectPort([]),
      );

      await useCase.settleFinishedRun(escalatedRun);

      expect(ticketStatusWrites.calls).toEqual([]);
      expect(logger.warn).toHaveBeenCalled();
      expect(runPort.calls).toEqual(['settle run-1']);
    });

    it('should not settle the run when a ticket write throws', async () => {
      const { useCase, ticketStatusWrites, runPort } = buildSubject();
      ticketStatusWrites.comment = async () => {
        throw new Error('gh failed');
      };

      await expect(useCase.settleFinishedRun(escalatedRun)).rejects.toThrow('gh failed');
      expect(runPort.calls).toEqual([]);
    });

    it('should announce the waiting write after the label write and before comment when the run needs permission', async () => {
      const { useCase, ticketStatusWrites, events } = buildSubject();
      let eventsSeenAtComment = -1;
      ticketStatusWrites.comment = async () => {
        eventsSeenAtComment = events.emittedEvents.length;
      };

      await useCase.settleFinishedRun({
        ...escalatedRun,
        ending: { kind: 'permission-needed', toolName: 'Bash', toolInput: {} },
      });

      expect(events.emittedEvents).toEqual([
        {
          name: 'ticket.status-written',
          payload: {
            projectId: 'moritz/aisf',
            ticketNumber: 138,
            from: 'in-progress',
            to: 'in-progress',
            waiting: true,
            stuck: false,
          },
        },
      ]);
      expect(eventsSeenAtComment).toBe(1);
    });

    it('should announce the ready write when the run parked', async () => {
      const { useCase, events } = buildSubject();

      await useCase.settleFinishedRun({
        ...escalatedRun,
        ending: { kind: 'parked', blockerNumber: 12 },
      });

      expect(events.emittedEvents).toEqual([
        {
          name: 'ticket.status-written',
          payload: {
            projectId: 'moritz/aisf',
            ticketNumber: 138,
            from: 'in-progress',
            to: 'ready',
            waiting: false,
            stuck: false,
          },
        },
      ]);
    });

    it('should announce nothing and still settle when no transition is needed', async () => {
      const { useCase, ticketStatusWrites, runPort, events } = buildSubject();
      ticketStatusWrites.liveStatus = 'in-review';

      await useCase.settleFinishedRun({ ...escalatedRun, ending: { kind: 'finished' } });

      expect(events.emittedEvents).toEqual([]);
      expect(runPort.calls).toEqual(['settle run-1']);
    });

    it('should announce nothing when the project is unknown', async () => {
      const { useCase, events } = buildSubject(new FakeProjectPort([]));

      await useCase.settleFinishedRun(escalatedRun);

      expect(events.emittedEvents).toEqual([]);
    });

    it('should announce nothing and rethrow when the label write throws', async () => {
      const { useCase, ticketStatusWrites, events } = buildSubject();
      const failure = new Error('gh failed');
      ticketStatusWrites.setStatusFailure = failure;

      await expect(useCase.settleFinishedRun(escalatedRun)).rejects.toBe(failure);

      expect(events.emittedEvents).toEqual([]);
    });

    describe('authoring runs', () => {
      it('should add the stuck label and comment and keep the status when a create run crashed at idea', async () => {
        const { useCase, ticketStatusWrites } = buildSubject();
        ticketStatusWrites.liveStatus = 'idea';

        await useCase.settleFinishedRun({
          ...escalatedRun,
          stage: 'create',
          ending: { kind: 'crashed', reason: 'boom' },
        });

        expect(ticketStatusWrites.calls).toEqual([
          'readState',
          'setSecondaryState #138 stuck on',
          'comment #138: The run crashed: boom',
        ]);
      });
    });
  });

  describe('settleWaitingRun', () => {
    const waitingRun: WaitingRun = {
      runId: 'r1',
      projectId: 'moritz/aisf',
      ticketNumber: 7,
      stage: 'implement',
      wait: { kind: 'checkpoint', request: 'Pick A or B' },
    };

    function buildSubject(
      projectPort: ProjectPort = new FakeProjectPort([
        { projectId: 'moritz/aisf', repository: { owner: 'moritz', name: 'aisf' } },
      ]),
    ) {
      const ticketStatusWrites = new FakeTicketStatusWrites();
      const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
      const events = new FakeEventPublisher();
      const useCase = new TicketStatusService({
        ...unusedTicketStatusDependencies,
        ticketStatusWrites,
        projectPort,
        events,
        logger,
      });
      return { useCase, ticketStatusWrites, logger, events };
    }

    it('should add the waiting label, keep the status, announce it and post the request once when the run waits live', async () => {
      const { useCase, ticketStatusWrites, events } = buildSubject();

      await useCase.settleWaitingRun(waitingRun);

      expect(ticketStatusWrites.calls).toEqual([
        'readState',
        'setSecondaryState #7 waiting on',
        'comment #7: The run reached its human checkpoint and waits for an answer on the ticket page:\n\nPick A or B',
      ]);
      expect(events.emittedEvents).toEqual([
        {
          name: 'ticket.status-written',
          payload: {
            projectId: 'moritz/aisf',
            ticketNumber: 7,
            from: 'in-progress',
            to: 'in-progress',
            waiting: true,
            stuck: false,
          },
        },
      ]);
    });

    it('should change nothing and warn when the project is unknown', async () => {
      const { useCase, ticketStatusWrites, logger, events } = buildSubject(new FakeProjectPort([]));

      await useCase.settleWaitingRun(waitingRun);

      expect(ticketStatusWrites.calls).toEqual([]);
      expect(events.emittedEvents).toEqual([]);
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    it('should write nothing when the ticket is already waiting', async () => {
      const { useCase, ticketStatusWrites } = buildSubject();
      ticketStatusWrites.liveWaiting = true;

      await useCase.settleWaitingRun(waitingRun);

      expect(ticketStatusWrites.calls).toEqual(['readState']);
    });

    it('should add the waiting label and keep the idea status when a create run waits at its page', async () => {
      const { useCase, ticketStatusWrites } = buildSubject();
      ticketStatusWrites.liveStatus = 'idea';

      await useCase.settleWaitingRun({ ...waitingRun, stage: 'create' });

      expect(ticketStatusWrites.calls).toEqual([
        'readState',
        'setSecondaryState #7 waiting on',
        expect.stringContaining('comment #7:') as string,
      ]);
    });
  });
});
